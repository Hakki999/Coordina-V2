const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("interface possui area explicita para excluir colunas do banco", () => {
  const html = fs.readFileSync(
    path.join(__dirname, "../src/public/pages/controle-asbuilt/index.html"),
    "utf8"
  );
  const script = fs.readFileSync(
    path.join(__dirname, "../src/public/pages/controle-asbuilt/script.js"),
    "utf8"
  );
  assert.match(html, /id="btnExcluirColunasDB"/);
  assert.match(html, /id="listaColunasBanco"/);
  assert.match(html, /Excluir colunas do banco de dados/);
  assert.match(script, /data-delete-db-column/);
  assert.match(script, /Excluir do banco/);
});
