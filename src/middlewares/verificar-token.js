const jwt = require("jsonwebtoken");
const db = require("../models/db");

async function verificarToken(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    if (req.method === "GET" && !req.originalUrl.startsWith("/api/") && req.originalUrl !== "/perfil") {
      return res.redirect("/");
    }
    return res.status(401).json({ error: "Usuário não autenticado." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "controle-materiais",
      audience: "controle-materiais-web"
    });

    const [rows] = await db.execute(`
      SELECT u.id, u.nome, u.tipo_usuario, u.regional, p.nome AS perfil_nome
      FROM usuarios u
      INNER JOIN perfis_acesso p ON p.chave = u.tipo_usuario
      WHERE u.id = ?
      LIMIT 1
    `, [payload.id]);

    if (!rows[0]) {
      res.clearCookie("token", { path: "/" });
      if (req.method === "GET" && !req.originalUrl.startsWith("/api/") && req.originalUrl !== "/perfil") {
        return res.redirect("/");
      }
      return res.status(401).json({ error: "Usuário não encontrado." });
    }

    const [permissoes] = await db.execute(`
      SELECT pe.chave
      FROM perfil_permissoes pp
      INNER JOIN perfis_acesso p ON p.id = pp.perfil_id
      INNER JOIN permissoes pe ON pe.id = pp.permissao_id
      WHERE p.chave = ?
      ORDER BY pe.ordem, pe.chave
    `, [rows[0].tipo_usuario]);

    req.usuario = {
      ...rows[0],
      id_usuario: rows[0].id,
      permissoes: permissoes.map(item => item.chave)
    };
    next();
  } catch {
    res.clearCookie("token", { path: "/" });
    if (req.method === "GET" && !req.originalUrl.startsWith("/api/") && req.originalUrl !== "/perfil") {
      return res.redirect("/");
    }
    return res.status(401).json({ error: "Token inválido ou expirado." });
  }
}

module.exports = verificarToken;
