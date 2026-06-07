const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth");
const verificarToken = require("../middlewares/verificar-token");
const autorizar = require("../middlewares/autorizar");
const rateLimit = require("../middlewares/rate-limit");
const { listarMateriais } = require("../controllers/get_materiais");
const criarSolicitacao = require("../controllers/criar_solicitacao");
const listarSolicitacoes = require("../controllers/listarSolicitacoes");
const alterarConfig = require("../controllers/config-materiais");
const { listarUsuarios, criarUsuario } = require("../controllers/usuarios");
const { atualizarQuantidades, cancelarSolicitacao } = require("../controllers/operar-solicitacoes");
const exportarSolicitacoes = require("../controllers/exportar-solicitacoes");

const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Muitas tentativas de login. Aguarde alguns minutos."
});

router.get("/", (req, res) => res.sendFile("pages/login/index.html", { root: "./src/public" }));
router.get("/home", verificarToken, (req, res) => res.sendFile("pages/home/index.html", { root: "./src/public" }));
router.get("/solicitar-materiais", verificarToken, autorizar("admin", "almoxarifado", "programacao"), (req, res) => res.sendFile("pages/solicitar-materiais/index.html", { root: "./src/public" }));
router.get("/solicitacoes", verificarToken, autorizar("admin", "almoxarifado", "programacao"), (req, res) => res.sendFile("pages/solicitacoes/index.html", { root: "./src/public" }));
router.get("/configuracoes", verificarToken, autorizar("admin", "almoxarifado"), (req, res) => res.sendFile("pages/configuracoes/index.html", { root: "./src/public" }));
router.get("/perfis", verificarToken, autorizar("admin"), (req, res) => res.sendFile("pages/perfis/index.html", { root: "./src/public" }));

router.get("/perfil", verificarToken, (req, res) => {
  res.json({
    usuario: {
      id: req.usuario.id,
      nome: req.usuario.nome,
      tipo_usuario: req.usuario.tipo_usuario,
      regional: req.usuario.regional
    }
  });
});

router.get("/api/materiais", verificarToken, autorizar("admin", "almoxarifado", "programacao"), async (req, res, next) => {
  try {
    res.json(await listarMateriais(req.usuario.regional));
  } catch (error) {
    next(error);
  }
});

router.post("/api/solicitacoes", verificarToken, autorizar("admin", "almoxarifado", "programacao"), async (req, res, next) => {
  try {
    await criarSolicitacao(req);
    res.status(201).json({ message: "Solicitação criada com sucesso." });
  } catch (error) {
    next(error);
  }
});

router.get("/api/solicitacoes", verificarToken, autorizar("admin", "almoxarifado", "programacao"), async (req, res, next) => {
  try {
    res.json(await listarSolicitacoes(req.usuario.regional));
  } catch (error) {
    next(error);
  }
});
router.get("/api/solicitacoes-exportar", verificarToken, autorizar("admin", "almoxarifado", "programacao"), exportarSolicitacoes);

router.put(
  "/api/solicitacoes/itens/:itemId",
  verificarToken,
  autorizar("almoxarifado"),
  atualizarQuantidades
);
router.patch(
  "/api/solicitacoes/:id/cancelar",
  verificarToken,
  autorizar("admin", "almoxarifado", "programacao"),
  cancelarSolicitacao
);
router.put("/api/materiais", verificarToken, autorizar("admin", "almoxarifado"), alterarConfig);
router.get("/api/usuarios", verificarToken, autorizar("admin"), listarUsuarios);
router.post("/api/usuarios", verificarToken, autorizar("admin"), criarUsuario);

router.post("/logout", verificarToken, (req, res) => {
  res.clearCookie("token", { path: "/" });
  res.json({ message: "Logout realizado com sucesso." });
});

router.post("/login", loginLimit, authController.login);
router.put("/api/minha-senha", verificarToken, authController.alterarSenha);

module.exports = router;
