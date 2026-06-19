let resultadosSgo = [];
let tabelaAtual = { colunas: [], linhas: [] };
const escapar = valor => String(valor ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

function valorTabela(valor) {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "boolean") return valor ? "true" : "false";
  if (typeof valor === "object") return JSON.stringify(valor);
  if (typeof valor === "string" && valor.startsWith("/Date(")) {
    const timestamp = Number(valor.match(/\d+/)?.[0]);
    if (Number.isFinite(timestamp)) return new Date(timestamp).toLocaleString("pt-BR");
  }
  return String(valor);
}

function objetoPlano(valor) {
  return Object.fromEntries(window.sgoClient.achatar(valor, "").map(item => [
    item.caminho.replace(/^\./, "") || "Valor",
    valorTabela(item.valor)
  ]));
}

function expandirResultado(resultado) {
  const base = {
    ID_Original: resultado.id,
    Tipo_Consulta: resultado.tipo,
    Endpoint: resultado.endpoint,
    Status: resultado.erro ? `Erro: ${resultado.erro}` : resultado.status,
    Data_Consulta: resultado.consultadoEm ? new Date(resultado.consultadoEm).toLocaleString("pt-BR") : ""
  };
  if (resultado.erro) return [base];
  const dados = Array.isArray(resultado.dados) ? resultado.dados : [resultado.dados];
  if (!dados.length) return [base];
  return dados.flatMap(item => {
    if (item?.endpoint && Object.prototype.hasOwnProperty.call(item, "dados")) {
      const internos = Array.isArray(item.dados) ? item.dados : [item.dados];
      return internos.length
        ? internos.map(interno => ({ ...base, Endpoint: item.endpoint, ...objetoPlano(interno) }))
        : [{ ...base, Endpoint: item.endpoint }];
    }
    return [{ ...base, ...objetoPlano(item) }];
  });
}

function montarTabela() {
  const linhas = resultadosSgo.flatMap(expandirResultado);
  const base = ["ID_Original", "Tipo_Consulta", "Endpoint", "Status", "Data_Consulta"];
  const extras = [...new Set(linhas.flatMap(item => Object.keys(item)).filter(item => !base.includes(item)))].sort();
  return { colunas: [...base, ...extras], linhas };
}

function renderizar() {
  tabelaAtual = montarTabela();
  document.getElementById("resultadoResumo").textContent = `${resultadosSgo.length} consulta(s), ${tabelaAtual.linhas.length} linha(s).`;
  const tabela = document.getElementById("tabelaResultados");
  if (!tabelaAtual.linhas.length) {
    tabela.querySelector("thead").innerHTML = "";
    tabela.querySelector("tbody").innerHTML = '<tr><td class="empty-row">Aguardando consulta.</td></tr>';
    return;
  }
  tabela.querySelector("thead").innerHTML = `<tr>${tabelaAtual.colunas.map(coluna => `<th>${escapar(coluna)}</th>`).join("")}</tr>`;
  tabela.querySelector("tbody").innerHTML = tabelaAtual.linhas.map(linha => `<tr>${
    tabelaAtual.colunas.map(coluna => `<td>${escapar(linha[coluna] ?? "")}</td>`).join("")
  }</tr>`).join("");
}

function tabelaTexto(separador = "\t") {
  const limpar = valor => String(valor ?? "").replace(/[\r\n\t]+/g, " ");
  return [
    tabelaAtual.colunas.map(limpar).join(separador),
    ...tabelaAtual.linhas.map(linha => tabelaAtual.colunas.map(coluna => limpar(linha[coluna])).join(separador))
  ].join("\n");
}

document.getElementById("formConsulta").addEventListener("submit", async event => {
  event.preventDefault();
  const tipo = document.getElementById("queryType").value;
  const ids = document.getElementById("queryIds").value.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
  const botao = event.currentTarget.querySelector("button[type=submit]");
  botao.disabled = true;
  try {
    await window.sgoClient.processarEmParalelo(ids, async id => {
      try {
        resultadosSgo.push(await window.sgoClient.consultarSgo(tipo, id));
      } catch (error) {
        resultadosSgo.push({ id, tipo, erro: error.message, consultadoEm: new Date().toISOString() });
      }
      renderizar();
    }, 4);
    msgSucesso("Consultas concluídas. A tabela está pronta para copiar.");
  } finally {
    botao.disabled = false;
  }
});

document.getElementById("btnCopiarTabela").addEventListener("click", async () => {
  if (!tabelaAtual.linhas.length) return msgAviso("Não há resultados para copiar.");
  await navigator.clipboard.writeText(tabelaTexto());
  msgSucesso("Tabela copiada. Ela pode ser colada diretamente no Excel.");
});

document.getElementById("btnExportarCsv").addEventListener("click", () => {
  if (!tabelaAtual.linhas.length) return msgAviso("Não há resultados para exportar.");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["\uFEFF" + tabelaTexto(";")], { type: "text/csv;charset=utf-8" }));
  link.download = `consulta-sgo-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});

document.getElementById("btnExportarJson").addEventListener("click", () => {
  if (!resultadosSgo.length) return msgAviso("Não há resultados para exportar.");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([JSON.stringify(resultadosSgo, null, 2)], { type: "application/json" }));
  link.download = `consulta-sgo-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});

document.getElementById("vpnStatus").textContent = "Fetch direto no navegador • VPN necessária";
document.getElementById("vpnStatus").classList.add("ok");
renderizar();
