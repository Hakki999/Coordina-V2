const ExcelJS = require("exceljs");
const db = require("../models/db");
const {
  COLUNAS,
  normalizarValor,
  dataAtualControle,
  listarColunasControle,
  anexarValoresCustomizados,
  colunaFisica,
  colunaCalculada,
  salvarValoresCustomizados
} = require("./controle-asbuilt");

const LIMITE_ARQUIVO = 20 * 1024 * 1024;

function erro(mensagem) {
  const error = new Error(mensagem);
  error.status = 400;
  return error;
}

async function carregarWorkbook(req) {
  const arquivo = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  if (!arquivo.length || arquivo.length > LIMITE_ARQUIVO) throw erro("Envie uma planilha XLSX válida de até 20 MB.");
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(arquivo);
  } catch {
    throw erro("Não foi possível ler a planilha XLSX.");
  }
  return workbook;
}

function indiceValido(valor, padrao = 1) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : padrao;
}

function valorCelula(cell) {
  let valor = cell.value;
  if (valor && typeof valor === "object" && Object.prototype.hasOwnProperty.call(valor, "result")) valor = valor.result;
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (valor && typeof valor === "object") return cell.text || JSON.stringify(valor);
  return valor ?? "";
}

function obterSheet(workbook, indice) {
  const sheet = workbook.worksheets[indice - 1];
  if (!sheet) throw erro("A aba selecionada não existe.");
  return sheet;
}

function lerCabecalhos(sheet, linhaCabecalho) {
  const row = sheet.getRow(linhaCabecalho);
  const cabecalhos = [];
  for (let coluna = 1; coluna <= Math.max(row.cellCount, sheet.columnCount); coluna += 1) {
    const titulo = String(valorCelula(row.getCell(coluna)) || "").trim();
    if (titulo) cabecalhos.push({ indice: coluna, titulo });
  }
  if (!cabecalhos.length) throw erro("A linha de cabeçalho selecionada está vazia.");
  return cabecalhos;
}

async function analisar(req, res) {
  try {
    const colunas = (await listarColunasControle()).filter(coluna => !colunaCalculada(coluna));
    const workbook = await carregarWorkbook(req);
    const sheetIndex = indiceValido(req.query.sheet);
    const headerRow = indiceValido(req.query.headerRow);
    const sheet = obterSheet(workbook, sheetIndex);
    const cabecalhos = lerCabecalhos(sheet, headerRow);
    const previa = [];
    for (let linha = headerRow + 1; linha <= sheet.rowCount && previa.length < 8; linha += 1) {
      const valores = cabecalhos.map(item => valorCelula(sheet.getRow(linha).getCell(item.indice)));
      if (valores.some(valor => String(valor).trim())) previa.push({ linha, valores });
    }
    res.json({
      abas: workbook.worksheets.map((item, index) => ({ indice: index + 1, nome: item.name })),
      aba: { indice: sheetIndex, nome: sheet.name },
      linhaCabecalho: headerRow,
      cabecalhos,
      previa,
      colunasDestino: colunas.map(({ campo, titulo, tipo }) => ({ campo, titulo, tipo }))
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.status ? error.message : "Erro ao analisar a planilha." });
  }
}

function parseConfig(valor) {
  try {
    return JSON.parse(Buffer.from(String(valor || ""), "base64url").toString("utf8"));
  } catch {
    throw erro("A configuração da importação é inválida.");
  }
}

function normalizarComparacao(valor, tipo) {
  const texto = String(valor ?? "").trim().toLocaleLowerCase("pt-BR");
  if (tipo === "numeros") return texto.replace(/\D/g, "");
  if (tipo === "normalizado") {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  }
  return texto;
}

function corresponde(valorPlanilha, valorControle, tipo) {
  const origem = normalizarComparacao(valorPlanilha, tipo);
  const destino = normalizarComparacao(valorControle, tipo);
  if (!origem || !destino) return false;
  return tipo === "contem" ? destino.includes(origem) : origem === destino;
}

function transformarImportado(valor, tipo) {
  if (tipo === "texto") return String(valor ?? "").trim();
  if (tipo === "maiusculo") return String(valor ?? "").trim().toLocaleUpperCase("pt-BR");
  if (tipo === "minusculo") return String(valor ?? "").trim().toLocaleLowerCase("pt-BR");
  if (tipo === "numero") {
    const texto = String(valor ?? "").trim();
    const numero = Number(texto.includes(",") ? texto.replace(/\./g, "").replace(",", ".") : texto);
    return Number.isFinite(numero) ? numero : valor;
  }
  if (tipo === "data") {
    const data = valor instanceof Date ? valor : new Date(valor);
    return Number.isNaN(data.getTime()) ? valor : data.toISOString().slice(0, 10);
  }
  return valor;
}

