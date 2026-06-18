function exigirAdmin(req, res, next) {
  if (req.usuario?.tipo_usuario !== "admin") {
    return res.status(403).json({
      error: "Apenas administradores podem realizar esta acao."
    });
  }

  next();
}

module.exports = exigirAdmin;
