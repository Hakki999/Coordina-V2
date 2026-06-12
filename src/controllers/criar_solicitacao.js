const db = require("../models/db");
const { sanitizeText } = require("../utils/security");

const TENSOES = new Set(["13.8", "34.5"]);
const TIPOS = new Set(["Emergência", "Manutenção", "Obras", "Reposição", "Leve"]);

function quantidadeNumerica(valor) {
  const match = String(valor ?? "").trim().replace(",", ".").match(/^(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function normalizarUp(valor) {
  return sanitizeText(valor, 100).toUpperCase();
}

async function criarSolicitacao(req) {
  const formulario = req.body.formulario || {};
  const ups = Array.isArray(req.body.upsSelecionadas) ? req.body.upsSelecionadas : [];
  const regional = req.usuario.regional;
  const projeto = sanitizeText(formulario.projeto, 50);
  const cidade = sanitizeText(formulario.cidade, 100);
  const equipe = sanitizeText(formulario.equipe, 50);
  const tensao = sanitizeText(formulario.tensao_rede, 10);
  const dataExe = sanitizeText(formulario.data_exe, 10);
  const tipoServico = sanitizeText(formulario.tipo_servico, 30);
  const observacao = sanitizeText(formulario.observacao, 2000);

  if (!projeto || !cidade || !equipe || !TENSOES.has(tensao)
    || !TIPOS.has(tipoServico) || !/^\d{4}-\d{2}-\d{2}$/.test(dataExe)
    || !ups.length || ups.length > 100) {
    const error = new Error("Dados da solicitação inválidos.");
    error.status = 400;
    throw error;
  }

  const quantidadesPorUp = new Map();
  for (const item of ups) {
    const up = normalizarUp(item.up);
    const quantidade = Number(item.quantidade);

    if (!up || !Number.isFinite(quantidade) || quantidade <= 0 || quantidade > 10000) {
      const error = new Error("UP ou quantidade inválida.");
      error.status = 400;
      throw error;
    }
    quantidadesPorUp.set(up, (quantidadesPorUp.get(up) || 0) + quantidade);
  }

  const upList = [...quantidadesPorUp.keys()];
  const placeholders = upList.map(() => "?").join(",");
  const [catalogo] = await db.query(`
    SELECT up, quantidade, material, codigo_13_8, codigo_34_5
    FROM config_listas_materiais
    WHERE regional = ? AND up IN (${placeholders})
  `, [regional, ...upList]);
  const upsEncontradas = new Set(catalogo.map(item => normalizarUp(item.up)));

  if (upList.some(up => !upsEncontradas.has(up))) {
    const error = new Error("Uma ou mais UPs não pertencem à sua regional.");
    error.status = 403;
    throw error;
  }

  const materiais = new Map();
  for (const item of catalogo) {
    const up = normalizarUp(item.up);
    const quantidadeBase = quantidadeNumerica(item.quantidade);
    const total = quantidadeBase * quantidadesPorUp.get(up);
    const codigo = tensao === "13.8" ? item.codigo_13_8 : item.codigo_34_5;
    const chave = `${codigo || ""}\u0000${item.material}`;

    if (Number.isFinite(total) && total > 0) {
      const material = materiais.get(chave) || {
        codigo: codigo || null,
        descricao: item.material,
        quantidade: 0
      };
      material.quantidade += total;
      materiais.set(chave, material);
    }
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(`
      INSERT INTO materiais_solicitados
        (usuario_id, regional, projeto, cidade, equipe, tensao_rede, data_exe, tipo_servico, observacao, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente')
    `, [req.usuario.id, regional, projeto, cidade, equipe, tensao, dataExe, tipoServico, observacao || null]);

    for (const material of materiais.values()) {
      await connection.execute(`
        INSERT INTO materiais_solicitados_items
          (solicitacao_id, codigo_material, descricao_material, quantidade_sol)
        VALUES (?, ?, ?, ?)
      `, [result.insertId, material.codigo, material.descricao, material.quantidade]);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = criarSolicitacao;
