const db = require("../models/db");
const { COLUNAS } = require("../controllers/controle-asbuilt");

async function columnExists(table, column) {
  const [rows] = await db.execute(`
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
    LIMIT 1
  `, [table, column]);

  return rows.length > 0;
}

async function columnDataType(table, column) {
  const [rows] = await db.execute(`
    SELECT DATA_TYPE
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
    LIMIT 1
  `, [table, column]);

  return rows[0]?.DATA_TYPE;
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

async function constraintExists(table, constraint) {
  const [rows] = await db.execute(`
    SELECT 1
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?
    LIMIT 1
  `, [table, constraint]);

  return rows.length > 0;
}

const PERMISSOES = [
  ["home.visualizar", "Acessar Home", "Home", "Visualizar a página inicial.", 10],
  ["logistica.solicitar", "Solicitar materiais", "Logística", "Criar novas solicitações de materiais.", 20],
  ["logistica.solicitacoes.visualizar", "Visualizar solicitações", "Logística", "Consultar solicitações e materiais.", 30],
  ["logistica.solicitacoes.cancelar", "Cancelar solicitações", "Logística", "Cancelar solicitações existentes.", 40],
  ["logistica.solicitacoes.operar", "Operar quantidades", "Logística", "Alterar quantidades liberadas e devolvidas.", 50],
  ["logistica.configuracoes", "Configurar materiais", "Logística", "Editar catálogo, códigos e materiais por UP.", 60],
  ["almoxarifado.estoque", "Gerenciar estoque físico", "Almoxarifado", "Cadastrar, importar e ajustar o estoque físico.", 62],
  ["almoxarifado.dashboard", "Dashboard do almoxarifado", "Almoxarifado", "Acompanhar entradas, saídas e saldos de materiais.", 64],
  ["medicao.asbuilt", "Teste As-Built", "Medição", "Acessar o validador de medição As-Built.", 70],
  ["medicao.controle_asbuilt.visualizar", "Visualizar controle As-Built", "Medição", "Consultar e exportar o controle de As-Built.", 72],
  ["medicao.controle_asbuilt.editar", "Editar controle As-Built", "Medição", "Criar, alterar e excluir registros do controle de As-Built.", 74],
  ["medicao.asbuilt_pendentes", "Projetos sem As-Built", "Medição", "Gerenciar projetos concluídos sem As-Built.", 76],
  ["medicao.asbuilt_dashboard", "Dashboard As-Built", "Medição", "Acompanhar produção e status do As-Built.", 78],
  ["medicao.sgo", "Consulta SGO", "Medição", "Consultar status diretamente no SGO pela VPN.", 79],
  ["admin.sgo_config", "Configurar automação SGO", "Administração", "Configurar etapas e mapeamentos da automação SGO.", 80],
  ["admin.asbuilt_importar", "Importar controle As-Built", "Administração", "Importar e cruzar dados do controle As-Built por planilha.", 81],
  ["bi.gpm.visualizar", "Visualizar BI GPM", "BI", "Acessar os painéis integrados do BI GPM.", 80],
  ["admin.usuarios", "Administrar usuários", "Administração", "Criar e alterar usuários.", 80],
  ["admin.perfis", "Administrar perfis", "Administração", "Criar perfis e configurar permissões.", 90],
  ["admin.regionais", "Administrar regionais", "Administração", "Criar e excluir regionais.", 100]
];

const PERFIS_PADRAO = [
  ["admin", "Administrador", "Acesso administrativo completo.", 1],
  ["almoxarifado", "Almoxarifado", "Operação e configuração da logística.", 1],
  ["programacao", "Programação", "Solicitação e acompanhamento de materiais.", 1],
  ["sem_perfil", "Sem perfil", "Acesso básico ao sistema.", 1]
];

const PERMISSOES_PADRAO = {
  admin: PERMISSOES.map(item => item[0]),
  almoxarifado: [
    "home.visualizar",
    "logistica.solicitar",
    "logistica.solicitacoes.visualizar",
    "logistica.solicitacoes.cancelar",
    "logistica.solicitacoes.operar",
    "logistica.configuracoes",
    "almoxarifado.estoque",
    "almoxarifado.dashboard",
    "medicao.asbuilt"
  ],
  programacao: [
    "home.visualizar",
    "logistica.solicitar",
    "logistica.solicitacoes.visualizar",
    "logistica.solicitacoes.cancelar",
    "medicao.asbuilt"
  ],
  sem_perfil: ["home.visualizar", "medicao.asbuilt"]
};

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS regionais (
      id INT NOT NULL AUTO_INCREMENT,
      codigo VARCHAR(20) NOT NULL,
      nome VARCHAR(100) NOT NULL,
      criado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_regionais_codigo (codigo)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await db.query(`
    INSERT INTO regionais (codigo, nome)
    VALUES ('MBL', 'Montes Belos'), ('MHS', 'Morrinhos')
    ON DUPLICATE KEY UPDATE nome = VALUES(nome)
  `);
  await db.query(`
    INSERT IGNORE INTO regionais (codigo, nome)
    SELECT regional, regional
    FROM (
      SELECT DISTINCT CAST(regional AS CHAR) AS regional FROM usuarios
      UNION
      SELECT DISTINCT CAST(regional AS CHAR) AS regional FROM config_listas_materiais
      UNION
      SELECT DISTINCT CAST(regional AS CHAR) AS regional FROM materiais_solicitados
    ) regionais_existentes
    WHERE regional IS NOT NULL AND TRIM(regional) <> ''
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS controle_asbuilt (
      id INT NOT NULL AUTO_INCREMENT,
      regional VARCHAR(20) NOT NULL,
      projeto VARCHAR(100) NULL,
      asbuilt VARCHAR(100) NULL,
      data_exe DATE NULL,
      data_conclusao_projeto DATE NULL,
      projetista VARCHAR(150) NULL,
      data_asbuilt DATE NULL,
      sapid VARCHAR(100) NULL,
      status VARCHAR(100) NULL,
      status_sap VARCHAR(100) NULL,
      versao VARCHAR(30) NULL,
      pep VARCHAR(100) NULL,
      pi VARCHAR(100) NULL,
      segmento VARCHAR(150) NULL,
      nome VARCHAR(255) NULL,
      observacao TEXT NULL,
      oc VARCHAR(100) NULL,
      valor DECIMAL(15,2) NULL,
      restricao TEXT NULL,
      valor_adinatado DECIMAL(15,2) NULL,
      este_mes DECIMAL(15,2) NULL,
      responsavel VARCHAR(150) NULL,
      ciclo VARCHAR(100) NULL,
      pep_n4 VARCHAR(100) NULL,
      prod VARCHAR(100) NULL,
      marcador_x VARCHAR(50) NULL,
      status_sgo VARCHAR(255) NULL,
      cidade VARCHAR(150) NULL,
      localizacao VARCHAR(255) NULL,
      precisa_ir_campo TINYINT(1) NOT NULL DEFAULT 0,
      pdf_nome VARCHAR(255) NULL,
      pdf_arquivo VARCHAR(255) NULL,
      criado_por INT NULL,
      concluido_por INT NULL,
      atualizado_por INT NULL,
      criado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_controle_asbuilt_regional_atualizado (regional, atualizado_em),
      KEY idx_controle_asbuilt_regional_projeto (regional, projeto),
      CONSTRAINT fk_controle_asbuilt_regional
        FOREIGN KEY (regional) REFERENCES regionais(codigo)
        ON UPDATE CASCADE ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS controle_asbuilt_colunas (
      id INT NOT NULL AUTO_INCREMENT,
      campo VARCHAR(60) NOT NULL,
      titulo VARCHAR(120) NOT NULL,
      tipo ENUM('texto','numero','moeda','data','booleano','lista') NOT NULL DEFAULT 'texto',
      limite INT NOT NULL DEFAULT 255,
      largura INT NOT NULL DEFAULT 140,
      obrigatoria TINYINT(1) NOT NULL DEFAULT 0,
      opcoes_json LONGTEXT NULL,
      valor_padrao TEXT NULL,
      formula TEXT NULL,
      sistema TINYINT(1) NOT NULL DEFAULT 0,
      ativa TINYINT(1) NOT NULL DEFAULT 1,
      ordem INT NOT NULL DEFAULT 0,
      criado_por INT NULL,
      atualizado_por INT NULL,
      criado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_controle_asbuilt_colunas_campo (campo),
      KEY idx_controle_asbuilt_colunas_ordem (ativa, ordem)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  if (!(await columnExists("controle_asbuilt_colunas", "valor_padrao"))) {
    await db.query("ALTER TABLE controle_asbuilt_colunas ADD COLUMN valor_padrao TEXT NULL AFTER opcoes_json");
  }
  if (!(await columnExists("controle_asbuilt_colunas", "formula"))) {
    await db.query("ALTER TABLE controle_asbuilt_colunas ADD COLUMN formula TEXT NULL AFTER valor_padrao");
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS controle_asbuilt_valores (
      registro_id INT NOT NULL,
      coluna_id INT NOT NULL,
      valor_texto TEXT NULL,
      atualizado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (registro_id, coluna_id),
      CONSTRAINT fk_controle_asbuilt_valores_registro
        FOREIGN KEY (registro_id) REFERENCES controle_asbuilt(id) ON DELETE CASCADE,
      CONSTRAINT fk_controle_asbuilt_valores_coluna
        FOREIGN KEY (coluna_id) REFERENCES controle_asbuilt_colunas(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  for (const coluna of COLUNAS) {
    await db.execute(`
      INSERT IGNORE INTO controle_asbuilt_colunas
        (campo, titulo, tipo, limite, largura, obrigatoria, opcoes_json, sistema, ativa, ordem)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?)
    `, [
      coluna.campo,
      coluna.titulo,
      coluna.tipo,
      coluna.limite || 255,
      coluna.largura || 140,
      coluna.obrigatoria ? 1 : 0,
      JSON.stringify(coluna.opcoes || []),
      coluna.ordem || 0
    ]);
  }

  if (!(await columnExists("controle_asbuilt", "status_sgo"))) {
    await db.query("ALTER TABLE controle_asbuilt ADD COLUMN status_sgo VARCHAR(255) NULL AFTER marcador_x");
  }
  if (!(await columnExists("controle_asbuilt", "asbuilt"))) {
    await db.query("ALTER TABLE controle_asbuilt ADD COLUMN asbuilt VARCHAR(100) NULL AFTER projeto");
  }
  if (!(await columnExists("controle_asbuilt", "ciclo"))) {
    await db.query("ALTER TABLE controle_asbuilt ADD COLUMN ciclo VARCHAR(100) NULL AFTER responsavel");
  }
  if (!(await columnExists("controle_asbuilt", "concluido_por"))) {
    await db.query("ALTER TABLE controle_asbuilt ADD COLUMN concluido_por INT NULL AFTER criado_por");
  }
  if (!(await columnExists("controle_asbuilt", "cidade"))) {
    await db.query("ALTER TABLE controle_asbuilt ADD COLUMN cidade VARCHAR(150) NULL AFTER status_sgo");
  }
  if (!(await columnExists("controle_asbuilt", "data_conclusao_projeto"))) {
    await db.query("ALTER TABLE controle_asbuilt ADD COLUMN data_conclusao_projeto DATE NULL AFTER data_exe");
  }
  if (!(await columnExists("controle_asbuilt", "localizacao"))) {
    await db.query("ALTER TABLE controle_asbuilt ADD COLUMN localizacao VARCHAR(255) NULL AFTER cidade");
  }
  if (!(await columnExists("controle_asbuilt", "precisa_ir_campo"))) {
    await db.query("ALTER TABLE controle_asbuilt ADD COLUMN precisa_ir_campo TINYINT(1) NOT NULL DEFAULT 0 AFTER localizacao");
  }
  if (!(await columnExists("controle_asbuilt", "pdf_nome"))) {
    await db.query("ALTER TABLE controle_asbuilt ADD COLUMN pdf_nome VARCHAR(255) NULL AFTER precisa_ir_campo");
  }
  if (!(await columnExists("controle_asbuilt", "pdf_arquivo"))) {
    await db.query("ALTER TABLE controle_asbuilt ADD COLUMN pdf_arquivo VARCHAR(255) NULL AFTER pdf_nome");
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS asbuilt_pendentes (
      id INT NOT NULL AUTO_INCREMENT,
      regional VARCHAR(20) NOT NULL,
      projeto VARCHAR(100) NOT NULL,
      data_conclusao DATE NOT NULL,
      cidade VARCHAR(150) NULL,
      localizacao VARCHAR(255) NULL,
      precisa_ir_campo TINYINT(1) NOT NULL DEFAULT 0,
      observacao TEXT NULL,
      pdf_nome VARCHAR(255) NULL,
      pdf_arquivo VARCHAR(255) NULL,
      criado_por INT NULL,
      criado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_asbuilt_pendentes_regional_data (regional, data_conclusao),
      UNIQUE KEY uq_asbuilt_pendente_regional_projeto (regional, projeto),
      CONSTRAINT fk_asbuilt_pendentes_regional
        FOREIGN KEY (regional) REFERENCES regionais(codigo)
        ON UPDATE CASCADE ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS sgo_configuracoes (
      id INT NOT NULL AUTO_INCREMENT,
      chave VARCHAR(100) NOT NULL,
      nome VARCHAR(150) NOT NULL,
      descricao VARCHAR(500) NULL,
      etapas_json LONGTEXT NOT NULL,
      mapeamentos_json LONGTEXT NOT NULL,
      ativo TINYINT(1) NOT NULL DEFAULT 1,
      atualizado_por INT NULL,
      criado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_sgo_configuracoes_chave (chave)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS auditoria_logs (
      id BIGINT NOT NULL AUTO_INCREMENT,
      usuario_id INT NULL,
      usuario_nome VARCHAR(100) NOT NULL,
      tipo_usuario VARCHAR(50) NULL,
      regional VARCHAR(20) NULL,
      acao VARCHAR(100) NOT NULL,
      metodo VARCHAR(10) NOT NULL,
      rota VARCHAR(255) NOT NULL,
      status_http SMALLINT NOT NULL DEFAULT 0,
      sucesso TINYINT(1) NOT NULL DEFAULT 0,
      ip VARCHAR(64) NULL,
      user_agent VARCHAR(500) NULL,
      detalhes_json LONGTEXT NULL,
      criado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_auditoria_criado (criado_em),
      KEY idx_auditoria_usuario (usuario_id, criado_em),
      KEY idx_auditoria_acao (acao, criado_em)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS estoque_fisico (
      id INT NOT NULL AUTO_INCREMENT,
      regional VARCHAR(20) NOT NULL,
      codigo VARCHAR(100) NOT NULL,
      descricao VARCHAR(255) NOT NULL,
      quantidade DECIMAL(15,3) NOT NULL DEFAULT 0,
      unidade VARCHAR(50) NOT NULL DEFAULT 'UNIDADE',
      atualizado_por INT NULL,
      criado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_estoque_regional_codigo (regional, codigo),
      KEY idx_estoque_regional_descricao (regional, descricao),
      CONSTRAINT fk_estoque_regional
        FOREIGN KEY (regional) REFERENCES regionais(codigo)
        ON UPDATE CASCADE ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
      id INT NOT NULL AUTO_INCREMENT,
      regional VARCHAR(20) NOT NULL,
      estoque_id INT NULL,
      codigo VARCHAR(100) NULL,
      descricao VARCHAR(255) NOT NULL,
      tipo ENUM('entrada','saida','ajuste') NOT NULL,
      quantidade DECIMAL(15,3) NOT NULL,
      saldo_anterior DECIMAL(15,3) NULL,
      saldo_posterior DECIMAL(15,3) NULL,
      origem VARCHAR(100) NULL,
      referencia_id INT NULL,
      usuario_id INT NULL,
      criado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_mov_estoque_regional_data (regional, criado_em),
      KEY idx_mov_estoque_codigo (regional, codigo),
      CONSTRAINT fk_mov_estoque_regional
        FOREIGN KEY (regional) REFERENCES regionais(codigo)
        ON UPDATE CASCADE ON DELETE RESTRICT,
      CONSTRAINT fk_mov_estoque_item
        FOREIGN KEY (estoque_id) REFERENCES estoque_fisico(id)
        ON UPDATE CASCADE ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS perfis_acesso (
      id INT NOT NULL AUTO_INCREMENT,
      chave VARCHAR(50) NOT NULL,
      nome VARCHAR(100) NOT NULL,
      descricao VARCHAR(255) NULL,
      sistema TINYINT(1) NOT NULL DEFAULT 0,
      criado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_perfis_chave (chave)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS permissoes (
      id INT NOT NULL AUTO_INCREMENT,
      chave VARCHAR(100) NOT NULL,
      nome VARCHAR(100) NOT NULL,
      grupo VARCHAR(50) NOT NULL,
      descricao VARCHAR(255) NULL,
      ordem INT NOT NULL DEFAULT 0,
      PRIMARY KEY (id),
      UNIQUE KEY uq_permissoes_chave (chave)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS perfil_permissoes (
      perfil_id INT NOT NULL,
      permissao_id INT NOT NULL,
      PRIMARY KEY (perfil_id, permissao_id),
      CONSTRAINT fk_perfil_permissoes_perfil
        FOREIGN KEY (perfil_id) REFERENCES perfis_acesso(id) ON DELETE CASCADE,
      CONSTRAINT fk_perfil_permissoes_permissao
        FOREIGN KEY (permissao_id) REFERENCES permissoes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  for (const perfil of PERFIS_PADRAO) {
    await db.execute(`
      INSERT IGNORE INTO perfis_acesso (chave, nome, descricao, sistema)
      VALUES (?, ?, ?, ?)
    `, perfil);
  }

  const novasPermissoes = [];
  for (const permissao of PERMISSOES) {
    const [existentes] = await db.execute("SELECT id FROM permissoes WHERE chave = ? LIMIT 1", [permissao[0]]);
    await db.execute(`
      INSERT INTO permissoes (chave, nome, grupo, descricao, ordem)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE nome = VALUES(nome), grupo = VALUES(grupo),
        descricao = VALUES(descricao), ordem = VALUES(ordem)
    `, permissao);
    if (!existentes.length) novasPermissoes.push(permissao[0]);
  }

  for (const permissao of novasPermissoes) {
    for (const [perfil, permissoes] of Object.entries(PERMISSOES_PADRAO)) {
      if (!permissoes.includes(permissao)) continue;
      await db.execute(`
        INSERT IGNORE INTO perfil_permissoes (perfil_id, permissao_id)
        SELECT p.id, pe.id
        FROM perfis_acesso p
        INNER JOIN permissoes pe ON pe.chave = ?
        WHERE p.chave = ?
      `, [permissao, perfil]);
    }
  }

  const [vinculos] = await db.query("SELECT COUNT(*) AS total FROM perfil_permissoes");
  if (Number(vinculos[0].total) === 0) {
    for (const [perfil, permissoes] of Object.entries(PERMISSOES_PADRAO)) {
      for (const permissao of permissoes) {
        await db.execute(`
          INSERT IGNORE INTO perfil_permissoes (perfil_id, permissao_id)
          SELECT p.id, pe.id
          FROM perfis_acesso p
          INNER JOIN permissoes pe ON pe.chave = ?
          WHERE p.chave = ?
        `, [permissao, perfil]);
      }
    }
  }

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

  if ((await columnDataType("usuarios", "tipo_usuario")) === "enum") {
    await db.query("ALTER TABLE usuarios MODIFY tipo_usuario VARCHAR(50) NOT NULL DEFAULT 'sem_perfil'");
  }
  if ((await columnDataType("usuarios", "regional")) === "enum") {
    await db.query("ALTER TABLE usuarios MODIFY regional VARCHAR(20) NOT NULL DEFAULT 'MBL'");
  }
  if ((await columnDataType("config_listas_materiais", "regional")) === "enum") {
    await db.query("ALTER TABLE config_listas_materiais MODIFY regional VARCHAR(20) NOT NULL DEFAULT 'MBL'");
  }
  if ((await columnDataType("materiais_solicitados", "regional")) === "enum") {
    await db.query("ALTER TABLE materiais_solicitados MODIFY regional VARCHAR(20) NOT NULL DEFAULT 'MBL'");
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

  await db.query(`
    ALTER TABLE materiais_solicitados
    MODIFY status ENUM('pendente','separado','entregue','cancelado','concluido') DEFAULT 'pendente'
  `);
  await db.query(`
    UPDATE materiais_solicitados
    SET status = 'concluido'
    WHERE status = 'cancelado' AND cancelado_em IS NOT NULL AND data_exe < CURRENT_DATE
  `);

  if (!(await columnExists("materiais_solicitados_items", "atualizado_em"))) {
    await db.query("ALTER TABLE materiais_solicitados_items ADD COLUMN atualizado_em TIMESTAMP NULL AFTER observacao");
  }

  if (!(await columnExists("materiais_solicitados_items", "atualizado_por"))) {
    await db.query("ALTER TABLE materiais_solicitados_items ADD COLUMN atualizado_por INT NULL AFTER atualizado_em");
  }

  await db.query("ALTER TABLE usuarios MODIFY senha VARCHAR(255) NOT NULL");

  if (!(await constraintExists("usuarios", "fk_usuarios_perfil"))) {
    await db.query(`
      ALTER TABLE usuarios ADD CONSTRAINT fk_usuarios_perfil
      FOREIGN KEY (tipo_usuario) REFERENCES perfis_acesso(chave)
      ON UPDATE CASCADE ON DELETE RESTRICT
    `);
  }

  if (!(await constraintExists("usuarios", "fk_usuarios_regional"))) {
    await db.query(`
      ALTER TABLE usuarios ADD CONSTRAINT fk_usuarios_regional
      FOREIGN KEY (regional) REFERENCES regionais(codigo)
      ON UPDATE CASCADE ON DELETE RESTRICT
    `);
  }

  if (!(await constraintExists("config_listas_materiais", "fk_config_materiais_regional"))) {
    await db.query(`
      ALTER TABLE config_listas_materiais ADD CONSTRAINT fk_config_materiais_regional
      FOREIGN KEY (regional) REFERENCES regionais(codigo)
      ON UPDATE CASCADE ON DELETE RESTRICT
    `);
  }

  if (!(await constraintExists("materiais_solicitados", "fk_solicitacoes_regional"))) {
    await db.query(`
      ALTER TABLE materiais_solicitados ADD CONSTRAINT fk_solicitacoes_regional
      FOREIGN KEY (regional) REFERENCES regionais(codigo)
      ON UPDATE CASCADE ON DELETE RESTRICT
    `);
  }

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
