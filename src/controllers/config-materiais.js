const db = require("../models/db");
const { sanitizeText } = require("../utils/security");

function idValido(id) {
  const numero = Number(id);
  return Number.isInteger(numero) && numero > 0;
}

async function alterarConfig(req, res) {
  const { itens = [], deletados = [] } = req.body;
  const regional = req.usuario.regional;

  if (!Array.isArray(itens) || !Array.isArray(deletados) || itens.length > 2000 || deletados.length > 2000) {
    return res.status(400).json({ error: "Dados de configuração inválidos." });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    let criados = 0;
    let atualizados = 0;
    let excluidos = 0;

    const ids = deletados.map(item => Number(item?.id ?? item)).filter(idValido);
    if (ids.length) {
      const placeholders = ids.map(() => "?").join(",");
      const [result] = await connection.query(
        `DELETE FROM config_listas_materiais WHERE regional = ? AND id IN (${placeholders})`,
        [regional, ...ids]
      );
      excluidos = result.affectedRows;
    }

    for (const item of itens) {
      const up = sanitizeText(item.up, 100).toUpperCase();
      const quantidade = sanitizeText(item.qtd ?? item.quantidade, 255);
      const material = sanitizeText(item.material, 255);

      if (!up || !material || !quantidade || !/^[0-9A-Za-zÀ-ÿ.,/ -]+$/.test(quantidade)) {
        const error = new Error("Há materiais com dados inválidos.");
        error.status = 400;
        throw error;
      }

      if (idValido(item.id)) {
        const [result] = await connection.execute(`
          UPDATE config_listas_materiais
          SET up = ?, quantidade = ?, material = ?
          WHERE id = ? AND regional = ?
        `, [up, quantidade, material, Number(item.id), regional]);
        atualizados += result.affectedRows;
      } else {
        await connection.execute(`
          INSERT INTO config_listas_materiais (regional, up, quantidade, material)
          VALUES (?, ?, ?, ?)
        `, [regional, up, quantidade, material]);
        criados += 1;
      }
    }

    await connection.commit();
    res.json({
      message: "Configurações salvas com sucesso.",
      resumo: { criados, atualizados, excluidos }
    });
  } catch (error) {
    await connection.rollback();
    res.status(error.status || 500).json({ error: error.status ? error.message : "Erro ao salvar configurações." });
  } finally {
    connection.release();
  }
}

module.exports = alterarConfig;