function prepararConfig(config, porCampo) {
  const mapeamentos = Array.isArray(config.mapeamentos) ? config.mapeamentos
    .map(item => ({
      origem: Number(item.origem),
      destino: String(item.destino || ""),
      transformacao: ["automatico", "texto", "maiusculo", "minusculo", "numero", "data"].includes(item.transformacao)
        ? item.transformacao : "automatico",
      regra: ["sempre", "se_vazio", "se_diferente", "nunca"].includes(item.regra) ? item.regra : "sempre"
    }))
    .filter(item => Number.isInteger(item.origem) && item.origem > 0 && porCampo.has(item.destino)) : [];
  if (!mapeamentos.length) throw erro("Mapeie ao menos uma coluna da planilha.");

  const modo = ["adicionar", "procurar_atualizar", "atualizar_ou_adicionar"].includes(config.modo)
    ? config.modo : "procurar_atualizar";
  const buscasInformadas = Array.isArray(config.buscas) ? config.buscas : [{
    origem: config.buscaOrigem,
    destino: config.buscaDestino,
    comparacao: "exato"
  }];
  const buscas = buscasInformadas.map(item => ({
    origem: Number(item.origem),
    destino: String(item.destino || ""),
    comparacao: ["exato", "normalizado", "numeros", "contem"].includes(item.comparacao) ? item.comparacao : "exato"
  })).filter(item => Number.isInteger(item.origem) && item.origem > 0 && porCampo.has(item.destino));
  if (modo !== "adicionar" && !buscas.length) throw erro("Configure ao menos uma chave de procura do PROCX.");
  const ambiguos = ["ignorar", "primeiro", "erro"].includes(config.ambiguos) ? config.ambiguos : "ignorar";
  return { ...config, modo, ambiguos, mapeamentos, buscas };
}

function localizarRegistro(registros, row, buscas) {
  return registros.filter(registro => buscas.every(busca =>
    corresponde(valorCelula(row.getCell(busca.origem)), registro[busca.destino], busca.comparacao)
  ));
}

function montarDados(row, config, registro, porCampo) {
  const dados = {};
  for (const mapa of config.mapeamentos) {
    if (mapa.regra === "nunca") continue;
    const original = valorCelula(row.getCell(mapa.origem));
    if (!config.sobrescreverVazios && String(original ?? "").trim() === "") continue;
    const valor = normalizarValor(porCampo.get(mapa.destino), transformarImportado(original, mapa.transformacao));
    const atual = registro?.[mapa.destino];
    const vazio = atual === undefined || atual === null || atual === "";
    if (mapa.regra === "se_vazio" && !vazio) continue;
    if (mapa.regra === "se_diferente" && String(atual ?? "") === String(valor ?? "")) continue;
    dados[mapa.destino] = valor;
  }
  return dados;
}

function separarDados(dados, porCampo) {
  const fisicos = {};
  const customizados = [];
  for (const [campo, valor] of Object.entries(dados)) {
    const coluna = porCampo.get(campo);
    if (!coluna || colunaCalculada(coluna)) continue;
    if (colunaFisica(coluna)) fisicos[campo] = valor;
    else customizados.push({ coluna, valor });
  }
  return { fisicos, customizados };
}

