const fs = require("fs/promises");
const path = require("path");
const db = require("../models/db");
const { sanitizeText } = require("../utils/security");

const STORAGE_DIR = path.resolve(__dirname, "../../storage/asbuilt-pendentes");

const COLUNAS = [
  { campo: "projeto", titulo: "PROJETO", tipo: "texto", limite: 100, largura: 150, obrigatoria: true },
  { campo: "asbuilt", titulo: "ASBUILT", tipo: "texto", limite: 100, largura: 130 },
  { campo: "data_exe", titulo: "DATA EXE", tipo: "data", largura: 130 },
  { campo: "data_conclusao_projeto", titulo: "CONCLUSAO PROJETO", tipo: "data", largura: 165 },
  { campo: "cidade", titulo: "CIDADE", tipo: "texto", limite: 150, largura: 160 },
  { campo: "localizacao", titulo: "LOCALIZACAO", tipo: "texto", limite: 255, largura: 190 },
  { campo: "precisa_ir_campo", titulo: "IR A CAMPO?", tipo: "booleano", largura: 105 },
  { campo: "projetista", titulo: "PROJETISTA", tipo: "texto", limite: 150, largura: 170 },
  { campo: "data_asbuilt", titulo: "DATA ASBUILT", tipo: "data", largura: 145 },
  { campo: "sapid", titulo: "SAPID", tipo: "texto", limite: 100, largura: 125 },
  { campo: "status", titulo: "STATUS", tipo: "texto", limite: 100, largura: 140 },
  { campo: "status_sap", titulo: "STATUS SAP", tipo: "texto", limite: 100, largura: 145 },
  { campo: "versao", titulo: "V1/V2", tipo: "lista", limite: 30, largura: 90, opcoes: ["V1", "V2"] },
  { campo: "pep", titulo: "PEP", tipo: "texto", limite: 100, largura: 130 },
  { campo: "pi", titulo: "PI", tipo: "texto", limite: 100, largura: 120 },
  { campo: "segmento", titulo: "SEGMENTO", tipo: "texto", limite: 150, largura: 150 },
  { campo: "nome", titulo: "NOME", tipo: "texto", limite: 255, largura: 200 },
  { campo: "observacao", titulo: "OBS.", tipo: "texto", limite: 4000, largura: 240 },
  { campo: "oc", titulo: "OC", tipo: "texto", limite: 100, largura: 115 },
  { campo: "valor", titulo: "VALOR", tipo: "moeda", largura: 145 },
  { campo: "restricao", titulo: "RESTRICAO", tipo: "texto", limite: 4000, largura: 220 },
  { campo: "valor_adinatado", titulo: "VALOR ADINATADO", tipo: "moeda", largura: 175 },
  { campo: "este_mes", titulo: "ESTE MES", tipo: "moeda", largura: 145 },
  { campo: "responsavel", titulo: "RESP", tipo: "texto", limite: 150, largura: 150 },
  { campo: "ciclo", titulo: "CICLO", tipo: "texto", limite: 100, largura: 120 },
  { campo: "pep_n4", titulo: "PEP N4", tipo: "texto", limite: 100, largura: 130 },
  { campo: "prod", titulo: "PROD", tipo: "texto", limite: 100, largura: 120 },
  { campo: "marcador_x", titulo: "x", tipo: "texto", limite: 50, largura: 80 },
  { campo: "status_sgo", titulo: "STATUS SGO", tipo: "texto", limite: 255, largura: 190 }
].map((coluna, index) => ({
  ...coluna,
  sistema: true,
  ativa: true,
  ordem: (index + 1) * 10,
  opcoes: coluna.opcoes || []
}));

const COLUNAS_META = [
  { campo: "pdf_nome", titulo: "PDF", tipo: "pdf", largura: 130 },
  { campo: "criado_por_nome", titulo: "ADICIONADO POR", tipo: "meta", largura: 170 },
  { campo: "concluido_por_nome", titulo: "CONCLUIDO POR", tipo: "meta", largura: 170 }
];

const TIPOS_VALIDOS = new Set(["texto", "numero", "moeda", "data", "booleano", "lista"]);
const COLUNAS_SISTEMA = new Map(COLUNAS.map(coluna => [coluna.campo, coluna]));
const CAMPOS_META = new Map(COLUNAS_META.map(coluna => [coluna.campo, coluna]));
const CAMPOS_RESERVADOS = new Set([
  "id", "regional", "pdf_nome", "pdf_arquivo", "criado_por", "concluido_por",
  "atualizado_por", "criado_em", "atualizado_em", "criado_por_nome", "concluido_por_nome"
]);
const FORMATADOR_DATA_CONTROLE = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function dataAtualControle(agora = new Date()) {
  const partes = Object.fromEntries(
    FORMATADOR_DATA_CONTROLE.formatToParts(agora).map(parte => [parte.type, parte.value])
  );
  return `${partes.year}-${partes.month}-${partes.day}`;
}

