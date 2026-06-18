function autorizar(...permissoesPermitidas) {
  return (req, res, next) => {
    const permissoes = new Set(req.usuario?.permissoes || []);

    if (!req.usuario || !permissoesPermitidas.some(permissao => permissoes.has(permissao))) {
      if (req.method === "GET" && !req.originalUrl.startsWith("/api/")) {
        const destinos = [
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
        return res.redirect(destinos.find(([permissao]) => permissoes.has(permissao))?.[1] || "/");
      }
      return res.status(403).json({
        error: "Você não tem permissão para realizar esta ação."
      });
    }

    next();
  };
}

module.exports = autorizar;
