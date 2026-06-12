const db = require("../models/db");

async function columnExists(table, column) {
  const [rows] = await db.execute(`
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
    LIMIT 1
  `, [table, column]);

  return rows.length > 0;
}

async function indexExists(table, index) {
  const [rows] = await db.execute(`
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?
    LIMIT 1
  `, [table, index]);

  return rows.length > 0;
}

async function migrate() {
  if (!(await columnExists("config_listas_materiais", "regional"))) {
    await db.query(`
      ALTER TABLE config_listas_materiais
      ADD COLUMN regional ENUM('MBL','MHS') NOT NULL DEFAULT 'MBL' AFTER id
    `);
  }

  if (!(await columnExists("materiais_solicitados", "regional"))) {
    await db.query(`
      ALTER TABLE materiais_solicitados
      ADD COLUMN regional ENUM('MBL','MHS') NOT NULL DEFAULT 'MBL' AFTER usuario_id
    `);
    await db.query(`
      UPDATE materiais_solicitados ms
      INNER JOIN usuarios u ON u.id = ms.usuario_id
      SET ms.regional = u.regional
    `);
  }

  if (!(await columnExists("config_listas_materiais", "codigo_13_8"))) {
    await db.query(`
      ALTER TABLE config_listas_materiais
      ADD COLUMN codigo_13_8 VARCHAR(50) NULL AFTER material
    `);
  }

  if (!(await columnExists("config_listas_materiais", "codigo_34_5"))) {
    await db.query(`
      ALTER TABLE config_listas_materiais
      ADD COLUMN codigo_34_5 VARCHAR(50) NULL AFTER codigo_13_8
    `);
  }

  if (!(await columnExists("materiais_solicitados", "cancelado_em"))) {
    await db.query("ALTER TABLE materiais_solicitados ADD COLUMN cancelado_em TIMESTAMP NULL AFTER status");
  }

  if (!(await columnExists("materiais_solicitados", "cancelado_por"))) {
    await db.query("ALTER TABLE materiais_solicitados ADD COLUMN cancelado_por INT NULL AFTER cancelado_em");
  }

  if (!(await columnExists("materiais_solicitados_items", "atualizado_em"))) {
    await db.query("ALTER TABLE materiais_solicitados_items ADD COLUMN atualizado_em TIMESTAMP NULL AFTER observacao");
  }

  if (!(await columnExists("materiais_solicitados_items", "atualizado_por"))) {
    await db.query("ALTER TABLE materiais_solicitados_items ADD COLUMN atualizado_por INT NULL AFTER atualizado_em");
  }

  await db.query("ALTER TABLE usuarios MODIFY senha VARCHAR(255) NOT NULL");

  if (!(await indexExists("config_listas_materiais", "idx_config_regional_up"))) {
    await db.query("CREATE INDEX idx_config_regional_up ON config_listas_materiais (regional, up)");
  }

  if (!(await indexExists("materiais_solicitados", "idx_solicitacoes_regional_criado"))) {
    await db.query("CREATE INDEX idx_solicitacoes_regional_criado ON materiais_solicitados (regional, criado_em)");
  }

  if (!(await indexExists("usuarios", "uq_usuarios_nome"))) {
    await db.query("CREATE UNIQUE INDEX uq_usuarios_nome ON usuarios (nome)");
  }
}

module.exports = migrate;
