const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const escapar = valor => String(valor ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
let filtrosDisponiveis = [];
let ultimoResultado = null;
let filtrosRestaurados = false;
const CHAVE_FILTROS = "dashboard-asbuilt-filtros-v1";

function barras(id, itens) {
  const max = Math.max(1, ...itens.map(item => Number(item.quantidade)));
  document.getElementById(id).innerHTML = itens.length ? itens.map(item => `
    <div class="bar-item"><div><strong>${escapar(item.status)}</strong><span>${item.quantidade} | ${moeda.format(item.valor)}</span></div><i style="--w:${Number(item.quantidade) / max * 100}%"></i></div>
  `).join("") : '<p class="empty">Sem dados.</p>';
}

function graficoEvolucao(id, itens) {
  const max = Math.max(1, ...itens.map(item => Number(item.quantidade)));
  document.getElementById(id).innerHTML = itens.length ? itens.map(item => `
    <div><span>${escapar(item.mes)}</span><i style="--h:${Number(item.quantidade) / max * 100}%"></i><strong>${item.quantidade}</strong></div>
  `).join("") : '<p class="empty">Sem dados.</p>';
}

function opcoesColunas(selecionada = "") {
  return filtrosDisponiveis.map(coluna => `<option value="${escapar(coluna.campo)}" ${coluna.campo === selecionada ? "selected" : ""}>${escapar(coluna.titulo)}</option>`).join("");
}

function opcoesOperadores(selecionado = "contem") {
  return [
    ["contem", "Contem"], ["igual", "Igual a"], ["vazio", "Esta vazio"],
    ["preenchido", "Esta preenchido"], ["maior_igual", "Maior ou igual"], ["menor_igual", "Menor ou igual"]
  ].map(([valor, texto]) => `<option value="${valor}" ${valor === selecionado ? "selected" : ""}>${texto}</option>`).join("");
}

function controleValor(coluna, valor = "") {
  if (!coluna) return '<input data-filter-value>';
  if (coluna.tipo === "lista") {
    return `<select data-filter-value><option value=""></option>${(coluna.opcoes || []).map(opcao => `<option value="${escapar(opcao)}" ${opcao === valor ? "selected" : ""}>${escapar(opcao)}</option>`).join("")}</select>`;
  }
  const tipo = coluna.tipo === "data" ? "date" : (["numero", "moeda"].includes(coluna.tipo) ? "number" : "text");
  return `<input data-filter-value type="${tipo}" value="${escapar(valor)}" placeholder="Valor do filtro">`;
}

function linhaFiltro(filtro = {}) {
  const coluna = filtrosDisponiveis.find(item => item.campo === filtro.campo) || filtrosDisponiveis[0];
  return `
    <div class="filter-row">
      <select data-filter-field>${opcoesColunas(coluna?.campo)}</select>
      <select data-filter-operator>${opcoesOperadores(filtro.operador)}</select>
      <span data-filter-value-wrap>${controleValor(coluna, filtro.valor)}</span>
      <button type="button" class="remove-filter" data-remove-filter title="Remover filtro">x</button>
    </div>
  `;
}

function adicionarFiltro(filtro = {}) {
  if (!filtrosDisponiveis.length) return;
  document.getElementById("filtrosDashboard").insertAdjacentHTML("beforeend", linhaFiltro(filtro));
}

function coletarFiltros() {
  return [...document.querySelectorAll(".filter-row")].map(row => ({
    campo: row.querySelector("[data-filter-field]").value,
    operador: row.querySelector("[data-filter-operator]").value,
    valor: row.querySelector("[data-filter-value]")?.value || ""
  })).filter(item => item.campo && (item.valor || ["vazio", "preenchido"].includes(item.operador)));
}

function renderizarIndividual(individual) {
  const metricas = individual?.metricas || {};
  document.getElementById("metricasIndividuais").innerHTML = individual ? `
    <div><span>Projetos</span><strong>${metricas.total || 0}</strong></div>
    <div><span>Concluidos</span><strong>${metricas.concluidos || 0}</strong></div>
    <div><span>Este mes</span><strong>${metricas.concluidos_mes || 0}</strong></div>
    <div><span>Pendentes</span><strong>${metricas.pendentes || 0}</strong></div>
    <div><span>Valor</span><strong>${moeda.format(metricas.valor || 0)}</strong></div>
  ` : '<p class="empty">Sem colaborador para os filtros atuais.</p>';
  document.getElementById("projetosIndividuais").innerHTML = individual?.recentes?.length ? individual.recentes.map(item => `
    <tr><td><strong>${escapar(item.projeto || "-")}</strong></td><td>${escapar(item.nome || "-")}</td><td>${item.data_asbuilt ? String(item.data_asbuilt).slice(0, 10).split("-").reverse().join("/") : "-"}</td><td>${escapar(item.status_sgo || item.status_sap || item.status || "-")}</td></tr>
  `).join("") : '<tr><td colspan="4" class="empty">Sem projetos.</td></tr>';
  graficoEvolucao("evolucaoIndividual", individual?.mensal || []);
}

function renderizar(data) {
  ultimoResultado = data;
  filtrosDisponiveis = data.filtrosDisponiveis || filtrosDisponiveis;
  const t = data.totais || {};
  document.getElementById("total").textContent = t.total || 0;
  document.getElementById("concluidos").textContent = t.concluidos || 0;
  document.getElementById("pendentes").textContent = t.pendentes || 0;
  document.getElementById("valor").textContent = moeda.format(t.valor_total || 0);
  document.getElementById("valorMes").textContent = moeda.format(t.valor_mes || 0);
  document.getElementById("resumoFiltro").textContent = coletarFiltros().length ? `${coletarFiltros().length} filtro(s) aplicado(s).` : "Visao geral da regional.";
  document.getElementById("colaboradores").innerHTML = data.colaboradores.length ? data.colaboradores.map(item => `
    <tr data-person="${escapar(item.colaborador)}"><td><button type="button" class="person-link">${escapar(item.colaborador)}</button></td><td>${item.quantidade}</td><td>${item.concluidos}</td><td>${item.concluidos_mes}</td><td>${moeda.format(item.valor)}</td><td>${Math.round(Number(item.concluidos) / Math.max(1, Number(item.quantidade)) * 100)}%</td></tr>
  `).join("") : '<tr><td colspan="6" class="empty">Sem dados.</td></tr>';
  document.getElementById("pessoaSelecionada").innerHTML = data.colaboradores.map(item => `<option value="${escapar(item.colaborador)}" ${item.colaborador === data.individual?.pessoa ? "selected" : ""}>${escapar(item.colaborador)}</option>`).join("");
  renderizarIndividual(data.individual);
  barras("statusSap", data.statusSap);
  barras("statusSgo", data.statusSgo);
  graficoEvolucao("evolucao", data.evolucao);
}

async function carregar(pessoa = document.getElementById("pessoaSelecionada").value) {
  try {
    const params = new URLSearchParams();
    const filtros = coletarFiltros();
    if (filtros.length) params.set("filtros", JSON.stringify(filtros));
    if (pessoa) params.set("pessoa", pessoa);
    const response = await fetch(`/api/dashboard-asbuilt?${params.toString()}`, { credentials: "include" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    renderizar(data);
    if (!filtrosRestaurados && filtrosDisponiveis.length) {
      filtrosRestaurados = true;
      let salvos = [];
      try { salvos = JSON.parse(localStorage.getItem(CHAVE_FILTROS)) || []; } catch {}
      document.getElementById("filtrosDashboard").innerHTML = "";
      if (salvos.length) {
        salvos.forEach(adicionarFiltro);
        return carregar("");
      }
      adicionarFiltro();
    } else if (!document.querySelector(".filter-row") && filtrosDisponiveis.length) {
      adicionarFiltro();
    }
  } catch (error) {
    msgErro(error.message || "Erro ao carregar dashboard.");
  }
}

document.getElementById("btnAtualizar").addEventListener("click", () => carregar());
document.getElementById("btnAplicarFiltros").addEventListener("click", () => {
  localStorage.setItem(CHAVE_FILTROS, JSON.stringify(coletarFiltros()));
  carregar("");
});
document.getElementById("btnAdicionarFiltro").addEventListener("click", () => adicionarFiltro());
document.getElementById("btnLimparFiltros").addEventListener("click", () => {
  document.getElementById("filtrosDashboard").innerHTML = "";
  localStorage.removeItem(CHAVE_FILTROS);
  adicionarFiltro();
  carregar("");
});
document.getElementById("pessoaSelecionada").addEventListener("change", event => carregar(event.target.value));
document.getElementById("colaboradores").addEventListener("click", event => {
  const linha = event.target.closest("[data-person]");
  if (linha) carregar(linha.dataset.person);
});
document.getElementById("filtrosDashboard").addEventListener("click", event => {
  if (event.target.matches("[data-remove-filter]")) event.target.closest(".filter-row").remove();
});
document.getElementById("filtrosDashboard").addEventListener("change", event => {
  const row = event.target.closest(".filter-row");
  if (!row) return;
  if (event.target.matches("[data-filter-field]")) {
    const coluna = filtrosDisponiveis.find(item => item.campo === event.target.value);
    row.querySelector("[data-filter-value-wrap]").innerHTML = controleValor(coluna);
  }
  if (event.target.matches("[data-filter-operator]")) {
    row.querySelector("[data-filter-value-wrap]").hidden = ["vazio", "preenchido"].includes(event.target.value);
  }
});

carregar("");
