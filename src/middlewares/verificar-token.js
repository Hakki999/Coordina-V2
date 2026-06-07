const jwt = require("jsonwebtoken");
const db = require("../models/db");

async function verificarToken(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: "Usuário não autenticado." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "controle-materiais",
      audience: "controle-materiais-web"
    });

    const [rows] = await db.execute(`
      SELECT id, nome, tipo_usuario, regional
      FROM usuarios
      WHERE id = ?
      LIMIT 1
    `, [payload.id]);

    if (!rows[0]) {
      res.clearCookie("token", { path: "/" });
      return res.status(401).json({ error: "Usuário não encontrado." });
    }

    req.usuario = {
      ...rows[0],
      id_usuario: rows[0].id
    };
    next();
  } catch {
    res.clearCookie("token", { path: "/" });
    return res.status(401).json({ error: "Token inválido ou expirado." });
  }
}

module.exports = verificarToken;
