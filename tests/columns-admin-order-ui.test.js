const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const exigirAdmin = require("../src/middlewares/exigir-admin");

test("middleware permite admin e bloqueia outros perfis", () => {
  let continuou = false;
  exigirAdmin(
    { usuario: { tipo_usuario: "admin" } },
    {},
    () => { continuou = true; }
  );
  assert.equal(continuou, true);

  let statusEnviado = null;
  let corpoEnviado = null;
  exigirAdmin(
    { usuario: { tipo_usuario: "programacao" } },
    {
      status(status) {
        statusEnviado = status;
        return this;
      },
      json(corpo) {
        corpoEnviado = corpo;
        return this;
      }
    },
    () => assert.fail("Perfil nao-admin nao deve continuar.")
  );
  assert.equal(statusEnviado, 403);
  assert.match(corpoEnviado.error, /Apenas administradores/);
});

test("validacoes e exclusao de colunas ficam restritas ao admin", () => {
  const routes = fs.readFileSync(path.join(__dirname, "../src/routes/routes.js"), "utf8");
  const script = fs.readFileSync(path.join(__dirname, "../src/public/pages/controle-asbuilt/script.js"), "utf8");
  const html = fs.readFileSync(path.join(__dirname, "../src/public/pages/controle-asbuilt/index.html"), "utf8");

  assert.match(routes, /require\("\.\.\/middlewares\/exigir-admin"\)/);
  assert.match(routes, /router\.post\("\/api\/controle-asbuilt\/colunas"[\s\S]*exigirAdmin[\s\S]*criarColuna/);
  assert.match(routes, /router\.put\("\/api\/controle-asbuilt\/colunas\/:campo"[\s\S]*exigirAdmin[\s\S]*atualizarColuna/);
  assert.match(routes, /router\.delete\("\/api\/controle-asbuilt\/colunas\/:campo"[\s\S]*exigirAdmin[\s\S]*excluirColuna/);
  assert.match(script, /podeAdministrarColunas = administrador/);
  assert.match(script, /btnValidacoes"\)\.hidden = !podeAdministrarColunas/);
  assert.match(script, /btnExcluirColunasDB"\)\.hidden = !podeAdministrarColunas/);
  assert.match(html, /id="btnValidacoes"[^>]*hidden/);
  assert.match(html, /id="btnExcluirColunasDB"[^>]*hidden/);
});

test("seletor de colunas permite arrastar e persistir ordem", () => {
  const script = fs.readFileSync(path.join(__dirname, "../src/public/pages/controle-asbuilt/script.js"), "utf8");
  const style = fs.readFileSync(path.join(__dirname, "../src/public/pages/controle-asbuilt/style.css"), "utf8");

  assert.match(script, /CHAVE_ORDEM_COLUNAS/);
  assert.match(script, /class="column-option" draggable="true"/);
  assert.match(script, /addEventListener\("dragstart", iniciarArrasteColuna\)/);
  assert.match(script, /addEventListener\("dragover", arrastarSobreColuna\)/);
  assert.match(script, /localStorage\.setItem\(CHAVE_ORDEM_COLUNAS/);
  assert.match(style, /\.column-drag-handle/);
  assert.match(style, /\.column-option\.is-dragging/);
});
