const db = require("../models/db");
const { sanitizeText } = require("../utils/security");

function chaveValida(chave, limite = 50) {
  return chave.length >= 2 && chave.length <= limite && /^[a-z0-9_]+$/.test(chave);
}

async function listarAdministracao(req, res) {
  const [[perfis], [permissoes], [vinculos], [regionais]] = await Promise.all([
    db.execute(`
      SELECT p.id, p.chave, p.nome, p.descricao, p.sistema, p.criado_em,
        COUNT(DISTINCT u.id) AS total_usuarios
      FROM perfis_acesso p
      LEFT JOIN usuarios u ON u.tipo_usuario = p.chave
      GROUP BY p.id, p.chave, p.nome, p.descricao, p.sistema, p.criado_em
      ORDER BY p.sistema DESC, p.nome
    `),
    db.execute("SELECT id, chave, nome, grupo, descricao, ordem FROM permissoes ORDER BY ordem, nome"),
    db.execute(`
      SELECT pp.perfil_id, pe.chave
      FROM perfil_permissoes pp
      INNER JOIN permissoes pe ON pe.id = pp.permissao_id
      ORDER BY pe.ordem
    `),
    db.execute(`
      SELECT r.id, r.codigo, r.nome, r.criado_em,
        COALESCE(u.total, 0) AS total_usuarios,
        COALESCE(c.total, 0) AS total_configuracoes,
        COALESCE(s.total, 0) AS total_solicitacoes,
        COALESCE(a.total, 0) AS total_asbuilt
      FROM regionais r
      LEFT JOIN (
        SELECT regional, COUNT(*) AS total
        FROM usuarios
        GROUP BY regional
      ) u ON u.regional = r.codigo
      LEFT JOIN (
        SELECT regional, COUNT(*) AS total
        FROM config_listas_materiais
        GROUP BY regional
      ) c ON c.regional = r.codigo
      LEFT JOIN (
        SELECT regional, COUNT(*) AS total
        FROM materiais_solicitados
        GROUP BY regional
      ) s ON s.regional = r.codigo
      LEFT JOIN (
        SELECT regional, COUNT(*) AS total
        FROM controle_asbuilt
        GROUP BY regional
      ) a ON a.regional = r.codigo
      ORDER BY r.codigo
    `)
  ]);

  const porPerfil = new Map();
  vinculos.forEach(item => {
    if (!porPerfil.has(item.perfil_id)) porPerfil.set(item.perfil_id, []);
    porPerfil.get(item.perfil_id).push(item.chave);
  });

  res.json({
    perfis: perfis.map(perfil => ({ ...perfil, permissoes: porPerfil.get(perfil.id) || [] })),
    permissoes,
    regionais
  });
}

async function validarPermissoes(permissoes) {
  if (!Array.isArray(permissoes) || permissoes.length > 100) return false;
  if (!permissoes.length) return true;
  const unicas = [...new Set(permissoes.map(item => sanitizeText(item, 100)))];
  const placeholders = unicas.map(() => "?").join(",");
  const [rows] = await db.query(`SELECT chave FROM permissoes WHERE chave IN (${placeholders})`, unicas);
  return rows.length === unicas.length;
}

async function salvarPermissoes(connection, perfilId, permissoes) {
  await connection.execute("DELETE FROM perfil_permissoes WHERE perfil_id = ?", [perfilId]);
  for (const permissao of [...new Set(permissoes)]) {
    await connection.execute(`
      INSERT INTO perfil_permissoes (perfil_id, permissao_id)
      SELECT ?, id FROM permissoes WHERE chave = ?
    `, [perfilId, permissao]);
  }
}

async function criarPerfil(req, res) {
  const chave = sanitizeText(req.body.chave, 50).toLowerCase();
  const nome = sanitizeText(req.body.nome, 100);
  const descricao = sanitizeText(req.body.descricao, 255);
  const permissoes = req.body.permissoes || [];

  if (!chaveValida(chave) || nome.length < 2 || !(await validarPermissoes(permissoes))) {
    return res.status(400).json({ error: "Dados do perfil inválidos." });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      "INSERT INTO perfis_acesso (chave, nome, descricao) VALUES (?, ?, ?)",
      [chave, nome, descricao || null]
    );
    await salvarPermissoes(connection, result.insertId, permissoes);
    await connection.commit();
    res.status(201).json({ message: "Perfil criado com sucesso." });
  } catch (error) {
    await connection.rollback();
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Já existe um perfil com essa chave." });
    throw error;
  } finally {
    connection.release();
  }
}

async function atualizarPerfil(req, res) {
  const id = Number(req.params.id);
  const nome = sanitizeText(req.body.nome, 100);
  const descricao = sanitizeText(req.body.descricao, 255);
  const permissoes = req.body.permissoes || [];

  if (!Number.isInteger(id) || id <= 0 || nome.length < 2 || !(await validarPermissoes(permissoes))) {
    return res.status(400).json({ error: "Dados do perfil inválidos." });
  }

  const [perfis] = await db.execute("SELECT chave FROM perfis_acesso WHERE id = ? LIMIT 1", [id]);
  if (!perfis[0]) return res.status(404).json({ error: "Perfil não encontrado." });
  if (perfis[0].chave === req.usuario.tipo_usuario && !permissoes.includes("admin.perfis")) {
    return res.status(400).json({ error: "Você não pode remover sua própria permissão de administrar perfis." });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute("UPDATE perfis_acesso SET nome = ?, descricao = ? WHERE id = ?", [
      nome, descricao || null, id
    ]);
    await salvarPermissoes(connection, id, permissoes);
    await connection.commit();
    res.json({ message: "Perfil e permissões atualizados." });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function excluirPerfil(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Perfil inválido." });

  const [perfis] = await db.execute("SELECT sistema FROM perfis_acesso WHERE id = ? LIMIT 1", [id]);
  if (!perfis[0]) return res.status(404).json({ error: "Perfil não encontrado." });
  if (perfis[0].sistema) return res.status(400).json({ error: "Perfis padrão do sistema não podem ser excluídos." });

  try {
    await db.execute("DELETE FROM perfis_acesso WHERE id = ?", [id]);
    res.json({ message: "Perfil excluído." });
  } catch (error) {
    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({ error: "Este perfil está vinculado a usuários e não pode ser excluído." });
    }
    throw error;
  }
}

async function criarRegional(req, res) {
  const codigo = sanitizeText(req.body.codigo, 20).toUpperCase();
  const nome = sanitizeText(req.body.nome, 100);
  if (nome.length < 2 || !/^[A-Z0-9_-]{2,20}$/.test(codigo)) {
    return res.status(400).json({ error: "Código ou nome da regional inválidos." });
  }

  try {
    await db.execute("INSERT INTO regionais (codigo, nome) VALUES (?, ?)", [codigo, nome]);
    res.status(201).json({ message: "Regional criada com sucesso." });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Já existe uma regional com esse código." });
    throw error;
  }
}

async function excluirRegional(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Regional inválida." });

  try {
    const [result] = await db.execute("DELETE FROM regionais WHERE id = ?", [id]);
    if (!result.affectedRows) return res.status(404).json({ error: "Regional não encontrada." });
    res.json({ message: "Regional excluída." });
  } catch (error) {
    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({ error: "A regional possui usuários, materiais, solicitações ou registros As-Built e não pode ser excluída." });
    }
    throw error;
  }
}

module.exports = {
  listarAdministracao,
  criarPerfil,
  atualizarPerfil,
  excluirPerfil,
  criarRegional,
  excluirRegional
};