function idValido(valor) {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function erroValidacao(mensagem) {
  const error = new Error(mensagem);
  error.status = 400;
  return error;
}

function inteiroLimitado(valor, padrao, minimo, maximo) {
  const numero = Number(valor);
  if (!Number.isInteger(numero)) return padrao;
  return Math.min(maximo, Math.max(minimo, numero));
}

function parseOpcoes(valor) {
  if (Array.isArray(valor)) {
    return [...new Set(valor.map(item => sanitizeText(item, 120)).filter(Boolean))].slice(0, 120);
  }
  if (!valor) return [];
  try {
    const parsed = JSON.parse(valor);
    if (Array.isArray(parsed)) return parseOpcoes(parsed);
  } catch {}
  return String(valor)
    .split(/\r?\n|;/)
    .map(item => sanitizeText(item, 120))
    .filter(Boolean)
    .slice(0, 120);
}

function normalizarColuna(linha) {
  const base = COLUNAS_SISTEMA.get(linha.campo) || {};
  const tipoBase = base.tipo || "texto";
  const tipo = TIPOS_VALIDOS.has(linha.tipo) ? linha.tipo : tipoBase;
  return {
    id: linha.id || null,
    campo: linha.campo,
    titulo: sanitizeText(linha.titulo || base.titulo || linha.campo, 120),
    tipo,
    limite: inteiroLimitado(linha.limite || base.limite || 255, base.limite || 255, 1, 4000),
    largura: inteiroLimitado(linha.largura || base.largura || 140, base.largura || 140, 70, 480),
    obrigatoria: Boolean(linha.obrigatoria ?? base.obrigatoria),
    opcoes: parseOpcoes(linha.opcoes_json ?? linha.opcoes ?? base.opcoes),
    valorPadrao: linha.valor_padrao ?? base.valorPadrao ?? null,
    sistema: Boolean(linha.sistema ?? base.sistema),
    ativa: linha.ativa !== 0 && linha.ativa !== false,
    ordem: Number.isInteger(Number(linha.ordem)) ? Number(linha.ordem) : base.ordem || 999
  };
}

async function listarColunasControle(opcoes = {}, executor = db) {
  const incluirInativas = Boolean(opcoes.incluirInativas);
  try {
    const [rows] = await executor.execute(`
      SELECT id, campo, titulo, tipo, limite, largura, obrigatoria, opcoes_json, valor_padrao,
        sistema, ativa, ordem, criado_em, atualizado_em
      FROM controle_asbuilt_colunas
      ORDER BY ordem, id
    `);
    const todas = rows.map(normalizarColuna);
    const colunas = incluirInativas ? todas : todas.filter(coluna => coluna.ativa);
    const existentes = new Set(todas.map(coluna => coluna.campo));
    for (const coluna of COLUNAS) {
      if (!existentes.has(coluna.campo) && (!incluirInativas || coluna.ativa)) {
        colunas.push(normalizarColuna(coluna));
      }
    }
    return colunas.sort((a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo));
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") return COLUNAS.map(normalizarColuna);
    throw error;
  }
}

async function mapaColunas(opcoes = {}, executor = db) {
  const colunas = await listarColunasControle(opcoes, executor);
  return {
    colunas,
    porCampo: new Map(colunas.map(coluna => [coluna.campo, coluna]))
  };
}

function colunaFisica(coluna) {
  return coluna?.sistema && COLUNAS_SISTEMA.has(coluna.campo);
}

function normalizarData(valor) {
  const data = String(valor ?? "").trim();
  if (!data) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw erroValidacao("Data invalida.");
  const objeto = new Date(`${data}T00:00:00Z`);
  if (Number.isNaN(objeto.getTime()) || objeto.toISOString().slice(0, 10) !== data) {
    throw erroValidacao("Data invalida.");
  }
  return data;
}

function normalizarMoeda(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === "") return null;
  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) throw erroValidacao("Valor monetario invalido.");
    return valor.toFixed(2);
  }
  let texto = String(valor).trim().replace(/\s/g, "").replace(/^R\$/i, "");
  if (texto.includes(",")) texto = texto.replace(/\./g, "").replace(",", ".");
  const numero = Number(texto);
  if (!Number.isFinite(numero) || Math.abs(numero) > 9999999999999.99) {
    throw erroValidacao("Valor monetario invalido.");
  }
  return numero.toFixed(2);
}

function normalizarNumero(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === "") return null;
  const texto = String(valor).trim().replace(/\s/g, "").replace(",", ".");
  const numero = Number(texto);
  if (!Number.isFinite(numero)) throw erroValidacao("Numero invalido.");
  return String(numero);
}

function normalizarBooleano(valor) {
  return valor === true || valor === 1 || valor === "1" || valor === "true" || valor === "Sim" || valor === "sim" ? 1 : 0;
}

