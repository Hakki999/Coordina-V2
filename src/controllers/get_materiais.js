const db = require("../models/db");

async function listarMateriais(regional) {
  const [rows] = await db.execute(`
    SELECT id, regional, up, quantidade, material
    FROM config_listas_materiais
    WHERE material IS NOT NULL AND regional = ?
    ORDER BY up, material
  `, [regional]);

  return rows;
}

module.exports = { listarMateriais };
