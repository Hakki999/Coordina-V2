const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("consulta SGO reproduz as opcoes do fetch original", () => {
  const arquivo = fs.readFileSync(
    path.join(__dirname, "../src/public/pages/medicao/get-sgo/sgo-client.js"),
    "utf8"
  );
  assert.match(arquivo, /referrer:\s*`\$\{BASE\}\/`/);
  assert.match(arquivo, /mode:\s*"cors"/);
  assert.match(arquivo, /targetAddressSpace:\s*"local"/);
  assert.match(arquivo, /executar\("include"\)/);
  assert.match(arquivo, /executar\("omit"\)/);
});

test("aplicacao permite solicitacao de acesso a rede local", () => {
  const arquivo = fs.readFileSync(
    path.join(__dirname, "../src/app.js"),
    "utf8"
  );
  assert.match(arquivo, /local-network=\(self\)/);
  assert.match(arquivo, /local-network-access=\(self\)/);
});
