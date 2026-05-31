const jwt = require("jsonwebtoken");

function verificarToken(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({
      error: "Usuário não autenticado"
    });
  }

  try {
    const usuario = jwt.verify(token, process.env.JWT_SECRET);

    req.usuario = usuario;
    req.usuario.id_usuario = usuario.id; // Certifique-se de que o ID do usuário esteja presente no token

    next();

  } catch (error) {
    return res.status(401).json({
      error: "Token inválido ou expirado"
    });
  }
}

module.exports = verificarToken;