const ExcelJS = require("exceljs");
const db = require("../../models/db");
const { sanitizeText } = require("../../utils/security");

function numeroValido(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === "") return null;
  const numero = Number(String(valor).replace(",", "."));
  return Number.isFinite(numero) && numero >= 0 && numero <= 999999999999 ? numero : null;
}

function normalizarCabecalho(valor) {
  return String(valor ?? "").trim().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

async function registrarMovimento(connection, dados) {
  if (!dados.diferenca) return;
  const tipo = dados.diferenca > 0 ? "entrada" : "saida";
  await connection.execute(`
    INSERT INTO movimentacoes_estoque
      (regional, estoque_id, codigo, descricao, tipo, quantidade, saldo_anterior,
       saldo_posterior, origem, referencia_id, usuario_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    dados.regional,
    dados.estoqueId,
    dados.codigo,
    dados.descricao,
    tipo,
    Math.abs(dados.diferenca),
    dados.anterior,
    dados.posterior,
    dados.origem,
    dados.referenciaId || null,
    dados.usuarioId
  ]);
}

async function listar(req, res) {
  const [rows] = await db.execute(`
    SELECT id, codigo, descricao, quantidade, unidade, criado_em, atualizado_em
    FROM estoque_fisico WHERE regional = ? ORDER BY descricao, codigo
  `, [req.usuario.regional]);
  res.json(rows);
}

async function salvar(req, res) {
  const itens = Array.isArray(req.body?.itens) ? req.body.itens : [];
  const deletados = Array.isArray(req.body?.deletados) ? req.body.deletados : [];
  if (itens.length > 5000 || deletados.length > 5000) {
    return res.status(400).json({ error: "Quantidade de itens inválida." });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    for (const idOriginal of deletados) {
      const id = Number(idOriginal);
      if (!Number.isInteger(id) || id <= 0) continue;
      await connection.execute("DELETE FROM estoque_fisico WHERE id = ? AND regional = ?", [id, req.usuario.regional]);
    }

    for (const item of itens) {
      const codigo = sanitizeText(item.codigo, 100).toUpperCase();
      const descricao = sanitizeText(item.descricao, 255);
      const unidade = sanitizeText(item.unidade || item.tipo_medida, 50).toUpperCase() || "UNIDADE";
      const quantidade = numeroValido(item.quantidade);
      if (!codigo || !descricao || quantidade === null) {
        const error = new Error("Há materiais de estoque com dados inválidos.");
        error.status = 400;
        throw error;
      }

      const id = Number(item.id);
      const idInformado = Number.isInteger(id) && id > 0;
      const [existentes] = await connection.execute(
        idInformado
          ? "SELECT id, quantidade FROM estoque_fisico WHERE regional = ? AND id = ? LIMIT 1 FOR UPDATE"
          : "SELECT id, quantidade FROM estoque_fisico WHERE regional = ? AND codigo = ? LIMIT 1 FOR UPDATE",
        [req.usuario.regional, idInformado ? id : codigo]
      );
      const existente = existentes[0];
      if (existente) {
        await connection.execute(`
          UPDATE estoque_fisico SET codigo = ?, descricao = ?, quantidade = ?, unidade = ?, atualizado_por = ?
          WHERE id = ?
        `, [codigo, descricao, quantidade, unidade, req.usuario.id, existente.id]);
        await registrarMovimento(connection, {
          regional: req.usuario.regional,
          estoqueId: existente.id,
          codigo,
          descricao,
          anterior: Number(existente.quantidade),
          posterior: quantidade,
          diferenca: quantidade - Number(existente.quantidade),
          origem: "ajuste_manual",
          usuarioId: req.usuario.id
        });
      } else {
        const [result] = await connection.execute(`
          INSERT INTO estoque_fisico (regional, codigo, descricao, quantidade, unidade, atualizado_por)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [req.usuario.regional, codigo, descricao, quantidade, unidade, req.usuario.id]);
        await registrarMovimento(connection, {
          regional: req.usuario.regional,
          estoqueId: result.insertId,
          codigo,
          descricao,
          anterior: 0,
          posterior: quantidade,
          diferenca: quantidade,
          origem: "cadastro_estoque",
          usuarioId: req.usuario.id
        });
      }
    }
    await connection.commit();
    res.json({ message: "Estoque físico atualizado." });
  } catch (error) {
    await connection.rollback();
    res.status(error.status || 500).json({ error: error.status ? error.message : "Erro ao salvar estoque." });
  } finally {
    connection.release();
  }
}

async function importar(req, res) {
  const arquivo = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  if (!arquivo.length || arquivo.length > 15 * 1024 * 1024) {
    return res.status(400).json({ error: "Envie uma planilha válida de até 15 MB." });
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(arquivo);
  } catch {
    return res.status(400).json({ error: "Não foi possível ler a planilha XLSX." });
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) return res.status(400).json({ error: "A planilha não possui abas." });

  const cabecalhos = new Map();
  sheet.getRow(1).eachCell((cell, coluna) => cabecalhos.set(normalizarCabecalho(cell.value), coluna));
  const coluna = nomes => nomes.map(nome => cabecalhos.get(nome)).find(Boolean);
  const colCodigo = coluna(["codigo", "codigomaterial", "cod"]);
  const colDescricao = coluna(["descricao", "material", "descricaomaterial"]);
  const colQuantidade = coluna(["quantidade", "qtd", "saldo"]);
  const colUnidade = coluna(["tipodemedida", "unidade", "medida"]);
  if (!colCodigo || !colDescricao || !colQuantidade) {
    return res.status(400).json({ error: "Use as colunas Código, Descrição, Quantidade e Tipo de medida." });
  }

  const itens = [];
  sheet.eachRow((row, numeroLinha) => {
    if (numeroLinha === 1) return;
    const codigo = row.getCell(colCodigo).text;
    const descricao = row.getCell(colDescricao).text;
    const quantidade = row.getCell(colQuantidade).value;
    const unidade = colUnidade ? row.getCell(colUnidade).text : "UNIDADE";
    if (String(codigo).trim() || String(descricao).trim()) itens.push({ codigo, descricao, quantidade, unidade });
  });
  req.body = { itens, deletados: [] };
  return salvar(req, res);
}

module.exports = { listar, salvar, importar, registrarMovimento };
