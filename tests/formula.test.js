const test = require("node:test");
const assert = require("node:assert/strict");
const {
  compilarFormula,
  avaliarFormula,
  validarDependenciasFormulas,
  aplicarFormulas
} = require("../src/utils/formula");

test("calcula referencias com precedencia e parenteses", () => {
  const formula = compilarFormula("=(valor-adiantado)*2");
  const resultado = avaliarFormula(formula, campo => ({ valor: "100,50", adiantado: "20.25" })[campo]);
  assert.equal(resultado, 160.5);
});

test("considera campos vazios como zero", () => {
  const formula = compilarFormula("=x-y");
  assert.equal(avaliarFormula(formula, campo => ({ x: "10", y: null })[campo]), 10);
});

test("rejeita referencias inexistentes e ciclos", () => {
  assert.throws(
    () => validarDependenciasFormulas([{ campo: "total", titulo: "Total", formula: "=inexistente+1" }]),
    /inexistente/
  );
  assert.throws(
    () => validarDependenciasFormulas([
      { campo: "a", titulo: "A", formula: "=b+1" },
      { campo: "b", titulo: "B", formula: "=a+1" }
    ]),
    /circular/
  );
});

test("aplica formulas encadeadas aos registros", () => {
  const registros = [{ valor: "100.00", adiantado: "25.00" }];
  const colunas = [
    { campo: "valor", titulo: "Valor", tipo: "moeda" },
    { campo: "adiantado", titulo: "Adiantado", tipo: "moeda" },
    { campo: "saldo", titulo: "Saldo", tipo: "moeda", formula: "=valor-adiantado" },
    { campo: "dobro", titulo: "Dobro", tipo: "numero", formula: "=saldo*2" }
  ];
  aplicarFormulas(registros, colunas);
  assert.equal(registros[0].saldo, "75.00");
  assert.equal(registros[0].dobro, "150");
});