async function processar(req, res, simular = false) {
  let connection;
  try {
    const colunas = (await listarColunasControle()).filter(coluna => !colunaCalculada(coluna));
    const porCampo = new Map(colunas.map(coluna => [coluna.campo, coluna]));
    const config = prepararConfig(parseConfig(req.query.config), porCampo);
    const workbook = await carregarWorkbook(req);
    const sheet = obterSheet(workbook, indiceValido(config.sheet));
    const headerRow = indiceValido(config.headerRow);

    connection = await db.getConnection();
    if (!simular) await connection.beginTransaction();
    const [registros] = await connection.execute(`
      SELECT id, ${COLUNAS.map(coluna => coluna.campo).join(", ")}
      FROM controle_asbuilt WHERE regional = ?
    `, [req.usuario.regional]);
    await anexarValoresCustomizados(registros, colunas, connection);
    const resumo = {
      adicionados: 0, atualizados: 0, ignorados: 0, correspondencias: 0,
      semCorrespondencia: 0, ambiguos: 0, erros: [], exemplos: []
    };

    for (let linha = headerRow + 1; linha <= sheet.rowCount; linha += 1) {
      const row = sheet.getRow(linha);
      try {
        const encontrados = config.modo === "adicionar" ? [] : localizarRegistro(registros, row, config.buscas);
        const existente = encontrados[0];
        if (encontrados.length > 1) {
          resumo.ambiguos += 1;
          if (config.ambiguos === "erro") throw erro("Mais de um registro corresponde às chaves configuradas.");
          if (config.ambiguos === "ignorar") {
            resumo.ignorados += 1;
            continue;
          }
        }
        if (existente) resumo.correspondencias += 1; else if (config.modo !== "adicionar") resumo.semCorrespondencia += 1;
        const dados = montarDados(row, config, existente, porCampo);
        if (!Object.keys(dados).length) {
          resumo.ignorados += 1;
          continue;
        }

        if (existente) {
          const { fisicos, customizados } = separarDados(dados, porCampo);
          delete fisicos.projeto;
          const campos = Object.keys(fisicos);
          if (!campos.length && !customizados.length) {
            resumo.ignorados += 1;
            continue;
          }
          if (!simular) {
            if (campos.length) {
              await connection.execute(`
                UPDATE controle_asbuilt SET ${campos.map(campo => `${campo} = ?`).join(", ")}, atualizado_por = ?
                WHERE id = ? AND regional = ?
              `, [...campos.map(campo => fisicos[campo]), req.usuario.id, existente.id, req.usuario.regional]);
            } else {
              await connection.execute(`
                UPDATE controle_asbuilt SET atualizado_por = ?
                WHERE id = ? AND regional = ?
              `, [req.usuario.id, existente.id, req.usuario.regional]);
            }
            await salvarValoresCustomizados(connection, existente.id, customizados);
          }
          Object.assign(existente, dados);
          resumo.atualizados += 1;
        } else if (config.modo !== "procurar_atualizar") {
          if (!dados.projeto) throw erro("Projeto não informado para inclusão.");
          dados.data_asbuilt = dados.data_asbuilt || dataAtualControle();
          const { fisicos, customizados } = separarDados(dados, porCampo);
          const dataAsbuilt = fisicos.data_asbuilt || dataAtualControle();
          delete fisicos.data_asbuilt;
          const campos = Object.keys(fisicos);
          let novoId = `simulado-${linha}`;
          if (!simular) {
            const [result] = await connection.execute(`
              INSERT INTO controle_asbuilt
                (regional, ${campos.join(", ")}, data_asbuilt, criado_por, concluido_por, atualizado_por)
              VALUES (?, ${campos.map(() => "?").join(", ")}, ?, ?, ?, ?)
            `, [
              req.usuario.regional,
              ...campos.map(campo => fisicos[campo]),
              dataAsbuilt,
              req.usuario.id,
              req.usuario.id,
              req.usuario.id
            ]);
            novoId = result.insertId;
            await salvarValoresCustomizados(connection, novoId, customizados);
          }
          registros.push({ id: novoId, ...dados });
          resumo.adicionados += 1;
        } else {
          resumo.ignorados += 1;
        }
        if (resumo.exemplos.length < 12) {
          resumo.exemplos.push({
            linha,
            encontrado: Boolean(existente),
            registroId: existente?.id || null,
            projeto: existente?.projeto || dados.projeto || null,
            campos: Object.keys(dados)
          });
        }
      } catch (error) {
        resumo.erros.push(`Linha ${linha}: ${error.message}`);
        if (resumo.erros.length >= 30) break;
      }
    }

    if (!simular) await connection.commit();
    res.json({ message: simular ? "Simulação concluída sem alterar a base." : "Importação concluída.", resumo });
  } catch (error) {
    if (connection && !simular) await connection.rollback();
    res.status(error.status || 500).json({ error: error.status ? error.message : "Erro ao importar a planilha." });
  } finally {
    connection?.release();
  }
}

async function simular(req, res) {
  return processar(req, res, true);
}

async function executar(req, res) {
  return processar(req, res, false);
}

module.exports = { analisar, simular, executar };
