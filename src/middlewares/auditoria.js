const {
  sanitizarDetalhes,
  acaoDaRequisicao,
  deveAuditar,
  registrarAuditoria
} = require("../services/auditoria");

function auditoria(req, res, next) {
  let resposta;
  const jsonOriginal = res.json.bind(res);
  res.json = corpo => {
    resposta = sanitizarDetalhes(corpo);
    return jsonOriginal(corpo);
  };

  res.on("finish", () => {
    if (!deveAuditar(req) || !req.usuario) return;
    const detalhes = {
      parametros: req.params,
      consulta: req.query,
      corpo: req.body,
      resposta,
      extras: req.auditoriaDetalhes
    };
    registrarAuditoria({
      usuario: req.usuario,
      acao: acaoDaRequisicao(req),
      metodo: req.method,
      rota: req.originalUrl,
      statusHttp: res.statusCode,
      ip: req.ip || req.socket?.remoteAddress,
      userAgent: req.get("user-agent"),
      detalhes
    }).catch(error => console.error("Falha ao registrar auditoria:", error.message));
  });

  next();
}

module.exports = auditoria;
