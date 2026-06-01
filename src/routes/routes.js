const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');
const verificarToken = require('../middlewares/verificar-token');
const { listarMateriais } = require("../controllers/get_materiais");
const criarSolicitacao = require("../controllers/criar_solicitacao");
const listarSolicitacoes = require("../controllers/listarSolicitacoes");
const alterarConfig = require("../controllers/config-materiais");

router.get('/', (req, res) => {
  res.sendFile('login.html', { root: './src/public' });
});

router.get('/home', verificarToken, (req, res) => {
  res.sendFile('home.html', { root: './src/public' });
});

router.get('/solicitar-materiais', verificarToken, (req, res) => {
  res.sendFile('solicitar-materiais.html', { root: './src/public' });
});

router.get('/solicitacoes', verificarToken, (req, res) => {
  res.sendFile('solicitacoes.html', { root: './src/public' });
});

router.get('/configuracoes', verificarToken, (req, res) => {
  res.sendFile('configuracoes.html', { root: './src/public' });
});

router.get("/perfil", verificarToken, (req, res) => {
  res.json({
    usuario: req.usuario,
    id_usuario: req.usuario.id_usuario
  });
});

//---------------------------------------------

router.post("/listar-materiais", verificarToken, async (req, res) => {
  try {
    const materiais = await listarMateriais();

    res.json(materiais);
  } catch (error) {
    console.error("Erro ao obter materiais:", error);

    res.status(500).json({
      error: "Erro ao obter materiais"
    });
  }
});

router.post("/solicitar-materiais", verificarToken, async (req, res) => {
  try {
    await criarSolicitacao(req, res);

    res.json({
      message: "Solicitação criada com sucesso"
    });
  } catch (error) {
    console.error("Erro ao criar solicitação:", error);

    res.status(500).json({
      error: "Erro ao criar solicitação"
    });
  }
});

router.post("/listar-solicitacoes", verificarToken, async (req, res) => {
  try {
    const todasSolicitacoes = await listarSolicitacoes(req, res);

    res.json(todasSolicitacoes);
  } catch (error) {
    console.error("Erro ao listar solicitações:", error);

    res.status(500).json({
      error: "Erro ao listar solicitações"
    });
  }
});

router.post("/listar-solicitacoes-por-id", verificarToken, async (req, res) => {
  try {
    const { id_usuario } = req.body;

    const solicitacoes = await listarSolicitacoesPorId(id_usuario);

    res.json(solicitacoes);
  } catch (error) {
    console.error("Erro ao listar solicitações:", error);

    res.status(500).json({
      error: "Erro ao listar solicitações"
    });
  }
});

router.post("/salvar-config-listas-materiais", verificarToken, alterarConfig);
//---------------------------------------------

router.post("/logout", (req, res) => {
  res.clearCookie("token");

  res.json({
    message: "Logout realizado com sucesso"
  });
});

router.post('/login', authController.login);

module.exports = router;