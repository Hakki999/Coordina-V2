const db = require("../models/db");
const { hashPassword, isStrongPassword, sanitizeText } = require("../utils/security");

const PERFIS = new Set(["admin", "almoxarifado", "programacao", "sem_perfil"]);
const REGIONAIS = new Set(["MBL", "MHS"]);

async function listarUsuarios(req, res) {
  const [usuarios] = await db.execute(`
    SELECT id, nome, tipo_usuario, regional, criado_em
    FROM usuarios
    ORDER BY nome ASC
  `);

  res.json(usuarios);
}

async function criarUsuario(req, res) {
  const nome = sanitizeText(req.body.nome, 100);
  const senha = String(req.body.senha ?? "");
  const tipoUsuario = sanitizeText(req.body.tipo_usuario, 30);
  const regional = sanitizeText(req.body.regional, 3).toUpperCase();

  if (nome.length < 3 || !PERFIS.has(tipoUsuario) || !REGIONAIS.has(regional)) {
    return res.status(400).json({ error: "Dados de perfil inválidos." });
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
  let result;

  try {
    [result] = await db.execute(
      "INSERT INTO usuarios (nome, senha, tipo_usuario, regional) VALUES (?, ?, ?, ?)",
      [nome, senhaHash, tipoUsuario, regional]
    );
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Já existe um usuário com esse nome." });
    }
    throw error;
  }

  res.status(201).json({
    message: "Perfil criado com sucesso.",
    usuario: { id: result.insertId, nome, tipo_usuario: tipoUsuario, regional }
  });
}

module.exports = { listarUsuarios, criarUsuario };
