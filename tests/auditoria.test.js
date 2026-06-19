const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  sanitizarDetalhes,
  acaoDaRequisicao,
  deveAuditar
} = require("../src/services/auditoria");

test("auditoria remove senhas e resume arquivos binarios", () => {
  const resultado = sanitizarDetalhes({
    usuario: "Jose",
    senha: "segredo",
    nova_senha: "outro segredo",
    arquivo: Buffer.from("conteudo")
  });
  assert.equal(resultado.usuario, "Jose");
  assert.equal(resultado.senha, "[protegido]");
  assert.equal(resultado.nova_senha, "[protegido]");
  assert.match(resultado.arquivo, /arquivo binario/);
});

test("auditoria reconhece operacoes e ignora listagens da propria tela", () => {
  assert.equal(acaoDaRequisicao({
    method: "PUT",
    route: { path: "/api/controle-asbuilt/:id/dados" }
  }), "ATUALIZAR_ASBUILT_SGO");
  assert.equal(deveAuditar({ method: "GET", path: "/api/admin/logs" }), false);
  assert.equal(deveAuditar({ method: "GET", path: "/controle-asbuilt" }), true);
  assert.equal(deveAuditar({ method: "PUT", path: "/api/controle-asbuilt/1" }), true);
});

test("pagina e API de logs exigem administrador", () => {
  const routes = fs.readFileSync(path.join(__dirname, "../src/routes/routes.js"), "utf8");
  const layout = fs.readFileSync(path.join(__dirname, "../src/public/common/scripts/layout.js"), "utf8");
  assert.match(routes, /router\.get\("\/logs", verificarToken, exigirAdmin/);
  assert.match(routes, /router\.get\("\/api\/admin\/logs", verificarToken, exigirAdmin/);
  assert.match(layout, /href: "\/logs"[\s\S]*adminOnly: true/);
});

test("controle possui atualizacao de todos os V2 com progresso", () => {
  const routes = fs.readFileSync(path.join(__dirname, "../src/routes/routes.js"), "utf8");
  const html = fs.readFileSync(path.join(__dirname, "../src/public/pages/controle-asbuilt/index.html"), "utf8");
  const script = fs.readFileSync(path.join(__dirname, "../src/public/pages/controle-asbuilt/script.js"), "utf8");
  assert.match(routes, /"\/api\/controle-asbuilt\/sgo-v2"/);
  assert.match(html, /id="btnAtualizarV2Sgo"/);
  assert.match(html, /id="v2ProgressBar"/);
  assert.match(script, /async function atualizarTodosV2Sgo/);
  assert.match(script, /consultarDadosProjeto\(registro\.projeto, registro\)/);
});
