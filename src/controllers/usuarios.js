const db = require("../models/db");
const { hashPassword, isStrongPassword, sanitizeText } = require("../utils/security");

async function referenciasValidas(tipoUsuario, regional) {
  const [[perfis], [regionais]] = await Promise.all([
    db.execute("SELECT chave FROM perfis_acesso WHERE chave = ? LIMIT 1", [tipoUsuario]),
    db.execute("SELECT codigo FROM regionais WHERE codigo = ? LIMIT 1", [regional])
  ]);

  return perfis.length > 0 && regionais.length > 0;
}

async function listarUsuarios(req, res) {
  const [usuarios] = await db.execute(`
    SELECT u.id, u.nome, u.tipo_usuario, p.nome AS perfil_nome, u.regional,
      r.nome AS regional_nome, u.criado_em
    FROM usuarios u
    INNER JOIN perfis_acesso p ON p.chave = u.tipo_usuario
    INNER JOIN regionais r ON r.codigo = u.regional
    ORDER BY u.nome ASC
  `);

  res.json(usuarios);
}

async function criarUsuario(req, res) {
  const nome = sanitizeText(req.body.nome, 100);
  const senha = String(req.body.senha ?? "");
  const tipoUsuario = sanitizeText(req.body.tipo_usuario, 50);
  const regional = sanitizeText(req.body.regional, 20).toUpperCase();

  if (nome.length < 3 || !(await referenciasValidas(tipoUsuario, regional))) {
    return res.status(400).json({ error: "Perfil ou regional inválidos." });
  }

  if (!isStrongPassword(senha)) {
    return res.status(400).json({
      error: "A senha deve ter ao menos 10 caracteres, maiúscula, minúscula, número e símbolo."
    });
  }

  const [existentes] = await db.execute(
    "SELECT id FROM usuarios WHERE LOWER(nome) = LOWER(?) LIMIT 1",
    [nome]
  );

  if (existentes.length) {
    return res.status(409).json({ error: "Já existe um usuário com esse nome." });
  }

  const senhaHash = await hashPassword(senha);
  const [result] = await db.execute(
    "INSERT INTO usuarios (nome, senha, tipo_usuario, regional) VALUES (?, ?, ?, ?)",
    [nome, senhaHash, tipoUsuario, regional]
  );

  res.status(201).json({
    message: "Usuário criado com sucesso.",
    usuario: { id: result.insertId, nome, tipo_usuario: tipoUsuario, regional }
  });
}

async function atualizarUsuario(req, res) {
  const id = Number(req.params.id);
  const tipoUsuario = sanitizeText(req.body.tipo_usuario, 50);
  const regional = sanitizeText(req.body.regional, 20).toUpperCase();

  if (!Number.isInteger(id) || id <= 0 || !(await referenciasValidas(tipoUsuario, regional))) {
    return res.status(400).json({ error: "Dados do usuário inválidos." });
  }

  if (id === req.usuario.id && tipoUsuario !== req.usuario.tipo_usuario) {
    return res.status(400).json({ error: "Você não pode alterar o próprio perfil administrativo." });
  }

  const [result] = await db.execute(
    "UPDATE usuarios SET tipo_usuario = ?, regional = ? WHERE id = ?",
    [tipoUsuario, regional, id]
  );

  if (!result.affectedRows) return res.status(404).json({ error: "Usuário não encontrado." });
  res.json({ message: "Acesso do usuário atualizado." });
}

async function excluirUsuario(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Usuário inválido." });
  if (id === req.usuario.id) return res.status(400).json({ error: "Você não pode excluir o próprio usuário." });

  try {
    const [result] = await db.execute("DELETE FROM usuarios WHERE id = ?", [id]);
    if (!result.affectedRows) return res.status(404).json({ error: "Usuário não encontrado." });
    res.json({ message: "Usuário excluído." });
  } catch (error) {
    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({ error: "Este usuário possui histórico e não pode ser excluído." });
    }
    throw error;
  }
}

module.exports = { listarUsuarios, criarUsuario, atualizarUsuario, excluirUsuario };
