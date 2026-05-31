const jwt = require("jsonwebtoken");
const db = require("../models/db");

async function login(req, res) {
  try {
    const { nome, senha } = req.body;

    if (!nome || !senha) {
      return res.status(400).json({
        error: "Nome e senha são obrigatórios"
      });
    }

    const [rows] = await db.execute(
      `
        SELECT id, nome, senha, tipo_usuario, regional
        FROM usuarios
        WHERE nome = ? AND senha = ?
        LIMIT 1
      `,
      [nome, senha]
    );

    const usuario = rows[0];

    if (!usuario) {
      return res.status(401).json({
        error: "Nome ou senha inválidos"
      });
    }

    console.log("Usuário encontrado:", usuario);

    const token = jwt.sign(
      {
        id: usuario.id,
        nome: usuario.nome,
        tipo_usuario: usuario.tipo_usuario,
        regional: usuario.regional
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d"
      }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60 * 1000
    });

    return res.json({
      message: "Login realizado com sucesso",
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        tipo_usuario: usuario.tipo_usuario,
        regional: usuario.regional
      }
    });

  } catch (error) {
    console.error("Erro no login:", error);

    return res.status(500).json({
      error: "Erro interno no servidor"
    });
  }
}

module.exports = {
  login
};