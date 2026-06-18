const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("consulta SGO nao tenta forcar referrer de outra origem", () => {
  const arquivo = fs.readFileSync(
    path.join(__dirname, "../src/public/pages/medicao/get-sgo/sgo-client.js"),
    "utf8"
  );
  assert.doesNotMatch(arquivo, /\breferrer\s*:/);
  assert.match(arquivo, /referrerPolicy:\s*"no-referrer"/);
});