function normalizarValor(coluna, valor, opcoes = {}) {
  if (!coluna) throw erroValidacao("Campo invalido.");
  if (coluna.tipo === "booleano") return normalizarBooleano(valor);
  const vazio = valor === null || valor === undefined || String(valor).trim() === "";
  if (vazio) {
    if (coluna.obrigatoria && opcoes.validarObrigatoria !== false) throw erroValidacao(`Informe ${coluna.titulo}.`);
    return null;
  }
  if (coluna.tipo === "data") return normalizarData(valor);
  if (coluna.tipo === "moeda") return normalizarMoeda(valor);
  if (coluna.tipo === "numero") return normalizarNumero(valor);
  const texto = sanitizeText(valor, coluna.limite || 255);
  if (coluna.tipo === "lista") {
    const encontrada = (coluna.opcoes || []).find(opcao =>
      opcao.toLocaleLowerCase("pt-BR") === texto.toLocaleLowerCase("pt-BR")
    );
    if (!encontrada) {
      const permitidos = (coluna.opcoes || []).slice(0, 8).join(", ");
      throw erroValidacao(`Valor nao permitido para ${coluna.titulo}.${permitidos ? ` Use: ${permitidos}.` : ""}`);
    }
    return encontrada;
  }
  return texto || null;
}

function valorCustomizado(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  return String(valor);
}

function dataSql(valor) {
  return valor ? new Date(valor).toISOString().slice(0, 10) : null;
}

function observacaoAutomatica(pendente, solicitacao) {
  const partes = [];
  if (pendente?.observacao) partes.push(pendente.observacao);
  if (pendente?.cidade) partes.push(`Cidade: ${pendente.cidade}`);
  if (pendente?.localizacao) partes.push(`Localizacao: ${pendente.localizacao}`);
  if (pendente?.precisa_ir_campo) partes.push("Necessita ida a campo.");
  if (solicitacao?.observacao) partes.push(`Solicitacao de materiais: ${solicitacao.observacao}`);
  return partes.join(" | ") || null;
}

async function anexarValoresCustomizados(registros, colunas, executor = db) {
  const ids = registros.map(registro => Number(registro.id)).filter(Boolean);
  const customizadas = colunas.filter(coluna => !colunaFisica(coluna));
  if (!ids.length || !customizadas.length) return registros;

  const idPlaceholders = ids.map(() => "?").join(", ");
  const campos = customizadas.map(coluna => coluna.campo);
  const campoPlaceholders = campos.map(() => "?").join(", ");
  const [valores] = await executor.execute(`
    SELECT v.registro_id, c.campo, v.valor_texto
    FROM controle_asbuilt_valores v
    INNER JOIN controle_asbuilt_colunas c ON c.id = v.coluna_id
    WHERE v.registro_id IN (${idPlaceholders})
      AND c.campo IN (${campoPlaceholders})
  `, [...ids, ...campos]);

  const porId = new Map(registros.map(registro => [Number(registro.id), registro]));
  for (const item of valores) {
    const registro = porId.get(Number(item.registro_id));
    if (registro) registro[item.campo] = item.valor_texto;
  }
  return registros;
}

async function salvarValorCustomizado(executor, registroId, coluna, valor) {
  if (!coluna?.id) throw erroValidacao("Coluna personalizada sem cadastro.");
  const texto = valorCustomizado(valor);
  if (texto === null) {
    await executor.execute(
      "DELETE FROM controle_asbuilt_valores WHERE registro_id = ? AND coluna_id = ?",
      [registroId, coluna.id]
    );
    return;
  }
  await executor.execute(`
    INSERT INTO controle_asbuilt_valores (registro_id, coluna_id, valor_texto)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE valor_texto = VALUES(valor_texto), atualizado_em = CURRENT_TIMESTAMP
  `, [registroId, coluna.id, texto]);
}

async function salvarValoresCustomizados(executor, registroId, pares) {
  for (const { coluna, valor } of pares) {
    await salvarValorCustomizado(executor, registroId, coluna, valor);
  }
}

async function buscarRegistro(id, regional, executor = db) {
  const colunas = await listarColunasControle({}, executor);
  const [rows] = await executor.execute(`
    SELECT a.id, a.regional, ${COLUNAS.map(coluna => `a.${coluna.campo}`).join(", ")},
      a.pdf_nome, a.pdf_arquivo, a.criado_por, a.concluido_por, a.atualizado_por,
      a.criado_em, a.atualizado_em, criador.nome AS criado_por_nome,
      concluidor.nome AS concluido_por_nome
    FROM controle_asbuilt a
    LEFT JOIN usuarios criador ON criador.id = a.criado_por
    LEFT JOIN usuarios concluidor ON concluidor.id = a.concluido_por
    WHERE a.id = ? AND a.regional = ?
    LIMIT 1
  `, [id, regional]);
  if (!rows[0]) return null;
  await anexarValoresCustomizados(rows, colunas, executor);
  return rows[0];
}

function parseFiltros(valor) {
  if (!valor) return {};
  try {
    const filtros = JSON.parse(String(valor));
    return filtros && typeof filtros === "object" && !Array.isArray(filtros) ? filtros : {};
  } catch {
    return {};
  }
}

