let paginaLogs = 1;
let paginacaoLogs = { pagina: 1, total: 0, totalPaginas: 1 };
let logsAtuais = [];
let filtroTimerLogs = null;

const e = valor => String(valor ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

function dataHora(valor) {
  return valor ? new Date(valor).toLocaleString("pt-BR") : "-";
}

function nomeAcao(valor) {
  return String(valor || "").replaceAll("_", " ").toLocaleLowerCase("pt-BR")
    .replace(/(^|\s)\S/g, letra => letra.toLocaleUpperCase("pt-BR"));
}

function parametrosLogs(pagina) {
  const params = new URLSearchParams({ pagina: String(pagina), limite: "100" });
  const campos = {
    usuario: document.getElementById("filtroUsuario").value.trim(),
    acao: document.getElementById("filtroAcao").value,
    status: document.getElementById("filtroStatus").value,
    dataInicio: document.getElementById("filtroInicio").value,
    dataFim: document.getElementById("filtroFim").value
  };
  Object.entries(campos).forEach(([chave, valor]) => { if (valor) params.set(chave, valor); });
  return params;
}

async function carregarLogs(pagina = paginaLogs) {
  document.getElementById("logsResumo").textContent = "Carregando movimentações...";
  try {
    const response = await fetch(`/api/admin/logs?${parametrosLogs(pagina)}`, { credentials: "include" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Não foi possível carregar os logs.");
    logsAtuais = data.logs || [];
    paginacaoLogs = data.paginacao;
    paginaLogs = paginacaoLogs.pagina;
    renderizarAcoes(data.acoes || []);
    renderizarLogs();
  } catch (error) {
    document.getElementById("logsResumo").textContent = "Erro ao carregar.";
    msgErro(error.message);
  }
}

function renderizarAcoes(acoes) {
  const select = document.getElementById("filtroAcao");
  const atual = select.value;
  select.innerHTML = '<option value="">Todas as ações</option>' + acoes.map(acao =>
    `<option value="${e(acao)}" ${acao === atual ? "selected" : ""}>${e(nomeAcao(acao))}</option>`
  ).join("");
}

function renderizarLogs() {
  const corpo = document.getElementById("logsBody");
  corpo.innerHTML = logsAtuais.length ? logsAtuais.map(log => `
    <tr>
      <td><time>${e(dataHora(log.criado_em))}</time></td>
      <td><strong>${e(log.usuario_nome)}</strong><small>${e(log.tipo_usuario || "-")} · ${e(log.regional || "-")}</small></td>
      <td><span class="action-name">${e(nomeAcao(log.acao))}</span><small>${e(log.metodo)}</small></td>
      <td><code title="${e(log.rota)}">${e(log.rota)}</code></td>
      <td><span class="status-chip ${log.sucesso ? "success" : "error"}">${log.status_http}</span></td>
      <td><span>${e(log.ip || "-")}</span></td>
      <td><button type="button" class="detail-button" data-log-id="${log.id}" title="Ver detalhes">Detalhes</button></td>
    </tr>
  `).join("") : '<tr><td colspan="7" class="logs-empty">Nenhuma movimentação encontrada.</td></tr>';

  document.getElementById("logsResumo").textContent = `${paginacaoLogs.total} movimentação(ões) registrada(s)`;
  document.getElementById("logsPagina").textContent = `Página ${paginacaoLogs.pagina} de ${paginacaoLogs.totalPaginas}`;
  document.getElementById("btnLogsAnterior").disabled = paginacaoLogs.pagina <= 1;
  document.getElementById("btnLogsProxima").disabled = paginacaoLogs.pagina >= paginacaoLogs.totalPaginas;
}

function abrirDetalhes(id) {
  const log = logsAtuais.find(item => Number(item.id) === Number(id));
  if (!log) return;
  document.getElementById("logDetalheAcao").textContent = nomeAcao(log.acao);
  document.getElementById("logDetalheMeta").innerHTML = `
    <div><dt>Usuário</dt><dd>${e(log.usuario_nome)} (#${e(log.usuario_id || "-")})</dd></div>
    <div><dt>Data</dt><dd>${e(dataHora(log.criado_em))}</dd></div>
    <div><dt>Requisição</dt><dd>${e(log.metodo)} ${e(log.rota)}</dd></div>
    <div><dt>Status</dt><dd>${e(log.status_http)} · ${log.sucesso ? "Sucesso" : "Erro"}</dd></div>
    <div><dt>IP</dt><dd>${e(log.ip || "-")}</dd></div>
    <div><dt>Navegador</dt><dd>${e(log.user_agent || "-")}</dd></div>
  `;
  document.getElementById("logDetalheJson").textContent = JSON.stringify(log.detalhes || {}, null, 2);
  document.getElementById("modalLog").hidden = false;
}

function agendarLogs() {
  clearTimeout(filtroTimerLogs);
  filtroTimerLogs = setTimeout(() => carregarLogs(1), 250);
}

document.getElementById("btnAtualizarLogs").addEventListener("click", () => carregarLogs(paginaLogs));
document.getElementById("btnLimparLogs").addEventListener("click", () => {
  document.querySelectorAll(".logs-filters input, .logs-filters select").forEach(campo => { campo.value = ""; });
  carregarLogs(1);
});
document.querySelectorAll(".logs-filters input, .logs-filters select").forEach(campo => {
  campo.addEventListener(campo.tagName === "INPUT" && campo.type === "search" ? "input" : "change", agendarLogs);
});
document.getElementById("btnLogsAnterior").addEventListener("click", () => carregarLogs(paginaLogs - 1));
document.getElementById("btnLogsProxima").addEventListener("click", () => carregarLogs(paginaLogs + 1));
document.getElementById("logsBody").addEventListener("click", event => {
  const botao = event.target.closest("[data-log-id]");
  if (botao) abrirDetalhes(botao.dataset.logId);
});
document.getElementById("btnFecharLog").addEventListener("click", () => { document.getElementById("modalLog").hidden = true; });

document.addEventListener("usuario-carregado", event => {
  if (event.detail.tipo_usuario !== "admin") return window.location.replace("/home");
  carregarLogs(1);
});
