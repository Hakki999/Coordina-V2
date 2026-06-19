const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth");
const verificarToken = require("../middlewares/verificar-token");
const autorizar = require("../middlewares/autorizar");
const exigirAdmin = require("../middlewares/exigir-admin");
const rateLimit = require("../middlewares/rate-limit");
const { listarMateriais } = require("../controllers/get_materiais");
const criarSolicitacao = require("../controllers/criar_solicitacao");
const listarSolicitacoes = require("../controllers/listarSolicitacoes");
const alterarConfig = require("../controllers/config-materiais");
const { listarUsuarios, criarUsuario, atualizarUsuario, excluirUsuario } = require("../controllers/usuarios");
const {
  listarAdministracao,
  criarPerfil,
  atualizarPerfil,
  excluirPerfil,
  criarRegional,
  excluirRegional
} = require("../controllers/admin-acessos");
const { atualizarQuantidades, cancelarSolicitacao } = require("../controllers/operar-solicitacoes");
const exportarSolicitacoes = require("../controllers/exportar-solicitacoes");
const controleAsbuilt = require("../controllers/controle-asbuilt");
const exportarControleAsbuilt = require("../controllers/exportar-controle-asbuilt");
const importarControleAsbuilt = require("../controllers/importar-controle-asbuilt");
const asbuiltPendentes = require("../controllers/medicao/asbuilt-pendentes");
const asbuiltDashboard = require("../controllers/medicao/asbuilt-dashboard");
const sgoConfig = require("../controllers/medicao/sgo-config");
const estoque = require("../controllers/almoxarifado/estoque");
const almoxarifadoDashboard = require("../controllers/almoxarifado/dashboard");
const biGpm = require("../controllers/bi/gpm");
const adminLogs = require("../controllers/admin-logs");

const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Muitas tentativas de login. Aguarde alguns minutos."
});

const pagina = arquivo => (req, res) => res.sendFile(arquivo, { root: "./src/public" });

router.get("/", pagina("pages/login/index.html"));
router.get("/home", verificarToken, autorizar("home.visualizar"), pagina("pages/home/index.html"));
router.get("/solicitar-materiais", verificarToken, autorizar("logistica.solicitar"), pagina("pages/solicitar-materiais/index.html"));
router.get("/solicitacoes", verificarToken, autorizar("logistica.solicitacoes.visualizar"), pagina("pages/solicitacoes/index.html"));
router.get("/configuracoes", verificarToken, autorizar("logistica.configuracoes"), pagina("pages/configuracoes/index.html"));
router.get("/teste", verificarToken, autorizar("medicao.asbuilt"), pagina("pages/teste-asbuilt/index.html"));
router.get("/controle-asbuilt", verificarToken, autorizar("medicao.controle_asbuilt.visualizar", "medicao.controle_asbuilt.editar"), pagina("pages/controle-asbuilt/index.html"));
router.get("/asbuilt-pendentes", verificarToken, autorizar("medicao.asbuilt_pendentes"), pagina("pages/medicao/asbuilt-pendentes/index.html"));
router.get("/dashboard-asbuilt", verificarToken, autorizar("medicao.asbuilt_dashboard"), pagina("pages/medicao/asbuilt-dashboard/index.html"));
router.get("/get-sgo", verificarToken, autorizar("medicao.sgo"), pagina("pages/medicao/get-sgo/index.html"));
router.get("/estoque-fisico", verificarToken, autorizar("almoxarifado.estoque"), pagina("pages/almoxarifado/estoque/index.html"));
router.get("/dashboard-almoxarifado", verificarToken, autorizar("almoxarifado.dashboard"), pagina("pages/almoxarifado/dashboard/index.html"));
router.get("/bi-gpm/execucao", verificarToken, autorizar("bi.gpm.visualizar"), pagina("pages/bi-gpm/execucao/index.html"));
router.get("/bi-gpm/stc", verificarToken, autorizar("bi.gpm.visualizar"), pagina("pages/bi-gpm/stc/index.html"));
router.get("/perfis", verificarToken, autorizar("admin.usuarios", "admin.perfis", "admin.regionais"), pagina("pages/perfis/index.html") );
router.get("/logs", verificarToken, exigirAdmin, pagina("pages/admin-logs/index.html"));

