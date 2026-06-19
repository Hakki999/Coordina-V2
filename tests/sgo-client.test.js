const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const caminhoCliente = path.join(__dirname, "../src/public/pages/medicao/get-sgo/sgo-client.js");

function carregarCliente(fetch) {
  const window = { isSecureContext: true };
  vm.runInNewContext(fs.readFileSync(caminhoCliente, "utf8"), {
    window,
    fetch,
    AbortController,
    setTimeout,
    clearTimeout,
    Date,
    Promise,
    JSON,
    String,
    Number,
    Object,
    Array,
    Set,
    Map,
    Error,
    TypeError
  });
  return window.sgoClient;
}

test("consulta SGO reproduz as opcoes do fetch original", () => {
  const arquivo = fs.readFileSync(caminhoCliente, "utf8");
  assert.match(arquivo, /referrer:\s*`\$\{BASE\}\/`/);
  assert.match(arquivo, /mode:\s*"cors"/);
  assert.match(arquivo, /targetAddressSpace:\s*"local"/);
  assert.match(arquivo, /credenciaisPreferidas/);
  assert.match(arquivo, /LIMITE_REQUISICOES_SGO\s*=\s*6/);
});

test("aplicacao permite solicitacao de acesso a rede local", () => {
  const arquivo = fs.readFileSync(
    path.join(__dirname, "../src/app.js"),
    "utf8"
  );
  assert.match(arquivo, /local-network=\(self\)/);
  assert.match(arquivo, /local-network-access=\(self\)/);
});

test("processa projetos em paralelo respeitando o limite informado", async () => {
  const cliente = carregarCliente(async () => {
    throw new Error("fetch nao deveria ser chamado");
  });
  let ativas = 0;
  let maximo = 0;
  const resultados = await cliente.processarEmParalelo([1, 2, 3, 4, 5], async valor => {
    ativas += 1;
    maximo = Math.max(maximo, ativas);
    await new Promise(resolve => setTimeout(resolve, 10));
    ativas -= 1;
    return valor * 2;
  }, 3);
  assert.deepEqual(Array.from(resultados), [2, 4, 6, 8, 10]);
  assert.equal(maximo, 3);
});

test("pipeline executa etapas independentes na mesma rodada", async () => {
  let ativas = 0;
  let maximo = 0;
  const cliente = carregarCliente(async url => {
    ativas += 1;
    maximo = Math.max(maximo, ativas);
    await new Promise(resolve => setTimeout(resolve, 10));
    ativas -= 1;
    const dados = url.includes("ListarSolicitacaoInvestimentoPorNota") ? { SliId: "99" } : { ok: true };
    return { ok: true, status: 200, text: async () => JSON.stringify(dados) };
  });
  const configuracao = {
    etapas: [
      { id: "nota", tipo: "Notas", entrada: "$input", ativo: true },
      { id: "fluxo", tipo: "FluxoNota", entrada: "$steps.nota.SliId", ativo: true },
      { id: "orcamento", tipo: "OrcamentoNota", entrada: "$steps.nota.SliId", ativo: true }
    ],
    mapeamentos: []
  };
  const resultado = await cliente.executarPipeline("430145555", configuracao);
  assert.equal(resultado.consultas.length, 3);
  assert.equal(maximo, 2);
});
