const db = require("../models/db");

async function listarMateriais() {
  const [rows] = await db.query(`
    SELECT 
      id,
      up,
      quantidade,
      material
    FROM config_listas_materiais
    WHERE material IS NOT NULL
  `);

  return rows;
}

module.exports = {
  listarMateriais
};