router.get("/perfil", verificarToken, (req, res) => {
  res.json({
    usuario: {
      id: req.usuario.id,
      nome: req.usuario.nome,
      tipo_usuario: req.usuario.tipo_usuario,
      perfil_nome: req.usuario.perfil_nome,
      regional: req.usuario.regional,
      permissoes: req.usuario.permissoes
    }
  });
});

router.get("/api/materiais", verificarToken, autorizar("logistica.solicitar", "logistica.configuracoes"), async (req, res, next) => {
  try {
    res.json(await listarMateriais(req.usuario.regional));
  } catch (error) {
    next(error);
  }
});

router.post("/api/solicitacoes", verificarToken, autorizar("logistica.solicitar"), async (req, res, next) => {
  try {
    await criarSolicitacao(req);
    res.status(201).json({ message: "Solicitação criada com sucesso." });
  } catch (error) {
    next(error);
  }
});

router.get("/api/solicitacoes", verificarToken, autorizar("logistica.solicitacoes.visualizar"), async (req, res, next) => {
  try {
    res.json(await listarSolicitacoes(req.usuario.regional));
  } catch (error) {
    next(error);
  }
});
router.get("/api/solicitacoes-exportar", verificarToken, autorizar("logistica.solicitacoes.visualizar"), exportarSolicitacoes);
router.put("/api/solicitacoes/itens/:itemId", verificarToken, autorizar("logistica.solicitacoes.operar"), atualizarQuantidades);
router.patch("/api/solicitacoes/:id/cancelar", verificarToken, autorizar("logistica.solicitacoes.cancelar"), cancelarSolicitacao);
router.put("/api/materiais", verificarToken, autorizar("logistica.configuracoes"), alterarConfig);

router.get(
  "/api/controle-asbuilt",
  verificarToken,
  autorizar("medicao.controle_asbuilt.visualizar", "medicao.controle_asbuilt.editar"),
  controleAsbuilt.listar
);
router.get(
  "/api/controle-asbuilt/exportar",
  verificarToken,
  autorizar("medicao.controle_asbuilt.visualizar", "medicao.controle_asbuilt.editar"),
  exportarControleAsbuilt
);
router.get(
  "/api/controle-asbuilt/sgo-v2",
  verificarToken,
  autorizar("medicao.controle_asbuilt.editar"),
  controleAsbuilt.listarProjetosV2Sgo
);
router.post("/api/controle-asbuilt", verificarToken, autorizar("medicao.controle_asbuilt.editar"), controleAsbuilt.criar);
router.put("/api/controle-asbuilt/atualizar-colunas", verificarToken, autorizar("medicao.controle_asbuilt.editar"), controleAsbuilt.atualizarColunas);
router.get("/api/controle-asbuilt/colunas", verificarToken, autorizar("medicao.controle_asbuilt.editar"), exigirAdmin, controleAsbuilt.listarColunas);
router.get("/api/controle-asbuilt/filtros/:campo", verificarToken, autorizar("medicao.controle_asbuilt.visualizar", "medicao.controle_asbuilt.editar"), controleAsbuilt.sugestoesFiltro);
router.post("/api/controle-asbuilt/colunas", verificarToken, autorizar("medicao.controle_asbuilt.editar"), exigirAdmin, controleAsbuilt.criarColuna);
router.put("/api/controle-asbuilt/colunas/:campo", verificarToken, autorizar("medicao.controle_asbuilt.editar"), exigirAdmin, controleAsbuilt.atualizarColuna);
router.delete("/api/controle-asbuilt/colunas/:campo", verificarToken, autorizar("medicao.controle_asbuilt.editar"), exigirAdmin, controleAsbuilt.excluirColuna);
router.put("/api/controle-asbuilt/:id", verificarToken, autorizar("medicao.controle_asbuilt.editar"), controleAsbuilt.atualizar);
router.put("/api/controle-asbuilt/:id/dados", verificarToken, autorizar("medicao.controle_asbuilt.editar"), controleAsbuilt.atualizarDados);
router.delete("/api/controle-asbuilt/:id", verificarToken, autorizar("medicao.controle_asbuilt.editar"), controleAsbuilt.excluir);
router.get(
  "/api/controle-asbuilt/:id/pdf",
  verificarToken,
  autorizar("medicao.controle_asbuilt.visualizar", "medicao.controle_asbuilt.editar"),
  controleAsbuilt.baixarPdf
);
router.get("/api/asbuilt-pendentes", verificarToken, autorizar("medicao.asbuilt_pendentes"), asbuiltPendentes.listar);
router.post("/api/asbuilt-pendentes", verificarToken, autorizar("medicao.asbuilt_pendentes"), asbuiltPendentes.criar);
router.delete("/api/asbuilt-pendentes/:id", verificarToken, autorizar("medicao.asbuilt_pendentes"), asbuiltPendentes.excluir);
router.put(
  "/api/asbuilt-pendentes/:id/pdf",
  verificarToken,
  autorizar("medicao.asbuilt_pendentes"),
  express.raw({ type: "application/pdf", limit: "20mb" }),
  asbuiltPendentes.enviarPdf
);
router.get("/api/asbuilt-pendentes/:id/pdf", verificarToken, autorizar("medicao.asbuilt_pendentes"), asbuiltPendentes.baixarPdf);
router.get("/api/dashboard-asbuilt", verificarToken, autorizar("medicao.asbuilt_dashboard"), asbuiltDashboard.resumo);
router.get(
  "/api/sgo/config",
  verificarToken,
  autorizar("medicao.sgo", "medicao.controle_asbuilt.visualizar", "medicao.controle_asbuilt.editar", "admin.sgo_config"),
  sgoConfig.obter
);
router.put("/api/admin/sgo/config", verificarToken, autorizar("admin.sgo_config"), sgoConfig.salvar);
router.post(
  "/api/controle-asbuilt/importar/analisar",
  verificarToken,
  autorizar("admin.asbuilt_importar"),
  express.raw({
    type: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"],
    limit: "20mb"
  }),
  importarControleAsbuilt.analisar
);
router.post(
  "/api/controle-asbuilt/importar/simular",
  verificarToken,
  autorizar("admin.asbuilt_importar"),
  express.raw({
    type: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"],
    limit: "20mb"
  }),
  importarControleAsbuilt.simular
);
router.post(
  "/api/controle-asbuilt/importar/executar",
  verificarToken,
  autorizar("admin.asbuilt_importar"),
  express.raw({
    type: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"],
    limit: "20mb"
  }),
  importarControleAsbuilt.executar
);

