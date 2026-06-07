function autorizar(...perfisPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !perfisPermitidos.includes(req.usuario.tipo_usuario)) {
      return res.status(403).json({
        error: "Você não tem permissão para realizar esta ação."
      });
    }

    next();
  };
}

module.exports = autorizar;