function like(valor) {
  return `%${String(valor).replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
}

function filtroSqlParaCampo(coluna, valor, params) {
  if (colunaFisica(coluna)) {
    params.push(like(valor));
    return `CAST(a.${coluna.campo} AS CHAR) LIKE ? ESCAPE '\\\\'`;
  }
  if (coluna?.campo === "pdf_nome") {
    params.push(like(valor));
    return "a.pdf_nome LIKE ? ESCAPE '\\\\'";
  }
  if (coluna?.campo === "criado_por_nome") {
    params.push(like(valor));
    return "criador.nome LIKE ? ESCAPE '\\\\'";
  }
  if (coluna?.campo === "concluido_por_nome") {
    params.push(like(valor));
    return "concluidor.nome LIKE ? ESCAPE '\\\\'";
  }
  params.push(coluna.campo, like(valor));
  return `EXISTS (
    SELECT 1 FROM controle_asbuilt_valores vf
    INNER JOIN controle_asbuilt_colunas cf ON cf.id = vf.coluna_id
    WHERE vf.registro_id = a.id AND cf.campo = ? AND vf.valor_texto LIKE ? ESCAPE '\\\\'
  )`;
}

function montarWhere(req, colunas) {
  const params = [req.usuario.regional];
  const where = ["a.regional = ?"];
  const busca = sanitizeText(req.query.busca, 120);
  const todas = [...colunas, ...COLUNAS_META];
  const porCampo = new Map(todas.map(coluna => [coluna.campo, coluna]));

  if (busca) {
    const termos = [];
    for (const coluna of todas) {
      termos.push(filtroSqlParaCampo(coluna, busca, params));
    }
    where.push(`(${termos.join(" OR ")})`);
  }

  for (const [campo, valorOriginal] of Object.entries(parseFiltros(req.query.filtros)).slice(0, 40)) {
    const valor = sanitizeText(valorOriginal, 120);
    const coluna = porCampo.get(campo);
    if (!valor || !coluna) continue;
    where.push(filtroSqlParaCampo(coluna, valor, params));
  }

  return { where: where.join(" AND "), params };
}

async function listar(req, res) {
  const pagina = inteiroLimitado(req.query.pagina, 1, 1, 100000);
  const limite = inteiroLimitado(req.query.limite, 150, 50, 500);
  const offset = (pagina - 1) * limite;
  const colunas = await listarColunasControle();
  const { where, params } = montarWhere(req, colunas);

  const [[totalRow], [registros]] = await Promise.all([
    db.execute(`
      SELECT COUNT(*) AS total
      FROM controle_asbuilt a
      LEFT JOIN usuarios criador ON criador.id = a.criado_por
      LEFT JOIN usuarios concluidor ON concluidor.id = a.concluido_por
      WHERE ${where}
    `, params),
    db.execute(`
      SELECT a.id, a.regional, ${COLUNAS.map(coluna => `a.${coluna.campo}`).join(", ")},
        a.pdf_nome, a.pdf_arquivo, a.criado_por, a.concluido_por, a.atualizado_por,
        a.criado_em, a.atualizado_em, criador.nome AS criado_por_nome,
        concluidor.nome AS concluido_por_nome
      FROM controle_asbuilt a
      LEFT JOIN usuarios criador ON criador.id = a.criado_por
      LEFT JOIN usuarios concluidor ON concluidor.id = a.concluido_por
      WHERE ${where}
      ORDER BY a.criado_em DESC, a.id DESC
      LIMIT ${limite} OFFSET ${offset}
    `, params)
  ]);

  await anexarValoresCustomizados(registros, colunas);
  const total = Number(totalRow[0]?.total || 0);
  res.json({
    colunas,
    colunasMeta: COLUNAS_META,
    registros,
    paginacao: {
      pagina,
      limite,
      total,
      totalPaginas: Math.max(1, Math.ceil(total / limite))
    }
  });
}

async function criar(req, res) {
  const informados = req.body?.dados && typeof req.body.dados === "object" ? req.body.dados : {};
  const projeto = sanitizeText(informados.projeto, 100);
  if (!projeto) return res.status(400).json({ error: "Informe o projeto." });

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { colunas, porCampo } = await mapaColunas({}, connection);
    const [pendentes] = await connection.execute(`
      SELECT * FROM asbuilt_pendentes
      WHERE regional = ? AND LOWER(projeto) = LOWER(?) LIMIT 1 FOR UPDATE
    `, [req.usuario.regional, projeto]);
    const [solicitacoes] = await connection.execute(`
      SELECT projeto, cidade, equipe, data_exe, observacao, tipo_servico
      FROM materiais_solicitados
      WHERE regional = ? AND LOWER(projeto) = LOWER(?)
      ORDER BY data_exe DESC, id DESC LIMIT 1
    `, [req.usuario.regional, projeto]);
    const pendente = pendentes[0];
    const solicitacao = solicitacoes[0];

    const dadosAutomaticos = {
      projeto,
      data_exe: dataSql(solicitacao?.data_exe || pendente?.data_conclusao),
      data_conclusao_projeto: dataSql(pendente?.data_conclusao),
      cidade: pendente?.cidade || solicitacao?.cidade || null,
      localizacao: pendente?.localizacao || null,
      precisa_ir_campo: pendente?.precisa_ir_campo || 0,
      nome: pendente?.localizacao || pendente?.cidade || solicitacao?.cidade || null,
      responsavel: solicitacao?.equipe || null,
      segmento: solicitacao?.tipo_servico || null,
      observacao: observacaoAutomatica(pendente, solicitacao),
      status: pendente ? "Aguardando As-Built" : null
    };
    const dados = { ...dadosAutomaticos, ...informados, projeto };
    for (const coluna of colunas) {
      const vazio = dados[coluna.campo] === null || dados[coluna.campo] === undefined || String(dados[coluna.campo]).trim() === "";
      if (vazio && coluna.valorPadrao !== null && coluna.valorPadrao !== undefined && String(coluna.valorPadrao) !== "") {
        dados[coluna.campo] = coluna.valorPadrao;
      }
    }
    const campos = [];
    const valores = [];
    const customizados = [];
    for (const [campo, valorOriginal] of Object.entries(dados)) {
      const coluna = porCampo.get(campo);
      if (!coluna) continue;
      const valor = normalizarValor(coluna, valorOriginal, { validarObrigatoria: false });
      if (colunaFisica(coluna)) {
        campos.push(coluna.campo);
        valores.push(valor);
      } else {
        customizados.push({ coluna, valor });
      }
    }
    if (pendente?.pdf_nome) {
      campos.push("pdf_nome", "pdf_arquivo");
      valores.push(pendente.pdf_nome, pendente.pdf_arquivo);
    }
    const dataAsbuilt = dataAtualControle();
    const indiceDataAsbuilt = campos.indexOf("data_asbuilt");
    if (indiceDataAsbuilt >= 0) {
      valores[indiceDataAsbuilt] = dataAsbuilt;
    } else {
      campos.push("data_asbuilt");
      valores.push(dataAsbuilt);
    }

    const nomes = ["regional", ...campos, "criado_por", "concluido_por", "atualizado_por"];
    const parametros = [req.usuario.regional, ...valores, req.usuario.id, req.usuario.id, req.usuario.id];
    const [result] = await connection.execute(`
      INSERT INTO controle_asbuilt (${nomes.join(", ")})
      VALUES (${nomes.map(() => "?").join(", ")})
    `, parametros);
    await salvarValoresCustomizados(connection, result.insertId, customizados);

    if (pendente) {
      await connection.execute("DELETE FROM asbuilt_pendentes WHERE id = ? AND regional = ?", [
        pendente.id,
        req.usuario.regional
      ]);
    }
    const registro = await buscarRegistro(result.insertId, req.usuario.regional, connection);
    await connection.commit();
    res.status(201).json({
      message: pendente ? "Projeto transferido das pendencias e preenchido automaticamente." : "Projeto criado e preenchido automaticamente.",
      transferidoDaPendencia: Boolean(pendente),
      registro
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function atualizar(req, res) {
  const id = idValido(req.params.id);
  const { porCampo } = await mapaColunas();
  const coluna = porCampo.get(String(req.body?.campo || ""));
  if (!id || !coluna) return res.status(400).json({ error: "Campo ou registro invalido." });
  const valor = normalizarValor(coluna, req.body.valor);

  if (colunaFisica(coluna)) {
    const concluir = coluna.campo === "data_asbuilt" && valor;
    const [result] = await db.execute(`
      UPDATE controle_asbuilt
      SET ${coluna.campo} = ?, atualizado_por = ?
        ${concluir ? ", concluido_por = COALESCE(concluido_por, ?)" : ""}
      WHERE id = ? AND regional = ?
    `, concluir
      ? [valor, req.usuario.id, req.usuario.id, id, req.usuario.regional]
      : [valor, req.usuario.id, id, req.usuario.regional]);
    if (!result.affectedRows) return res.status(404).json({ error: "Registro nao encontrado nesta regional." });
  } else {
    const [registros] = await db.execute("SELECT id FROM controle_asbuilt WHERE id = ? AND regional = ? LIMIT 1", [
      id,
      req.usuario.regional
    ]);
    if (!registros[0]) return res.status(404).json({ error: "Registro nao encontrado nesta regional." });
    await salvarValorCustomizado(db, id, coluna, valor);
    await db.execute("UPDATE controle_asbuilt SET atualizado_por = ? WHERE id = ? AND regional = ?", [
      req.usuario.id,
      id,
      req.usuario.regional
    ]);
  }
  res.json({ message: "Alteracao salva.", campo: coluna.campo, valor });
}

async function atualizarDados(req, res) {
  const id = idValido(req.params.id);
  const dados = req.body?.dados && typeof req.body.dados === "object" ? req.body.dados : {};
  const camposPermitidos = Array.isArray(req.body?.campos)
    ? new Set(req.body.campos.map(campo => String(campo)))
    : null;
  const { porCampo } = await mapaColunas();
  const atualizacoes = [];
  const parametros = [];
  const customizados = [];

  for (const [campo, valorOriginal] of Object.entries(dados)) {
    if (camposPermitidos && !camposPermitidos.has(campo)) continue;
    const coluna = porCampo.get(campo);
    if (!coluna || campo === "projeto") continue;
    const valor = normalizarValor(coluna, valorOriginal);
    if (colunaFisica(coluna)) {
      atualizacoes.push(`${campo} = ?`);
      parametros.push(valor);
    } else {
      customizados.push({ coluna, valor });
    }
  }
  if (!id || (!atualizacoes.length && !customizados.length)) {
    return res.status(400).json({ error: "Nenhum dado valido para atualizar." });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    if (atualizacoes.length) {
      atualizacoes.push("atualizado_por = ?");
      parametros.push(req.usuario.id, id, req.usuario.regional);
      const [result] = await connection.execute(`
        UPDATE controle_asbuilt SET ${atualizacoes.join(", ")}
        WHERE id = ? AND regional = ?
      `, parametros);
      if (!result.affectedRows) throw erroValidacao("Registro nao encontrado nesta regional.");
    } else {
      const [registros] = await connection.execute("SELECT id FROM controle_asbuilt WHERE id = ? AND regional = ? LIMIT 1", [
        id,
        req.usuario.regional
      ]);
      if (!registros[0]) throw erroValidacao("Registro nao encontrado nesta regional.");
      await connection.execute("UPDATE controle_asbuilt SET atualizado_por = ? WHERE id = ? AND regional = ?", [
        req.usuario.id,
        id,
        req.usuario.regional
      ]);
    }
    await salvarValoresCustomizados(connection, id, customizados);
    const registro = await buscarRegistro(id, req.usuario.regional, connection);
    await connection.commit();
    res.json({ message: "Dados atualizados.", registro });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function atualizarColunas(req, res) {
  const ids = Array.isArray(req.body?.ids)
    ? [...new Set(req.body.ids.map(idValido).filter(Boolean))].slice(0, 500)
    : [];
  const dados = req.body?.dados && typeof req.body.dados === "object" ? req.body.dados : {};
  if (!ids.length) return res.status(400).json({ error: "Selecione ao menos um registro." });

  const { porCampo } = await mapaColunas();
  const atualizacoes = [];
  const parametros = [];
  const customizados = [];
  for (const [campo, valorOriginal] of Object.entries(dados).slice(0, 30)) {
    const coluna = porCampo.get(campo);
    if (!coluna || campo === "projeto") continue;
    const valor = normalizarValor(coluna, valorOriginal);
    if (colunaFisica(coluna)) {
      atualizacoes.push(`${campo} = ?`);
      parametros.push(valor);
    } else {
      customizados.push({ coluna, valor });
    }
  }
  if (!atualizacoes.length && !customizados.length) {
    return res.status(400).json({ error: "Nenhuma coluna valida para atualizar." });
  }

  const placeholders = ids.map(() => "?").join(", ");
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [registros] = await connection.execute(
      `SELECT id FROM controle_asbuilt WHERE regional = ? AND id IN (${placeholders})`,
      [req.usuario.regional, ...ids]
    );
    const idsValidos = registros.map(item => Number(item.id));
    if (!idsValidos.length) throw erroValidacao("Nenhum registro encontrado nesta regional.");

    const validosPlaceholders = idsValidos.map(() => "?").join(", ");
    if (atualizacoes.length) {
      await connection.execute(`
        UPDATE controle_asbuilt
        SET ${atualizacoes.join(", ")}, atualizado_por = ?
        WHERE regional = ? AND id IN (${validosPlaceholders})
      `, [...parametros, req.usuario.id, req.usuario.regional, ...idsValidos]);
    } else {
      await connection.execute(`
        UPDATE controle_asbuilt SET atualizado_por = ?
        WHERE regional = ? AND id IN (${validosPlaceholders})
      `, [req.usuario.id, req.usuario.regional, ...idsValidos]);
    }
    for (const id of idsValidos) {
      await salvarValoresCustomizados(connection, id, customizados);
    }
    await connection.commit();
    res.json({ message: `${idsValidos.length} registro(s) atualizado(s).`, atualizados: idsValidos.length });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function campoValido(valor) {
  return /^[a-z][a-z0-9_]{1,59}$/.test(valor);
}

function slugCampo(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .slice(0, 55);
}

function normalizarDefinicaoColuna(body, existente = null) {
  const titulo = sanitizeText(body?.titulo || existente?.titulo, 120);
  const campo = existente?.campo || slugCampo(body?.campo || titulo);
  if (!titulo || !campoValido(campo) || CAMPOS_RESERVADOS.has(campo) || CAMPOS_META.has(campo)) {
    throw erroValidacao("Nome ou chave da coluna invalido.");
  }
  const base = COLUNAS_SISTEMA.get(campo);
  const sistema = Boolean(existente?.sistema || base);
  const tipoInformado = TIPOS_VALIDOS.has(body?.tipo) ? body.tipo : existente?.tipo || base?.tipo || "texto";
  const tipo = sistema && !["texto", "lista"].includes(base?.tipo) ? base.tipo : tipoInformado;
  const opcoes = parseOpcoes(body?.opcoes ?? body?.opcoes_json ?? existente?.opcoes);
  if (tipo === "lista" && !opcoes.length) throw erroValidacao("Colunas do tipo lista precisam de opcoes.");
  const definicao = {
    campo,
    titulo,
    tipo,
    limite: inteiroLimitado(body?.limite, existente?.limite || base?.limite || 255, 1, 4000),
    largura: inteiroLimitado(body?.largura, existente?.largura || base?.largura || 140, 70, 480),
    obrigatoria: body?.obrigatoria === undefined
      ? Boolean(existente?.obrigatoria)
      : body?.obrigatoria === true || body?.obrigatoria === 1 || body?.obrigatoria === "1",
    opcoes,
    valorPadrao: body?.valorPadrao === undefined
      ? existente?.valorPadrao ?? null
      : sanitizeText(body.valorPadrao, 4000) || null,
    ativa: body?.ativa === undefined ? true : !(body.ativa === false || body.ativa === 0 || body.ativa === "0"),
    sistema
  };
  if (definicao.valorPadrao !== null) {
    definicao.valorPadrao = normalizarValor({ ...definicao, obrigatoria: false }, definicao.valorPadrao, {
      validarObrigatoria: false
    });
  }
  return definicao;
}

async function listarColunas(req, res) {
  res.json({ colunas: await listarColunasControle({ incluirInativas: true }) });
}

async function criarColuna(req, res) {
  const definicao = normalizarDefinicaoColuna(req.body);
  if (COLUNAS_SISTEMA.has(definicao.campo)) {
    return res.status(409).json({ error: "Ja existe uma coluna padrao com essa chave." });
  }
  const [[maxOrdem]] = await db.execute("SELECT COALESCE(MAX(ordem), 0) AS ordem FROM controle_asbuilt_colunas");
  try {
    await db.execute(`
      INSERT INTO controle_asbuilt_colunas
        (campo, titulo, tipo, limite, largura, obrigatoria, opcoes_json, valor_padrao, sistema, ativa, ordem, criado_por, atualizado_por)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE titulo = VALUES(titulo), tipo = VALUES(tipo), limite = VALUES(limite),
        largura = VALUES(largura), obrigatoria = VALUES(obrigatoria), opcoes_json = VALUES(opcoes_json),
        valor_padrao = VALUES(valor_padrao), ativa = 1, atualizado_por = VALUES(atualizado_por)
    `, [
      definicao.campo,
      definicao.titulo,
      definicao.tipo,
      definicao.limite,
      definicao.largura,
      definicao.obrigatoria ? 1 : 0,
      JSON.stringify(definicao.opcoes),
      definicao.valorPadrao,
      definicao.ativa ? 1 : 0,
      Number(maxOrdem?.ordem || 0) + 10,
      req.usuario.id,
      req.usuario.id
    ]);
    res.status(201).json({ message: "Coluna criada.", colunas: await listarColunasControle({ incluirInativas: true }) });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Ja existe uma coluna com essa chave." });
    throw error;
  }
}

async function atualizarColuna(req, res) {
  const campo = String(req.params.campo || "");
  const { porCampo } = await mapaColunas({ incluirInativas: true });
  const existente = porCampo.get(campo);
  if (!existente) return res.status(404).json({ error: "Coluna nao encontrada." });
  const definicao = normalizarDefinicaoColuna(req.body, existente);
  await db.execute(`
    UPDATE controle_asbuilt_colunas
    SET titulo = ?, tipo = ?, limite = ?, largura = ?, obrigatoria = ?,
      opcoes_json = ?, valor_padrao = ?, ativa = ?, atualizado_por = ?
    WHERE campo = ?
  `, [
    definicao.titulo,
    definicao.tipo,
    definicao.limite,
    definicao.largura,
    definicao.obrigatoria ? 1 : 0,
    JSON.stringify(definicao.opcoes),
    definicao.valorPadrao,
    definicao.ativa ? 1 : 0,
    req.usuario.id,
    campo
  ]);
  res.json({ message: "Coluna atualizada.", colunas: await listarColunasControle({ incluirInativas: true }) });
}

async function excluirColuna(req, res) {
  const campo = String(req.params.campo || "");
  const { porCampo } = await mapaColunas({ incluirInativas: true });
  const coluna = porCampo.get(campo);
  if (!coluna || campo === "projeto") return res.status(400).json({ error: "Coluna invalida." });
  if (coluna.sistema) {
    await db.execute("UPDATE controle_asbuilt_colunas SET ativa = 0, atualizado_por = ? WHERE campo = ?", [
      req.usuario.id,
      campo
    ]);
    return res.json({ message: "Coluna padrao ocultada." });
  }
  await db.execute("DELETE FROM controle_asbuilt_colunas WHERE campo = ?", [campo]);
  res.json({ message: "Coluna excluida." });
}

async function sugestoesFiltro(req, res) {
  const campo = String(req.params.campo || "");
  const busca = sanitizeText(req.query.busca, 120);
  const limite = inteiroLimitado(req.query.limite, 20, 5, 50);
  const { porCampo } = await mapaColunas();
  const coluna = porCampo.get(campo) || CAMPOS_META.get(campo);
  if (!coluna) return res.status(404).json({ error: "Coluna nao encontrada." });
  if (coluna.tipo === "lista" && coluna.opcoes?.length) {
    const termo = busca.toLocaleLowerCase("pt-BR");
    return res.json({
      sugestoes: coluna.opcoes.filter(item => !termo || item.toLocaleLowerCase("pt-BR").includes(termo)).slice(0, limite)
    });
  }
  if (coluna.tipo === "booleano") return res.json({ sugestoes: ["Sim", "Nao"] });

  let sql;
  const params = [req.usuario.regional];
  if (colunaFisica(coluna)) {
    sql = `SELECT DISTINCT CAST(a.${campo} AS CHAR) AS valor FROM controle_asbuilt a WHERE a.regional = ? AND a.${campo} IS NOT NULL`;
  } else if (campo === "pdf_nome") {
    sql = "SELECT DISTINCT a.pdf_nome AS valor FROM controle_asbuilt a WHERE a.regional = ? AND a.pdf_nome IS NOT NULL";
  } else if (campo === "criado_por_nome" || campo === "concluido_por_nome") {
    const vinculo = campo === "criado_por_nome" ? "criado_por" : "concluido_por";
    sql = `SELECT DISTINCT u.nome AS valor FROM controle_asbuilt a INNER JOIN usuarios u ON u.id = a.${vinculo} WHERE a.regional = ?`;
  } else {
    sql = `
      SELECT DISTINCT v.valor_texto AS valor
      FROM controle_asbuilt_valores v
      INNER JOIN controle_asbuilt a ON a.id = v.registro_id
      INNER JOIN controle_asbuilt_colunas c ON c.id = v.coluna_id
      WHERE a.regional = ? AND c.campo = ? AND v.valor_texto IS NOT NULL
    `;
    params.push(campo);
  }
  sql = `SELECT DISTINCT valor FROM (${sql}) sugestoes WHERE TRIM(valor) <> ''`;
  if (busca) {
    sql += " AND valor LIKE ? ESCAPE '\\\\'";
    params.push(like(busca));
  }
  sql += ` ORDER BY valor LIMIT ${limite}`;
  const [rows] = await db.execute(sql, params);
  res.json({ sugestoes: rows.map(item => item.valor).filter(valor => String(valor ?? "").trim()) });
}

async function excluir(req, res) {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ error: "Registro invalido." });
  const [rows] = await db.execute(
    "SELECT pdf_arquivo FROM controle_asbuilt WHERE id = ? AND regional = ? LIMIT 1",
    [id, req.usuario.regional]
  );
  const [result] = await db.execute(
    "DELETE FROM controle_asbuilt WHERE id = ? AND regional = ?",
    [id, req.usuario.regional]
  );
  if (!result.affectedRows) return res.status(404).json({ error: "Registro nao encontrado nesta regional." });
  if (rows[0]?.pdf_arquivo) await fs.unlink(path.join(STORAGE_DIR, rows[0].pdf_arquivo)).catch(() => {});
  res.json({ message: "Linha excluida." });
}

async function baixarPdf(req, res) {
  const id = idValido(req.params.id);
  const [rows] = await db.execute(`
    SELECT pdf_nome, pdf_arquivo FROM controle_asbuilt
    WHERE id = ? AND regional = ? LIMIT 1
  `, [id, req.usuario.regional]);
  const registro = rows[0];
  if (!registro?.pdf_arquivo) return res.status(404).json({ error: "Este projeto nao possui PDF." });
  res.download(path.join(STORAGE_DIR, registro.pdf_arquivo), registro.pdf_nome || "projeto.pdf");
}

module.exports = {
  COLUNAS,
  COLUNAS_META,
  normalizarValor,
  dataAtualControle,
  listarColunasControle,
  anexarValoresCustomizados,
  colunaFisica,
  salvarValoresCustomizados,
  buscarRegistro,
  listar,
  criar,
  atualizar,
  atualizarDados,
  atualizarColunas,
  listarColunas,
  criarColuna,
  atualizarColuna,
  excluirColuna,
  sugestoesFiltro,
  excluir,
  baixarPdf
};