router.get("/api/almoxarifado/estoque", verificarToken, autorizar("almoxarifado.estoque"), estoque.listar);
router.put("/api/almoxarifado/estoque", verificarToken, autorizar("almoxarifado.estoque"), estoque.salvar);
router.post(
  "/api/almoxarifado/estoque/importar",
  verificarToken,
  autorizar("almoxarifado.estoque"),
  express.raw({
    type: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"],
    limit: "15mb"
  }),
  estoque.importar
);
router.get("/api/almoxarifado/dashboard", verificarToken, autorizar("almoxarifado.dashboard"), almoxarifadoDashboard.resumo);
router.post("/api/bi-gpm/resumo", verificarToken, autorizar("bi.gpm.visualizar"), biGpm.resumo);

router.get("/api/usuarios", verificarToken, autorizar("admin.usuarios"), listarUsuarios);
router.post("/api/usuarios", verificarToken, autorizar("admin.usuarios"), criarUsuario);
router.put("/api/usuarios/:id", verificarToken, autorizar("admin.usuarios"), atualizarUsuario);
router.delete("/api/usuarios/:id", verificarToken, autorizar("admin.usuarios"), excluirUsuario);

router.get("/api/admin/acessos", verificarToken, autorizar("admin.usuarios", "admin.perfis", "admin.regionais"), listarAdministracao);
router.get("/api/admin/logs", verificarToken, exigirAdmin, adminLogs.listar);
router.post("/api/admin/perfis", verificarToken, autorizar("admin.perfis"), criarPerfil);
router.put("/api/admin/perfis/:id", verificarToken, autorizar("admin.perfis"), atualizarPerfil);
router.delete("/api/admin/perfis/:id", verificarToken, autorizar("admin.perfis"), excluirPerfil);
router.post("/api/admin/regionais", verificarToken, autorizar("admin.regionais"), criarRegional);
router.delete("/api/admin/regionais/:id", verificarToken, autorizar("admin.regionais"), excluirRegional);

router.post("/logout", verificarToken, (req, res) => {
  res.clearCookie("token", { path: "/" });
  res.json({ message: "Logout realizado com sucesso." });
});

router.post("/login", loginLimit, authController.login);
router.put("/api/minha-senha", verificarToken, authController.alterarSenha);

module.exports = router;
