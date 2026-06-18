function erroFormula(mensagem) {
  const error = new Error(mensagem);
  error.status = 400;
  return error;
}

function tokenizarFormula(formula) {
  const texto = String(formula || "").trim();
  if (!texto) return [];
  if (!texto.startsWith("=")) throw erroFormula("A formula deve comecar com =.");

  const tokens = [];
  let indice = 1;
  while (indice < texto.length) {
    const caractere = texto[indice];
    if (/\s/.test(caractere)) {
      indice += 1;
      continue;
    }
    if ("+-*/%()".includes(caractere)) {
      tokens.push({ tipo: caractere, valor: caractere });
      indice += 1;
      continue;
    }
    const numero = texto.slice(indice).match(/^(?:\d+(?:[.,]\d+)?|[.,]\d+)/);
    if (numero) {
      tokens.push({ tipo: "numero", valor: Number(numero[0].replace(",", ".")) });
      indice += numero[0].length;
      continue;
    }
    const campo = texto.slice(indice).match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
    if (campo) {
      tokens.push({ tipo: "campo", valor: campo[0] });
      indice += campo[0].length;
      continue;
    }
    throw erroFormula(`Caractere invalido na formula: ${caractere}.`);
  }
  return tokens;
}

function compilarFormula(formula) {
  const tokens = tokenizarFormula(formula);
  if (!tokens.length) return null;
  let indice = 0;
  const referencias = new Set();

  function atual() {
    return tokens[indice];
  }

  function consumir(tipo) {
    if (atual()?.tipo !== tipo) return null;
    const token = atual();
    indice += 1;
    return token;
  }

  function primario() {
    const numero = consumir("numero");
    if (numero) return { tipo: "numero", valor: numero.valor };

    const campo = consumir("campo");
    if (campo) {
      referencias.add(campo.valor);
      return { tipo: "campo", campo: campo.valor };
    }

    if (consumir("(")) {
      const expressao = soma();
      if (!consumir(")")) throw erroFormula("Feche os parenteses da formula.");
      return expressao;
    }
    throw erroFormula("Formula incompleta.");
  }

  function unario() {
    if (consumir("+")) return { tipo: "unario", operador: "+", valor: unario() };
    if (consumir("-")) return { tipo: "unario", operador: "-", valor: unario() };
    return primario();
  }

  function produto() {
    let esquerda = unario();
    while (["*", "/", "%"].includes(atual()?.tipo)) {
      const operador = atual().tipo;
      indice += 1;
      esquerda = { tipo: "binario", operador, esquerda, direita: unario() };
    }
    return esquerda;
  }

  function soma() {
    let esquerda = produto();
    while (["+", "-"].includes(atual()?.tipo)) {
      const operador = atual().tipo;
      indice += 1;
      esquerda = { tipo: "binario", operador, esquerda, direita: produto() };
    }
    return esquerda;
  }

  const ast = soma();
  if (indice !== tokens.length) throw erroFormula("Formula invalida.");
  return { ast, referencias: [...referencias] };
}

function numeroFormula(valor) {
  if (valor === null || valor === undefined || valor === "") return 0;
  if (typeof valor === "boolean") return valor ? 1 : 0;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;

  let texto = String(valor).trim().replace(/\s/g, "").replace(/^R\$/i, "");
  if (!texto) return 0;
  if (texto.includes(",")) texto = texto.replace(/\./g, "").replace(",", ".");
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : 0;
}

function avaliarFormula(compilada, resolverCampo) {
  if (!compilada) return null;

  function avaliar(no) {
    if (no.tipo === "numero") return no.valor;
    if (no.tipo === "campo") return numeroFormula(resolverCampo(no.campo));
    if (no.tipo === "unario") {
      const valor = avaliar(no.valor);
      return no.operador === "-" ? -valor : valor;
    }

    const esquerda = avaliar(no.esquerda);
    const direita = avaliar(no.direita);
    if (no.operador === "+") return esquerda + direita;
    if (no.operador === "-") return esquerda - direita;
    if (no.operador === "*") return esquerda * direita;
    if (no.operador === "/") {
      if (direita === 0) throw erroFormula("Divisao por zero.");
      return esquerda / direita;
    }
    if (no.operador === "%") {
      if (direita === 0) throw erroFormula("Divisao por zero.");
      return esquerda % direita;
    }
    throw erroFormula("Operador invalido.");
  }

  const resultado = avaliar(compilada.ast);
  return Number.isFinite(resultado) ? resultado : null;
}

function formatarResultadoFormula(valor, tipo) {
  if (valor === null || valor === undefined || !Number.isFinite(Number(valor))) return null;
  const numero = Number(valor);
  if (tipo === "moeda") return numero.toFixed(2);
  return String(Number(numero.toFixed(10)));
}

function validarDependenciasFormulas(colunas) {
  const porCampo = new Map(colunas.map(coluna => [coluna.campo, coluna]));
  const compiladas = new Map();

  for (const coluna of colunas) {
    if (!coluna.formula) continue;
    const compilada = compilarFormula(coluna.formula);
    for (const referencia of compilada.referencias) {
      if (!porCampo.has(referencia)) {
        throw erroFormula(`A formula de ${coluna.titulo || coluna.campo} usa a coluna inexistente ${referencia}.`);
      }
      if (referencia === coluna.campo) {
        throw erroFormula(`A formula de ${coluna.titulo || coluna.campo} nao pode usar a propria coluna.`);
      }
    }
    compiladas.set(coluna.campo, compilada);
  }

  const estado = new Map();
  function visitar(campo, caminho = []) {
    if (estado.get(campo) === "concluido") return;
    if (estado.get(campo) === "visitando") {
      throw erroFormula(`Formula circular entre as colunas: ${[...caminho, campo].join(" -> ")}.`);
    }
    estado.set(campo, "visitando");
    for (const referencia of compiladas.get(campo)?.referencias || []) {
      if (compiladas.has(referencia)) visitar(referencia, [...caminho, campo]);
    }
    estado.set(campo, "concluido");
  }
  for (const campo of compiladas.keys()) visitar(campo);
  return compiladas;
}

function aplicarFormulas(registros, colunas) {
  const compiladas = validarDependenciasFormulas(colunas);
  if (!compiladas.size) return registros;
  const porCampo = new Map(colunas.map(coluna => [coluna.campo, coluna]));

  for (const registro of registros) {
    const cache = new Map();
    const resolvendo = new Set();

    function resolver(campo) {
      if (cache.has(campo)) return cache.get(campo);
      const coluna = porCampo.get(campo);
      if (!coluna?.formula) return registro[campo];
      if (resolvendo.has(campo)) return null;
      resolvendo.add(campo);
      let valor = null;
      try {
        valor = formatarResultadoFormula(
          avaliarFormula(compiladas.get(campo), referencia => resolver(referencia)),
          coluna.tipo
        );
      } catch {
        valor = null;
      }
      resolvendo.delete(campo);
      cache.set(campo, valor);
      registro[campo] = valor;
      return valor;
    }

    for (const campo of compiladas.keys()) resolver(campo);
  }
  return registros;
}

module.exports = {
  tokenizarFormula,
  compilarFormula,
  avaliarFormula,
  formatarResultadoFormula,
  validarDependenciasFormulas,
  aplicarFormulas
};
