const jwt = require("jsonwebtoken");
const db = require("../models/db");
const { hashPassword, verifyPassword, isStrongPassword, sanitizeText } = require("../utils/security");

const DESTINOS = [
  ["home.visualizar", "/home"],
  ["logistica.solicitar", "/solicitar-materiais"],
  ["logistica.solicitacoes.visualizar", "/solicitacoes"],
  ["logistica.configuracoes", "/configuracoes"],
  ["almoxarifado.estoque", "/estoque-fisico"],
  ["almoxarifado.dashboard", "/dashboard-almoxarifado"],
  ["medicao.controle_asbuilt.visualizar", "/controle-asbuilt"],
  ["medicao.controle_asbuilt.editar", "/controle-asbuilt"],
  ["medicao.asbuilt_pendentes", "/asbuilt-pendentes"],
  ["medicao.asbuilt_dashboard", "/dashboard-asbuilt"],
  ["medicao.sgo", "/get-sgo"],
  ["medicao.asbuilt", "/teste"],
  ["bi.gpm.visualizar", "/bi-gpm/execucao"],
  ["admin.usuarios", "/perfis"],
  ["admin.perfis", "/perfis"],
  ["admin.regionais", "/perfis"]
];

async function login(req, res) {
  try {
    const nome = sanitizeText(req.body.nome, 100);
    const senha = String(req.body.senha ?? "");
    req.usuario = { id: null, nome: nome || "Nao informado", tipo_usuario: null, regional: null, permissoes: [] };
    req.auditoriaAcao = "TENTATIVA_LOGIN";

    if (!nome || !senha || senha.length > 128) {
      return res.status(400).json({ error: "Nome e senha são obrigatórios." });
    }

    const [rows] = await db.execute(`
      SELECT id, nome, senha, tipo_usuario, regional
      FROM usuarios WHERE LOWER(nome) = LOWER(?) LIMIT 1
    `, [nome]);
    const usuario = rows[0];

    if (!usuario || !(await verifyPassword(senha, usuario.senha))) {
      req.auditoriaAcao = "LOGIN_FALHOU";
      return res.status(401).json({ error: "Nome ou senha inválidos." });
    }

    if (!usuario.senha.startsWith("scrypt$")) {
      await db.execute("UPDATE usuarios SET senha = ? WHERE id = ?", [
        await hashPassword(senha),
        usuario.id
      ]);
    }

    const token = jwt.sign({
      id: usuario.id,
      nome: usuario.nome,
      tipo_usuario: usuario.tipo_usuario,
      regional: usuario.regional
    }, process.env.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: "8h",
      issuer: "controle-materiais",
      audience: "controle-materiais-web"
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 8 * 60 * 60 * 1000
    });

    const [permissoes] = await db.execute(`
      SELECT pe.chave
      FROM perfil_permissoes pp
      INNER JOIN perfis_acesso p ON p.id = pp.perfil_id
      INNER JOIN permissoes pe ON pe.id = pp.permissao_id
      WHERE p.chave = ?
    `, [usuario.tipo_usuario]);
    const chaves = permissoes.map(item => item.chave);
    const destino = DESTINOS.find(([permissao]) => chaves.includes(permissao))?.[1] || "/";
    req.usuario = {
      id: usuario.id,
      nome: usuario.nome,
      tipo_usuario: usuario.tipo_usuario,
      regional: usuario.regional,
      permissoes: chaves
    };
    req.auditoriaAcao = "LOGIN";

    return res.json({
      message: "Login realizado com sucesso.",
      redirect: destino,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        tipo_usuario: usuario.tipo_usuario,
        regional: usuario.regional,
        permissoes: chaves
      }
    });
  } catch (error) {
    console.error("Erro no login:", error);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
}

async function alterarSenha(req, res) {
  const senhaAtual = String(req.body.senha_atual ?? "");
  const novaSenha = String(req.body.nova_senha ?? "");

  if (!isStrongPassword(novaSenha)) {
    return res.status(400).json({
      error: "A nova senha deve ter ao menos 10 caracteres, maiúscula, minúscula, número e símbolo."
    });
  }

  const [rows] = await db.execute("SELECT senha FROM usuarios WHERE id = ? LIMIT 1", [req.usuario.id]);
  if (!rows[0] || !(await verifyPassword(senhaAtual, rows[0].senha))) {
    return res.status(401).json({ error: "Senha atual inválida." });
  }

  await db.execute("UPDATE usuarios SET senha = ? WHERE id = ?", [
    await hashPassword(novaSenha),
    req.usuario.id
  ]);

  res.json({ message: "Senha alterada com sucesso." });
}

module.exports = { login, alterarSenha };
