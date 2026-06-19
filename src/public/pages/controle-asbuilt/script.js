let colunasAsbuilt = [];
let colunasMeta = [];
let registrosAsbuilt = [];
let podeEditarAsbuilt = false;
let podeAdministrarColunas = false;
let ancoraSelecaoId = null;
let textoCarga = "Carregando...";
let projetoUrlConsumido = false;
let dadosSgoConfig = null;
let arquivoImportacao = null;
let analiseImportacao = null;
let camposTesteSgo = [];
let paginacaoAsbuilt = { pagina: 1, limite: 150, total: 0, totalPaginas: 1 };
let filtroTimer = null;
let campoColunaArrastada = null;
let cancelarAtualizacaoV2 = false;
let atualizacaoV2EmAndamento = false;
const selecionados = new Set();
const filtrosColuna = new Map();
const timersSalvamento = new Map();
const sugestoesFiltroCache = new Map();
const timersSugestoes = new Map();
const CONCORRENCIA_PROJETOS_SGO = 4;
const CHAVE_COLUNAS = "controle-asbuilt-colunas-visiveis-v2";
const CHAVE_ORDEM_COLUNAS = "controle-asbuilt-colunas-ordem-v1";
const COLUNAS_PADRAO = new Set([
  "projeto", "data_exe", "data_conclusao_projeto", "cidade", "localizacao", "precisa_ir_campo", "data_asbuilt",
  "sapid", "status", "status_sap", "versao", "pep", "nome", "observacao",
  "responsavel", "status_sgo", "pdf_nome", "criado_por_nome", "concluido_por_nome"
]);
let camposVisiveis = null;
let ordemCamposColunas = [];

const escapar = valor => String(valor ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

function valorInput(valor, tipo) {
  if (valor === null || valor === undefined) return "";
  return tipo === "data" ? String(valor).slice(0, 10) : String(valor);
}

function colunasEditaveis() {
  return colunasAsbuilt.filter(coluna => coluna.campo !== "projeto" && !coluna.formula);
}

function opcoesLista(coluna, valorAtual = "") {
  return (coluna.opcoes || []).map(opcao =>
    `<option value="${escapar(opcao)}" ${String(opcao) === String(valorAtual ?? "") ? "selected" : ""}>${escapar(opcao)}</option>`
  ).join("");
}

async function requisicao(url, options = {}) {
  const response = await fetch(url, { credentials: "include", ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a operação.");
  return data;
}

function definirCarga(texto) {
  textoCarga = texto;
  const sufixo = selecionados.size ? ` • ${selecionados.size} selecionado(s)` : "";
  document.getElementById("estadoCarga").textContent = `${texto}${sufixo}`;
  document.getElementById("btnConsultarSgo").textContent = selecionados.size > 1
    ? `Atualizar SGO (${selecionados.size})`
    : "Atualizar SGO";
}

function todasColunas() {
  return [...colunasAsbuilt, ...colunasMeta];
}

function lerArrayStorage(chave) {
  try {
    const valor = JSON.parse(localStorage.getItem(chave));
    return Array.isArray(valor) ? valor.map(item => String(item)).filter(Boolean) : null;
  } catch {
    return null;
  }
}

function carregarPreferenciaColunas() {
  const salvas = lerArrayStorage(CHAVE_COLUNAS);
  camposVisiveis = salvas ? new Set(salvas) : new Set(COLUNAS_PADRAO);
  camposVisiveis.add("projeto");

  const ordemSalva = lerArrayStorage(CHAVE_ORDEM_COLUNAS);
  ordemCamposColunas = ordemSalva || salvas || [...COLUNAS_PADRAO];
  if (!ordemCamposColunas.includes("projeto")) ordemCamposColunas.unshift("projeto");
}

function colunasOrdenadas(colunas) {
  const posicaoUsuario = new Map(ordemCamposColunas.map((campo, index) => [campo, index]));
  const posicaoNatural = new Map(colunas.map((coluna, index) => [coluna.campo, index]));
  return [...colunas].sort((a, b) => {
    const ordemA = posicaoUsuario.has(a.campo) ? posicaoUsuario.get(a.campo) : Number.MAX_SAFE_INTEGER;
    const ordemB = posicaoUsuario.has(b.campo) ? posicaoUsuario.get(b.campo) : Number.MAX_SAFE_INTEGER;
    return ordemA - ordemB || (posicaoNatural.get(a.campo) || 0) - (posicaoNatural.get(b.campo) || 0);
  });
}

function colunasVisiveis() {
  return colunasOrdenadas(todasColunas()).filter(coluna => camposVisiveis.has(coluna.campo));
}

function registrosFiltrados() {
  return registrosAsbuilt;
}

function inputCelula(registro, coluna) {
  const readonly = podeEditarAsbuilt ? "" : " disabled";
  if (coluna.formula) {
    const valor = coluna.tipo === "moeda" && registro[coluna.campo] !== null && registro[coluna.campo] !== undefined
      ? Number(registro[coluna.campo]).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : valorInput(registro[coluna.campo], coluna.tipo);
    return `<td><input class="calculated-input" type="text" readonly
      data-calculated-field="${coluna.campo}" title="${escapar(coluna.formula)}"
      aria-label="${escapar(coluna.titulo)}" value="${escapar(valor)}"></td>`;
  }
  if (coluna.tipo === "booleano") {
    return `<td class="boolean-cell"><input class="sheet-input sheet-check" type="checkbox"${readonly}
      data-id="${registro.id}" data-field="${coluna.campo}" aria-label="${escapar(coluna.titulo)}"
      ${registro[coluna.campo] ? "checked" : ""}></td>`;
  }
  if (coluna.tipo === "lista") {
    return `<td><select class="sheet-input" ${podeEditarAsbuilt ? "" : "disabled"}
      data-id="${registro.id}" data-field="${coluna.campo}" aria-label="${escapar(coluna.titulo)}">
      <option value=""></option>${opcoesLista(coluna, registro[coluna.campo])}
    </select></td>`;
  }
  const tipo = coluna.tipo === "data" ? "date" : (coluna.tipo === "numero" ? "number" : "text");
  return `<td><input class="sheet-input" type="${tipo}"${podeEditarAsbuilt ? "" : " readonly"}
    data-id="${registro.id}" data-field="${coluna.campo}"
    aria-label="${escapar(coluna.titulo)}" value="${escapar(valorInput(registro[coluna.campo], coluna.tipo))}"></td>`;
}

function celulaMeta(registro, coluna) {
  if (coluna.tipo === "pdf") {
    return `<td class="meta-cell">${registro.pdf_nome
      ? `<a href="/api/controle-asbuilt/${registro.id}/pdf" target="_blank">Abrir PDF</a>`
      : "-"}</td>`;
  }
  return `<td class="meta-cell">${escapar(registro[coluna.campo] || "-")}</td>`;
}

function renderizarCabecalho() {
  const colunas = colunasVisiveis();
  const tabela = document.getElementById("tabelaAsbuilt");
  const largura = 78 + colunas.reduce((total, coluna) => total + coluna.largura, 0) + 82;
  tabela.style.minWidth = `${largura}px`;
  tabela.innerHTML = `
    <thead>
      <tr>
        <th class="row-control">#</th>
        ${colunas.map(coluna => `<th style="width:${coluna.largura}px;min-width:${coluna.largura}px">${escapar(coluna.titulo)}</th>`).join("")}
        <th class="save-cell">Estado</th>
      </tr>
      <tr class="excel-filter-row">
        <th class="row-control"><button id="btnLimparFiltros" type="button" title="Limpar filtros">×</button></th>
        ${colunas.map(coluna => coluna.formula
          ? '<th><input class="excel-filter" placeholder="Calculada" disabled></th>'
          : `<th><input class="excel-filter" data-filter-field="${coluna.campo}" placeholder="Filtrar ▾" value="${escapar(filtrosColuna.get(coluna.campo) || "")}"></th>`
        ).join("")}
        <th class="save-cell"></th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  prepararAutocompleteFiltros();
}

function prepararAutocompleteFiltros() {
  document.querySelectorAll(".excel-filter").forEach(input => {
    const campo = input.dataset.filterField;
    if (!campo) return;
    const listaId = `sugestoes-${campo}`;
    input.setAttribute("list", listaId);
    input.setAttribute("autocomplete", "off");
    const lista = document.createElement("datalist");
    lista.id = listaId;
    lista.innerHTML = (sugestoesFiltroCache.get(campo) || []).map(item => `<option value="${escapar(item)}"></option>`).join("");
    input.closest("th").appendChild(lista);
  });
}

async function carregarSugestoesFiltro(input) {
  const campo = input.dataset.filterField;
  const busca = input.value.trim();
  try {
    const data = await requisicao(`/api/controle-asbuilt/filtros/${encodeURIComponent(campo)}?busca=${encodeURIComponent(busca)}&limite=25`);
    sugestoesFiltroCache.set(campo, data.sugestoes || []);
    const lista = document.getElementById(`sugestoes-${campo}`);
    if (lista) lista.innerHTML = (data.sugestoes || []).map(item => `<option value="${escapar(item)}"></option>`).join("");
  } catch {}
}

function agendarSugestoesFiltro(input) {
  const campo = input.dataset.filterField;
  clearTimeout(timersSugestoes.get(campo));
  timersSugestoes.set(campo, setTimeout(() => carregarSugestoesFiltro(input), 180));
}

function renderizarCorpo() {
  const corpo = document.querySelector("#tabelaAsbuilt tbody");
  const visiveis = registrosFiltrados();
  const colunas = colunasVisiveis();
  corpo.innerHTML = visiveis.length ? visiveis.map((registro, index) => `
    <tr data-row-id="${registro.id}" class="${selecionados.has(Number(registro.id)) ? "is-selected" : ""}">
      <td class="row-control">
        <span class="selection-mark">${selecionados.has(Number(registro.id)) ? "✓" : index + 1}</span>
        ${podeEditarAsbuilt ? `<button type="button" class="delete-row" data-delete-id="${registro.id}" title="Excluir linha">×</button>` : ""}
      </td>
      ${colunas.map(coluna => coluna.tipo === "meta" || coluna.tipo === "pdf" ? celulaMeta(registro, coluna) : inputCelula(registro, coluna)).join("")}
      <td class="save-cell">Salvo</td>
    </tr>
  `).join("") : `<tr><td class="empty-state" colspan="${colunas.length + 2}">Nenhum registro encontrado.</td></tr>`;
  definirCarga(`${visiveis.length} de ${paginacaoAsbuilt.total} registro(s)`);
  atualizarPaginacao();
}

function marcarEstado(id, estado, texto) {
  const linha = document.querySelector(`[data-row-id="${id}"]`);
  if (!linha) return;
  linha.classList.toggle("is-saving", estado === "salvando");
  linha.classList.toggle("has-error", estado === "erro");
  linha.querySelector(".save-cell").textContent = texto;
}

async function salvarCelula(id, campo, valor) {
  marcarEstado(id, "salvando", "Salvando");
  try {
    const data = await requisicao(`/api/controle-asbuilt/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campo, valor })
    });
    const registro = registrosAsbuilt.find(item => Number(item.id) === Number(id));
    if (registro) {
      if (data.registro) Object.assign(registro, data.registro);
      else registro[campo] = data.valor;
      const linha = document.querySelector(`[data-row-id="${id}"]`);
      linha?.querySelectorAll("[data-calculated-field]").forEach(input => {
        const coluna = colunasAsbuilt.find(item => item.campo === input.dataset.calculatedField);
        const calculado = registro[input.dataset.calculatedField];
        input.value = coluna?.tipo === "moeda" && calculado !== null && calculado !== undefined
          ? Number(calculado).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
          : valorInput(calculado, coluna?.tipo);
      });
    }
    marcarEstado(id, "salvo", "Salvo");
  } catch (error) {
    marcarEstado(id, "erro", "Erro");
    msgErro(error.message);
  }
}

function agendarSalvamento(input, imediato = false) {
  const id = Number(input.dataset.id);
  const campo = input.dataset.field;
  const valor = input.type === "checkbox" ? input.checked : input.value;
  const registro = registrosAsbuilt.find(item => Number(item.id) === id);
  if (registro) registro[campo] = valor;
  const chave = `${id}:${campo}`;
  clearTimeout(timersSalvamento.get(chave));
  marcarEstado(id, "salvando", "Pendente");
  timersSalvamento.set(chave, setTimeout(() => {
    timersSalvamento.delete(chave);
    salvarCelula(id, campo, valor);
  }, imediato ? 0 : 650));
}

function atualizarPaginacao() {
  document.getElementById("infoPaginacao").textContent =
    `Pagina ${paginacaoAsbuilt.pagina} de ${paginacaoAsbuilt.totalPaginas} - ${paginacaoAsbuilt.total} registro(s)`;
  document.getElementById("btnPaginaAnterior").disabled = paginacaoAsbuilt.pagina <= 1;
  document.getElementById("btnProximaPagina").disabled = paginacaoAsbuilt.pagina >= paginacaoAsbuilt.totalPaginas;
  document.getElementById("limitePagina").value = String(paginacaoAsbuilt.limite);
}

function parametrosConsulta(pagina = 1) {
  const params = new URLSearchParams();
  params.set("pagina", String(pagina));
  params.set("limite", document.getElementById("limitePagina")?.value || String(paginacaoAsbuilt.limite));
  const busca = document.getElementById("busca").value.trim();
  if (busca) params.set("busca", busca);
  const filtros = Object.fromEntries([...filtrosColuna.entries()].filter(([, valor]) => valor));
  if (Object.keys(filtros).length) params.set("filtros", JSON.stringify(filtros));
  return params;
}

function agendarCarregamento(pagina = 1) {
  clearTimeout(filtroTimer);
  filtroTimer = setTimeout(() => carregarRegistros(pagina), 280);
}

async function carregarRegistros(pagina = paginacaoAsbuilt.pagina) {
  definirCarga("Carregando...");
  try {
    const data = await requisicao(`/api/controle-asbuilt?${parametrosConsulta(pagina).toString()}`);
    const assinaturaAnterior = todasColunas().map(coluna => `${coluna.campo}:${coluna.titulo}:${coluna.tipo}:${coluna.formula || ""}`).join("|");
    colunasAsbuilt = data.colunas;
    colunasMeta = data.colunasMeta || [];
    const assinaturaNova = todasColunas().map(coluna => `${coluna.campo}:${coluna.titulo}:${coluna.tipo}:${coluna.formula || ""}`).join("|");
    registrosAsbuilt = data.registros;
    paginacaoAsbuilt = data.paginacao || paginacaoAsbuilt;
    carregarPreferenciaColunas();
    selecionados.clear();
    if (!document.querySelector("#tabelaAsbuilt thead") || assinaturaAnterior !== assinaturaNova) renderizarCabecalho();
    renderizarCorpo();
    if (!projetoUrlConsumido) {
      const projetoUrl = new URLSearchParams(window.location.search).get("projeto");
      if (projetoUrl) {
        projetoUrlConsumido = true;
        document.getElementById("novoProjeto").value = projetoUrl;
        document.getElementById("modalNovoProjeto").hidden = false;
        document.getElementById("novaVersao").focus();
        history.replaceState({}, "", "/controle-asbuilt");
      }
    }
  } catch (error) {
    definirCarga("Erro ao carregar");
    msgErro(error.message);
  }
}

async function criarProjeto(projeto, versao) {
  definirCarga(`Adicionando ${projeto}...`);
  const data = await requisicao("/api/controle-asbuilt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dados: { projeto, versao } })
  });
  await carregarRegistros(1);
  selecionados.clear();
  selecionados.add(Number(data.registro.id));
  ancoraSelecaoId = Number(data.registro.id);
  renderizarCorpo();
  msgSucesso(data.message);
  atualizarSgoRegistros([data.registro], true);
}

async function atualizarRegistroComSgo(registro) {
  marcarEstado(registro.id, "salvando", "Consultando");
  const resultado = await window.sgoClient.consultarDadosProjeto(registro.projeto, registro);
  if (!Object.keys(resultado.dados).length) {
    marcarEstado(registro.id, "salvo", "Sem dados");
    return false;
  }
  const data = await requisicao(`/api/controle-asbuilt/${registro.id}/dados`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dados: resultado.dados })
  });
  const indice = registrosAsbuilt.findIndex(item => Number(item.id) === Number(registro.id));
  if (indice >= 0) registrosAsbuilt[indice] = data.registro;
  marcarEstado(registro.id, "salvo", "SGO atualizado");
  return true;
}

async function atualizarSgoRegistros(registros, automatico = false) {
  const validos = registros.filter(registro => registro?.projeto);
  if (!validos.length) return msgAviso("Selecione ao menos um registro com projeto informado.");
  definirCarga(`Atualizando SGO de ${validos.length} projeto(s)...`);
  let atualizados = 0;
  let processados = 0;
  const erros = [];
  await window.sgoClient.processarEmParalelo(validos, async registro => {
    try {
      if (await atualizarRegistroComSgo(registro)) atualizados += 1;
    } catch (error) {
      marcarEstado(registro.id, "erro", "Erro SGO");
      erros.push(`${registro.projeto}: ${error.message}`);
    } finally {
      processados += 1;
      definirCarga(`Atualizando SGO: ${processados} de ${validos.length}`);
    }
  }, CONCORRENCIA_PROJETOS_SGO);
  renderizarCorpo();
  if (atualizados) msgSucesso(`${atualizados} projeto(s) atualizado(s) com dados do SGO.`);
  if (erros.length) {
    const mensagem = automatico
      ? "Projeto adicionado. A atualização automática do SGO precisa da VPN ativa."
      : erros.slice(0, 3).join(" | ");
    msgAviso(mensagem);
  }
}

function atualizarPainelV2({ processados, total, atualizados, erros, texto }) {
  const percentual = total ? Math.round((processados / total) * 100) : 0;
  document.getElementById("v2ProgressBar").style.width = `${percentual}%`;
  document.getElementById("v2Processados").textContent = String(processados);
  document.getElementById("v2Atualizados").textContent = String(atualizados);
  document.getElementById("v2Erros").textContent = String(erros);
  document.getElementById("v2StatusTexto").textContent = texto;
}

async function atualizarTodosV2Sgo() {
  if (atualizacaoV2EmAndamento) return;
  if (!confirm("Atualizar pelo SGO todos os projetos V2 da sua regional? A VPN deve permanecer conectada.")) return;

  cancelarAtualizacaoV2 = false;
  atualizacaoV2EmAndamento = true;
  const modal = document.getElementById("modalAtualizarV2");
  const listaErros = document.getElementById("v2ErrosLista");
  modal.hidden = false;
  listaErros.hidden = true;
  listaErros.innerHTML = "";
  document.getElementById("btnCancelarV2").hidden = false;
  document.getElementById("btnCancelarV2").disabled = false;
  document.getElementById("btnFecharV2").hidden = true;
  atualizarPainelV2({ processados: 0, total: 0, atualizados: 0, erros: 0, texto: "Buscando projetos V2..." });

  let processados = 0;
  let atualizados = 0;
  const falhas = [];
  try {
    const data = await requisicao("/api/controle-asbuilt/sgo-v2");
    const projetos = data.registros || [];
    if (!projetos.length) {
      atualizarPainelV2({ processados: 0, total: 0, atualizados: 0, erros: 0, texto: "Nenhum projeto V2 encontrado nesta regional." });
      return;
    }

    await window.sgoClient.processarEmParalelo(projetos, async registro => {
      atualizarPainelV2({
        processados,
        total: projetos.length,
        atualizados,
        erros: falhas.length,
        texto: `Consultando em paralelo (${processados} de ${projetos.length})`
      });
      try {
        const resultado = await window.sgoClient.consultarDadosProjeto(registro.projeto, registro);
        if (Object.keys(resultado.dados || {}).length) {
          await requisicao(`/api/controle-asbuilt/${registro.id}/dados`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dados: resultado.dados })
          });
          atualizados += 1;
        }
      } catch (error) {
        falhas.push(`${registro.projeto}: ${error.message}`);
      }
      processados += 1;
      atualizarPainelV2({
        processados,
        total: projetos.length,
        atualizados,
        erros: falhas.length,
        texto: `Consultando em paralelo (${processados} de ${projetos.length})`
      });
    }, CONCORRENCIA_PROJETOS_SGO, () => cancelarAtualizacaoV2);

    const interrompida = cancelarAtualizacaoV2;
    atualizarPainelV2({
      processados,
      total: projetos.length,
      atualizados,
      erros: falhas.length,
      texto: interrompida
        ? `Atualização cancelada após ${processados} projeto(s).`
        : `Atualização concluída: ${atualizados} projeto(s) alterado(s).`
    });
    if (falhas.length) {
      listaErros.hidden = false;
      listaErros.innerHTML = `<strong>Projetos com erro</strong>${falhas.slice(0, 100).map(item => `<span>${escapar(item)}</span>`).join("")}`;
    }
    await carregarRegistros(paginacaoAsbuilt.pagina);
  } catch (error) {
    falhas.push(error.message);
    atualizarPainelV2({ processados, total: processados, atualizados, erros: falhas.length, texto: error.message });
    listaErros.hidden = false;
    listaErros.innerHTML = `<span>${escapar(error.message)}</span>`;
  } finally {
    atualizacaoV2EmAndamento = false;
    document.getElementById("btnCancelarV2").hidden = true;
    document.getElementById("btnFecharV2").hidden = false;
  }
}

function selecionarLinha(id, evento) {
  const visiveis = registrosFiltrados().map(item => Number(item.id));
  if (evento.shiftKey && ancoraSelecaoId && visiveis.includes(ancoraSelecaoId)) {
    const inicio = visiveis.indexOf(ancoraSelecaoId);
    const fim = visiveis.indexOf(id);
    if (!evento.ctrlKey) selecionados.clear();
    visiveis.slice(Math.min(inicio, fim), Math.max(inicio, fim) + 1).forEach(item => selecionados.add(item));
  } else if (evento.ctrlKey) {
    if (selecionados.has(id)) selecionados.delete(id); else selecionados.add(id);
    ancoraSelecaoId = id;
  } else {
    selecionados.clear();
    selecionados.add(id);
    ancoraSelecaoId = id;
  }
  document.querySelectorAll("[data-row-id]").forEach((linha, index) => {
    const selecionada = selecionados.has(Number(linha.dataset.rowId));
    linha.classList.toggle("is-selected", selecionada);
    linha.querySelector(".selection-mark").textContent = selecionada ? "✓" : index + 1;
  });
  definirCarga(textoCarga);
}

function selecionarTodasLinhas() {
  registrosFiltrados().forEach(registro => selecionados.add(Number(registro.id)));
  ancoraSelecaoId = registrosFiltrados()[0]?.id || null;
  document.querySelectorAll("[data-row-id]").forEach(linha => {
    linha.classList.add("is-selected");
    linha.querySelector(".selection-mark").textContent = "✓";
  });
  definirCarga(textoCarga);
}

function renderizarListaColunas() {
  document.getElementById("listaColunas").innerHTML = colunasOrdenadas(todasColunas()).map(coluna => `
    <label class="column-option" draggable="true" data-column-option="${escapar(coluna.campo)}">
      <span class="column-drag-handle" title="Arrastar coluna" aria-hidden="true"></span>
      <input type="checkbox" value="${coluna.campo}" ${camposVisiveis.has(coluna.campo) ? "checked" : ""}
        ${coluna.campo === "projeto" ? "disabled" : ""}>
      <span>${escapar(coluna.titulo)}</span>
    </label>
  `).join("");
}

function abrirColunas() {
  document.querySelector("#modalColunas .columns-modal").classList.remove("validation-mode");
  renderizarListaColunas();
  document.getElementById("colunasAdminPanel").hidden = true;
  document.getElementById("modalColunas").hidden = false;
}

function abrirValidacoes() {
  if (!podeAdministrarColunas) {
    msgAviso("Somente administradores podem configurar validacoes.");
    return false;
  }
  document.querySelector("#modalColunas .columns-modal").classList.add("validation-mode");
  document.getElementById("colunasAdminPanel").hidden = false;
  renderizarAdminColunas();
  document.getElementById("modalColunas").hidden = false;
  return true;
}

function abrirExclusaoColunasBanco() {
  if (!abrirValidacoes()) return;
  document.querySelector(".database-columns-panel")?.scrollIntoView({ block: "start" });
}

function salvarColunas() {
  camposVisiveis = new Set([...document.querySelectorAll("#listaColunas input:checked")].map(input => input.value));
  camposVisiveis.add("projeto");
  ordemCamposColunas = [...document.querySelectorAll("#listaColunas [data-column-option]")]
    .map(item => item.dataset.columnOption)
    .filter(Boolean);
  localStorage.setItem(CHAVE_COLUNAS, JSON.stringify([...camposVisiveis]));
  localStorage.setItem(CHAVE_ORDEM_COLUNAS, JSON.stringify(ordemCamposColunas));
  document.getElementById("modalColunas").hidden = true;
  renderizarCabecalho();
  renderizarCorpo();
}

function limparArrasteColunas() {
  campoColunaArrastada = null;
  document.querySelectorAll("#listaColunas .is-dragging, #listaColunas .is-drag-over").forEach(item => {
    item.classList.remove("is-dragging", "is-drag-over");
  });
}

function iniciarArrasteColuna(event) {
  const item = event.target.closest("[data-column-option]");
  if (!item) return;
  campoColunaArrastada = item.dataset.columnOption;
  item.classList.add("is-dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", campoColunaArrastada);
}

function arrastarSobreColuna(event) {
  const alvo = event.target.closest("[data-column-option]");
  const arrastado = campoColunaArrastada
    ? document.querySelector(`#listaColunas [data-column-option="${CSS.escape(campoColunaArrastada)}"]`)
    : null;
  if (!alvo || !arrastado || alvo === arrastado) return;

  event.preventDefault();
  document.querySelectorAll("#listaColunas .is-drag-over").forEach(item => item.classList.remove("is-drag-over"));
  alvo.classList.add("is-drag-over");
  const caixa = alvo.getBoundingClientRect();
  const inserirDepois = event.clientY > caixa.top + caixa.height / 2;
  alvo.parentElement.insertBefore(arrastado, inserirDepois ? alvo.nextSibling : alvo);
}

function soltarColuna(event) {
  if (!campoColunaArrastada) return;
  event.preventDefault();
  limparArrasteColunas();
}

function textoOpcoes(coluna) {
  return (coluna.opcoes || []).join("\n");
}

function opcoesTipoColuna(tipoAtual) {
  return ["texto", "lista", "data", "numero", "moeda", "booleano"].map(tipo =>
    `<option value="${tipo}" ${tipo === tipoAtual ? "selected" : ""}>${tipo}</option>`
  ).join("");
}

function renderizarAdminColunas() {
  document.getElementById("listaColunasAdmin").innerHTML = colunasAsbuilt.map(coluna => `
    <details class="column-admin-row" data-column-field="${escapar(coluna.campo)}">
      <summary>
        <span><strong>${escapar(coluna.titulo)}</strong><small>${escapar(coluna.campo)}</small></span>
        <span class="column-tags"><b>${escapar(coluna.tipo)}</b>${coluna.obrigatoria ? "<b>obrigatoria</b>" : ""}${coluna.sistema ? "<b>padrao</b>" : ""}${coluna.formula ? "<b>calculada</b>" : ""}</span>
      </summary>
      <div class="validation-editor">
        <label>Titulo<input data-column-title value="${escapar(coluna.titulo)}" maxlength="120"></label>
        <label>Tipo<select data-column-type ${coluna.sistema && !["texto", "lista"].includes(coluna.tipo) ? "disabled" : ""}>${opcoesTipoColuna(coluna.tipo)}</select></label>
        <label>Largura<input data-column-width type="number" min="70" max="480" value="${Number(coluna.largura) || 140}"></label>
        <label class="validation-options" ${coluna.tipo === "lista" ? "" : "hidden"}>Opcoes da lista<textarea data-column-options rows="3" placeholder="Uma opcao por linha">${escapar(textoOpcoes(coluna))}</textarea></label>
        <label>Valor padrao<input data-column-default value="${escapar(coluna.valorPadrao || "")}" placeholder="Usado ao criar projeto" ${coluna.formula ? "disabled" : ""}></label>
        <label class="formula-field">Formula calculada<input data-column-formula value="${escapar(coluna.formula || "")}" maxlength="1000" placeholder="Ex: =valor-valor_adinatado" ${coluna.sistema ? "disabled" : ""}><small>Use as chaves mostradas abaixo dos titulos.</small></label>
        <label class="check-option"><input data-column-required type="checkbox" ${coluna.obrigatoria ? "checked" : ""} ${coluna.campo === "projeto" || coluna.formula ? "disabled" : ""}> Exigir valor ao editar</label>
        <div class="validation-actions">
          ${coluna.sistema ? '<span class="system-badge">Coluna padrao</span>' : ""}
          ${coluna.sistema && coluna.campo !== "projeto" ? '<button type="button" class="btn-danger" data-delete-column>Ocultar coluna</button>' : ""}
          <button type="button" data-save-column>Salvar alteracoes</button>
        </div>
      </div>
    </details>
  `).join("");
  renderizarColunasBanco();
}

function renderizarColunasBanco() {
  const personalizadas = colunasAsbuilt.filter(coluna => !coluna.sistema);
  document.getElementById("listaColunasBanco").innerHTML = personalizadas.length
    ? personalizadas.map(coluna => `
      <div class="database-column-row" data-database-column="${escapar(coluna.campo)}">
        <span>
          <strong>${escapar(coluna.titulo)}</strong>
          <small>${escapar(coluna.campo)} · ${escapar(coluna.tipo)}${coluna.formula ? ` · ${escapar(coluna.formula)}` : ""}</small>
        </span>
        <button type="button" class="btn-danger" data-delete-db-column>Excluir do banco</button>
      </div>
    `).join("")
    : '<div class="empty-state compact">Nao existem colunas personalizadas para excluir.</div>';
}

function dadosColunaDaLinha(linha) {
  return {
    titulo: linha.querySelector("[data-column-title]").value,
    tipo: linha.querySelector("[data-column-type]").value,
    largura: Number(linha.querySelector("[data-column-width]").value),
    obrigatoria: linha.querySelector("[data-column-required]").checked,
    valorPadrao: linha.querySelector("[data-column-default]").value,
    formula: linha.querySelector("[data-column-formula]").value,
    opcoes: linha.querySelector("[data-column-options]").value.split(/\r?\n|;/).map(item => item.trim()).filter(Boolean)
  };
}

async function salvarColuna(linha) {
  const campo = linha.dataset.columnField;
  const data = await requisicao(`/api/controle-asbuilt/colunas/${encodeURIComponent(campo)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dadosColunaDaLinha(linha))
  });
  colunasAsbuilt = data.colunas.filter(coluna => coluna.ativa);
  renderizarAdminColunas();
  renderizarCabecalho();
  renderizarCorpo();
  msgSucesso(data.message);
}

async function excluirColuna(campo) {
  const coluna = colunasAsbuilt.find(item => item.campo === campo);
  const pergunta = coluna?.sistema
    ? "Ocultar esta coluna padrao do controle de As-Built?"
    : "Excluir esta coluna e todos os valores armazenados nela?";
  if (!confirm(pergunta)) return;
  const data = await requisicao(`/api/controle-asbuilt/colunas/${encodeURIComponent(campo)}`, { method: "DELETE" });
  camposVisiveis.delete(campo);
  localStorage.setItem(CHAVE_COLUNAS, JSON.stringify([...camposVisiveis]));
  msgSucesso(data.message);
  await carregarRegistros(1);
  abrirValidacoes();
}

async function criarColuna(event) {
  event.preventDefault();
  const data = await requisicao("/api/controle-asbuilt/colunas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      titulo: document.getElementById("novaColunaTitulo").value,
      campo: document.getElementById("novaColunaCampo").value,
      tipo: document.getElementById("novaColunaTipo").value,
      valorPadrao: document.getElementById("novaColunaValorPadrao").value,
      formula: document.getElementById("novaColunaFormula").value,
      opcoes: document.getElementById("novaColunaOpcoes").value.split(/\r?\n|;/).map(item => item.trim()).filter(Boolean)
    })
  });
  event.currentTarget.reset();
  msgSucesso(data.message);
  await carregarRegistros(1);
  abrirValidacoes();
}

function inputValorBulk(coluna) {
  if (!coluna) return '<input data-bulk-value disabled>';
  if (coluna.tipo === "booleano") return '<select data-bulk-value><option value="1">Sim</option><option value="0">Nao</option></select>';
  if (coluna.tipo === "lista") return `<select data-bulk-value><option value=""></option>${opcoesLista(coluna)}</select>`;
  const tipo = coluna.tipo === "data" ? "date" : (coluna.tipo === "numero" ? "number" : "text");
  return `<input data-bulk-value type="${tipo}">`;
}

function opcoesBulkColunas(selecionada = "") {
  return colunasEditaveis().map(coluna =>
    `<option value="${escapar(coluna.campo)}" ${coluna.campo === selecionada ? "selected" : ""}>${escapar(coluna.titulo)}</option>`
  ).join("");
}

function linhaBulkColuna(campo = colunasEditaveis()[0]?.campo || "") {
  const coluna = colunasAsbuilt.find(item => item.campo === campo) || colunasEditaveis()[0];
  return `
    <div class="bulk-column-row">
      <label>Coluna<select data-bulk-field>${opcoesBulkColunas(coluna?.campo || "")}</select></label>
      <label>Valor<span data-bulk-value-wrap>${inputValorBulk(coluna)}</span></label>
      <button type="button" class="remove-config" data-remove-bulk title="Remover">x</button>
    </div>
  `;
}

function abrirAtualizacaoColunas() {
  if (!selecionados.size) return msgAviso("Selecione ao menos um registro para atualizar.");
  if (!colunasEditaveis().length) return msgAviso("Nao ha colunas editaveis.");
  document.getElementById("bulkColumnRows").innerHTML = linhaBulkColuna();
  document.getElementById("modalAtualizarColunas").hidden = false;
}

function atualizarInputBulk(linha) {
  const campo = linha.querySelector("[data-bulk-field]").value;
  const coluna = colunasAsbuilt.find(item => item.campo === campo);
  linha.querySelector("[data-bulk-value-wrap]").innerHTML = inputValorBulk(coluna);
}

async function executarAtualizacaoColunas() {
  const dados = {};
  document.querySelectorAll("#bulkColumnRows .bulk-column-row").forEach(linha => {
    const campo = linha.querySelector("[data-bulk-field]").value;
    const valorEl = linha.querySelector("[data-bulk-value]");
    if (campo && valorEl) dados[campo] = valorEl.value;
  });
  if (!Object.keys(dados).length) return msgAviso("Informe ao menos uma coluna.");
  const data = await requisicao("/api/controle-asbuilt/atualizar-colunas", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: [...selecionados], dados })
  });
  document.getElementById("modalAtualizarColunas").hidden = true;
  msgSucesso(data.message);
  await carregarRegistros(paginacaoAsbuilt.pagina);
}

async function excluirLinha(id) {
  if (!confirm("Excluir esta linha do controle de As-Built?")) return;
  try {
    await requisicao(`/api/controle-asbuilt/${id}`, { method: "DELETE" });
    registrosAsbuilt = registrosAsbuilt.filter(item => Number(item.id) !== Number(id));
    paginacaoAsbuilt.total = Math.max(0, paginacaoAsbuilt.total - 1);
    paginacaoAsbuilt.totalPaginas = Math.max(1, Math.ceil(paginacaoAsbuilt.total / paginacaoAsbuilt.limite));
    selecionados.delete(Number(id));
    renderizarCorpo();
    msgSucesso("Linha excluída.");
  } catch (error) {
    msgErro(error.message);
  }
}

async function exportarPlanilha() {
  const response = await fetch("/api/controle-asbuilt/exportar", { credentials: "include" });
  if (!response.ok) return msgErro("Não foi possível exportar a planilha.");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(await response.blob());
  link.download = `controle-asbuilt-${new Date().toISOString().slice(0, 10)}.xlsx`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function opcoesColunas(colunas, selecionada = "", incluirVazia = true) {
  return `${incluirVazia ? '<option value="">Não importar</option>' : ""}${colunas.map(coluna =>
    `<option value="${escapar(coluna.campo)}" ${coluna.campo === selecionada ? "selected" : ""}>${escapar(coluna.titulo)} (${escapar(coluna.campo)})</option>`
  ).join("")}`;
}

function fontesSgoDisponiveis() {
  const fontes = new Map();
  fontes.set("$input", "Projeto digitado na tabela");
  camposTesteSgo.forEach(item => {
    const preview = String(item.valor ?? "").slice(0, 70);
    fontes.set(item.caminho, `${item.caminho}${preview ? ` • ${preview}` : ""}`);
  });
  dadosSgoConfig?.configuracao?.etapas?.forEach(etapa => {
    if (etapa.entrada && !fontes.has(etapa.entrada)) fontes.set(etapa.entrada, etapa.entrada);
  });
  dadosSgoConfig?.configuracao?.mapeamentos?.forEach(item => {
    if (item.origem && !fontes.has(item.origem)) fontes.set(item.origem, item.origem);
  });
  return [...fontes.entries()].map(([valor, texto]) => ({ valor, texto }));
}

function opcoesFontesSgo(selecionada = "", incluirVazia = false) {
  const fontes = fontesSgoDisponiveis();
  if (selecionada && !fontes.some(item => item.valor === selecionada)) fontes.unshift({ valor: selecionada, texto: selecionada });
  return `${incluirVazia ? '<option value="">Escolha um dado retornado</option>' : ""}${fontes.map(item =>
    `<option value="${escapar(item.valor)}" ${item.valor === selecionada ? "selected" : ""}>${escapar(item.texto)}</option>`
  ).join("")}`;
}

function atualizarResumoSgo() {
  if (!dadosSgoConfig) return;
  const config = lerConfiguracaoSgoDaTela();
  document.getElementById("sgoResumoVisual").innerHTML = `
    <strong>Painel visual da automação</strong>
    <div class="summary-pills">
      <span class="summary-pill">${config.etapas.length} etapa(s)</span>
      <span class="summary-pill">${config.mapeamentos.length} vínculo(s)</span>
      <span class="summary-pill">${camposTesteSgo.length} dado(s) do último teste</span>
    </div>
    <span>Fluxo: ${config.etapas.map(etapa => escapar(`${etapa.id} (${etapa.tipo})`)).join(" → ") || "sem etapas"}</span>
  `;
}

function lerConfiguracaoSgoDaTela() {
  if (!dadosSgoConfig) return null;
  return {
    ...dadosSgoConfig.configuracao,
    nome: document.getElementById("sgoConfigNome").value.trim(),
    etapas: [...document.querySelectorAll("#sgoEtapas .config-row")].map(row => ({
      id: row.querySelector("[data-step-id]").value.trim(),
      nome: row.querySelector("[data-step-id]").value.trim(),
      tipo: row.querySelector("[data-step-type]").value,
      entrada: row.querySelector("[data-step-input]").value.trim() || "$input",
      ativo: true
    })),
    mapeamentos: [...document.querySelectorAll("#sgoMapeamentos .mapping-row")].map(row => ({
      destino: row.querySelector("[data-map-dest]").value,
      origem: row.querySelector("[data-map-source]").value.trim(),
      transformacao: row.querySelector("[data-map-transform]").value,
      regra: row.querySelector("[data-map-rule]").value
    })).filter(item => item.destino && item.origem)
  };
}

function renderizarConfiguracaoSgo() {
  const { configuracao, tiposConsulta, colunas } = dadosSgoConfig;
  document.getElementById("sgoConfigNome").value = configuracao.nome || "";
  document.getElementById("sgoEtapaEntradaTeste").innerHTML = configuracao.etapas.map(etapa =>
    `<option value="${escapar(etapa.id)}">${escapar(etapa.id)} - ${escapar(etapa.tipo)}</option>`
  ).join("");
  document.getElementById("sgoEtapas").innerHTML = configuracao.etapas.map(etapa => `
    <div class="config-row step-card">
      <label>Nome da etapa<input data-step-id value="${escapar(etapa.id)}" aria-label="Identificador da etapa" placeholder="Identificador"></label>
      <label>Consulta<select data-step-type>${tiposConsulta.map(tipo => `<option value="${tipo}" ${tipo === etapa.tipo ? "selected" : ""}>${tipo}</option>`).join("")}</select></label>
      <label>Dado usado na consulta<select data-step-input>${opcoesFontesSgo(etapa.entrada || "$input")}</select></label>
      <button type="button" class="remove-config" data-remove-step title="Remover etapa">×</button>
    </div>
  `).join("");
  document.getElementById("sgoMapeamentos").innerHTML = configuracao.mapeamentos.map(item => `
    <div class="config-row mapping-row mapping-card">
      <label>Coluna do controle<select data-map-dest>${opcoesColunas(colunas, item.destino, false)}</select></label>
      <label>Dado do SGO<select data-map-source>${opcoesFontesSgo(item.origem, true)}</select></label>
      <label>Transformar<select data-map-transform>
        ${["automatico", "texto", "maiusculo", "minusculo", "numero", "data", "sim_nao"].map(tipo => `<option value="${tipo}" ${tipo === (item.transformacao || "automatico") ? "selected" : ""}>${tipo}</option>`).join("")}
      </select></label>
      <label>Regra<select data-map-rule>
        <option value="sempre" ${(item.regra || "sempre") === "sempre" ? "selected" : ""}>Sempre atualizar</option>
        <option value="se_vazio" ${item.regra === "se_vazio" ? "selected" : ""}>Só se estiver vazio</option>
        <option value="se_diferente" ${item.regra === "se_diferente" ? "selected" : ""}>Só se for diferente</option>
        <option value="nunca" ${item.regra === "nunca" ? "selected" : ""}>Não atualizar</option>
      </select></label>
      <button type="button" class="remove-config" data-remove-map title="Remover mapeamento">×</button>
    </div>
  `).join("");
  atualizarResumoSgo();
}

async function abrirConfiguracaoSgo() {
  document.getElementById("modalSgoConfig").hidden = false;
  document.getElementById("sgoCamposTeste").innerHTML = '<div class="empty-state compact">Carregando configuração...</div>';
  try {
    dadosSgoConfig = await window.sgoClient.carregarConfiguracao(true);
    renderizarConfiguracaoSgo();
    document.getElementById("sgoCamposTeste").innerHTML = '<div class="empty-state compact">Execute um teste para listar os campos retornados.</div>';
  } catch (error) {
    msgErro(error.message);
  }
}

function adicionarEtapaSgo() {
  dadosSgoConfig.configuracao = lerConfiguracaoSgoDaTela();
  const numero = dadosSgoConfig.configuracao.etapas.length + 1;
  dadosSgoConfig.configuracao.etapas.push({ id: `etapa${numero}`, tipo: dadosSgoConfig.tiposConsulta[0], entrada: "$input", ativo: true });
  renderizarConfiguracaoSgo();
}

function adicionarMapeamentoSgo(origem = "") {
  dadosSgoConfig.configuracao = lerConfiguracaoSgoDaTela();
  dadosSgoConfig.configuracao.mapeamentos.push({
    destino: dadosSgoConfig.colunas[0].campo,
    origem,
    transformacao: "automatico",
    regra: "sempre"
  });
  renderizarConfiguracaoSgo();
}

function opcoesTransformacao(selecionada = "automatico") {
  return ["automatico", "texto", "maiusculo", "minusculo", "numero", "data", "sim_nao"].map(tipo =>
    `<option value="${tipo}" ${tipo === selecionada ? "selected" : ""}>${tipo}</option>`
  ).join("");
}

function opcoesRegraAtualizacao(selecionada = "sempre") {
  return `
    <option value="sempre" ${selecionada === "sempre" ? "selected" : ""}>Sempre atualizar</option>
    <option value="se_vazio" ${selecionada === "se_vazio" ? "selected" : ""}>Só se estiver vazio</option>
    <option value="se_diferente" ${selecionada === "se_diferente" ? "selected" : ""}>Só se for diferente</option>
    <option value="nunca" ${selecionada === "nunca" ? "selected" : ""}>Não atualizar</option>`;
}

function renderizarCamposTesteSgo(resultado) {
  const container = document.getElementById("sgoCamposTeste");
  const configuracao = lerConfiguracaoSgoDaTela();
  document.getElementById("sgoPathsDisponiveis").innerHTML = camposTesteSgo.map(item =>
    `<option value="${escapar(item.caminho)}">${escapar(String(item.valor ?? "").slice(0, 120))}</option>`
  ).join("");
  dadosSgoConfig.configuracao = configuracao;
  renderizarConfiguracaoSgo();
  container.innerHTML = camposTesteSgo.length ? camposTesteSgo.map(item => {
    const atual = configuracao.mapeamentos.find(mapa => mapa.origem === item.caminho);
    return `
      <div class="test-field" data-test-path="${escapar(encodeURIComponent(item.caminho))}">
        <div><code title="${escapar(item.caminho)}">${escapar(item.caminho)}</code><span title="${escapar(String(item.valor ?? ""))}">${escapar(String(item.valor ?? ""))}</span></div>
        <div class="test-field-actions">
          <select data-test-destination>${opcoesColunas(dadosSgoConfig.colunas, atual?.destino || "")}</select>
          <select data-test-transform>${opcoesTransformacao(atual?.transformacao)}</select>
          <select data-test-rule>${opcoesRegraAtualizacao(atual?.regra)}</select>
          <button type="button" class="btn-secondary" data-apply-test-map>Aplicar vínculo</button>
          <button type="button" class="btn-secondary" data-use-step-input>Usar como entrada</button>
        </div>
      </div>
    `;
  }).join("") : '<div class="empty-state compact">A consulta não retornou campos.</div>';
  const preview = Object.entries(resultado.dados || {});
  const previewEl = document.getElementById("sgoPreviewMapeamento");
  previewEl.hidden = false;
  previewEl.innerHTML = preview.length
    ? `<strong>Prévia com a configuração atual</strong><br>${preview.map(([campo, valor]) => `${escapar(campo)}: ${escapar(String(valor))}`).join("<br>")}`
    : "<strong>Prévia:</strong> nenhum campo seria atualizado com a configuração atual.";
}

async function testarConfiguracaoSgo() {
  const id = document.getElementById("sgoTesteId").value.trim();
  if (!id) return msgAviso("Informe um projeto ou nota para testar.");
  const container = document.getElementById("sgoCamposTeste");
  container.innerHTML = '<div class="empty-state compact">Consultando o SGO pela VPN...</div>';
  try {
    const resultado = await window.sgoClient.executarPipeline(id, lerConfiguracaoSgoDaTela());
    camposTesteSgo = window.sgoClient.achatar(resultado.contexto.steps, "$steps");
    renderizarCamposTesteSgo(resultado);
    msgSucesso(`${camposTesteSgo.length} campo(s) encontrado(s).`);
  } catch (error) {
    container.innerHTML = `<div class="empty-state compact">${escapar(error.message)}</div>`;
    msgErro(error.message);
  }
}

async function salvarConfiguracaoSgo() {
  try {
    const config = lerConfiguracaoSgoDaTela();
    const data = await requisicao("/api/admin/sgo/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config)
    });
    dadosSgoConfig.configuracao = data.configuracao;
    renderizarConfiguracaoSgo();
    await window.sgoClient.carregarConfiguracao(true);
    msgSucesso(data.message);
  } catch (error) {
    msgErro(error.message);
  }
}

function normalizarCabecalho(valor) {
  return String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function renderizarAnaliseImportacao() {
  const { cabecalhos, previa, colunasDestino, abas, aba } = analiseImportacao;
  document.getElementById("importSheet").innerHTML = abas.map(item =>
    `<option value="${item.indice}" ${item.indice === aba.indice ? "selected" : ""}>${escapar(item.nome)}</option>`
  ).join("");
  document.getElementById("importOptions").hidden = false;
  document.getElementById("importLookupConfig").hidden = false;
  document.getElementById("btnExecutarImportacao").hidden = false;
  document.getElementById("btnSimularImportacao").hidden = false;
  const projetoOrigem = cabecalhos.find(item => normalizarCabecalho(item.titulo) === "projeto")?.indice || cabecalhos[0].indice;
  document.getElementById("importLookupRows").innerHTML = linhaBuscaImportacao({
    origem: projetoOrigem, destino: "projeto", comparacao: "normalizado"
  });
  document.getElementById("importResumoVisual").hidden = false;
  document.getElementById("importResumoVisual").innerHTML = `
    <strong>Assistente visual do PROCX</strong>
    <div class="summary-pills">
      <span class="summary-pill">${cabecalhos.length} coluna(s) encontradas</span>
      <span class="summary-pill">${previa.length} linha(s) de prévia</span>
      <span class="summary-pill">Simulação sem gravar</span>
    </div>
    <span>Escolha as chaves de procura e depois selecione quais colunas da planilha retornam para o controle.</span>
  `;
  document.getElementById("importMapeamentos").innerHTML = `
    <div class="import-map-cards">${cabecalhos.map((cabecalho, posicao) => {
        const automatica = colunasDestino.find(coluna =>
          normalizarCabecalho(coluna.campo) === normalizarCabecalho(cabecalho.titulo) ||
          normalizarCabecalho(coluna.titulo) === normalizarCabecalho(cabecalho.titulo)
        )?.campo || "";
        const amostras = previa.map(item => item.valores[posicao]).filter(item => String(item ?? "").trim()).slice(0, 4).join(" | ");
        return `<div class="import-map-card">
          <label>Retornar da planilha<strong>${escapar(cabecalho.titulo)}</strong></label>
          <label>Gravar no controle<select class="import-map-select" data-source-index="${cabecalho.indice}">${opcoesColunas(colunasDestino, automatica)}</select></label>
          <label>Transformar<select class="import-transform-select">${["automatico", "texto", "maiusculo", "minusculo", "numero", "data"].map(item => `<option value="${item}">${item}</option>`).join("")}</select></label>
          <label>Regra<select class="import-rule-select">${opcoesRegraAtualizacao("sempre")}</select></label>
          <div class="preview-values" title="${escapar(amostras)}"><strong>Prévia</strong><br>${escapar(amostras || "-")}</div>
        </div>`;
      }).join("")}</div>
  `;
  document.getElementById("importSimulation").hidden = true;
}

function opcoesCabecalhosImportacao(selecionado = "") {
  return analiseImportacao.cabecalhos.map(item =>
    `<option value="${item.indice}" ${Number(selecionado) === item.indice ? "selected" : ""}>${escapar(item.titulo)}</option>`
  ).join("");
}

function linhaBuscaImportacao(busca = {}) {
  return `
    <div class="lookup-row">
      <select data-lookup-source>${opcoesCabecalhosImportacao(busca.origem)}</select>
      <select data-lookup-destination>${opcoesColunas(analiseImportacao.colunasDestino, busca.destino || "projeto", false)}</select>
      <select data-lookup-comparison>
        <option value="exato" ${busca.comparacao === "exato" ? "selected" : ""}>Exato, ignorando maiúsculas</option>
        <option value="normalizado" ${busca.comparacao === "normalizado" ? "selected" : ""}>Ignorar espaços, sinais e acentos</option>
        <option value="numeros" ${busca.comparacao === "numeros" ? "selected" : ""}>Comparar somente números</option>
        <option value="contem" ${busca.comparacao === "contem" ? "selected" : ""}>Campo do controle contém o valor</option>
      </select>
      <button type="button" class="remove-config" data-remove-lookup title="Remover chave">×</button>
    </div>`;
}

async function analisarImportacao() {
  arquivoImportacao = document.getElementById("arquivoImportarAsbuilt").files[0];
  if (!arquivoImportacao) return msgAviso("Escolha um arquivo XLSX.");
  const sheet = document.getElementById("importSheet").value || 1;
  const headerRow = document.getElementById("importHeaderRow").value || 1;
  try {
    const response = await fetch(`/api/controle-asbuilt/importar/analisar?sheet=${sheet}&headerRow=${headerRow}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/octet-stream" },
      body: arquivoImportacao
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Não foi possível analisar a planilha.");
    analiseImportacao = data;
    renderizarAnaliseImportacao();
    msgSucesso("Planilha analisada. Revise os mapeamentos antes de importar.");
  } catch (error) {
    msgErro(error.message);
  }
}

function base64UrlJson(valor) {
  const bytes = new TextEncoder().encode(JSON.stringify(valor));
  let binario = "";
  bytes.forEach(byte => { binario += String.fromCharCode(byte); });
  return btoa(binario).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function coletarConfigImportacao() {
  const mapeamentos = [...document.querySelectorAll("#importMapeamentos .import-map-card")].map(row => ({
    origem: Number(row.querySelector(".import-map-select").dataset.sourceIndex),
    destino: row.querySelector(".import-map-select").value,
    transformacao: row.querySelector(".import-transform-select").value,
    regra: row.querySelector(".import-rule-select").value
  })).filter(item => item.destino);
  const buscas = [...document.querySelectorAll("#importLookupRows .lookup-row")].map(row => ({
    origem: Number(row.querySelector("[data-lookup-source]").value),
    destino: row.querySelector("[data-lookup-destination]").value,
    comparacao: row.querySelector("[data-lookup-comparison]").value
  }));
  return {
    sheet: Number(document.getElementById("importSheet").value),
    headerRow: Number(document.getElementById("importHeaderRow").value),
    modo: document.getElementById("importModo").value,
    ambiguos: document.getElementById("importAmbiguos").value,
    sobrescreverVazios: document.getElementById("importSobrescreverVazios").checked,
    buscas,
    mapeamentos
  };
}

function renderizarSimulacaoImportacao(resumo) {
  const elemento = document.getElementById("importSimulation");
  elemento.hidden = false;
  elemento.innerHTML = `
    <strong>Resultado da simulação, sem alterar a base</strong>
    <div class="simulation-grid">
      <div class="simulation-metric"><strong>${resumo.correspondencias}</strong>Correspondências</div>
      <div class="simulation-metric"><strong>${resumo.semCorrespondencia}</strong>Sem correspondência</div>
      <div class="simulation-metric"><strong>${resumo.atualizados}</strong>Seriam atualizados</div>
      <div class="simulation-metric"><strong>${resumo.adicionados}</strong>Seriam adicionados</div>
    </div>
    ${resumo.ambiguos ? `<p>Atenção: ${resumo.ambiguos} linha(s) encontraram mais de um registro. A ação segue a regra de ambiguidade escolhida acima.</p>` : ""}
    ${resumo.erros.length ? `<p>${escapar(resumo.erros.slice(0, 4).join(" | "))}</p>` : ""}
  `;
}

async function enviarImportacao(acao) {
  if (!arquivoImportacao || !analiseImportacao) return msgAviso("Analise uma planilha antes de importar.");
  const config = coletarConfigImportacao();
  if (acao === "executar" && !confirm("Executar a importação com as regras configuradas?")) return;
  try {
    const response = await fetch(`/api/controle-asbuilt/importar/${acao}?config=${base64UrlJson(config)}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/octet-stream" },
      body: arquivoImportacao
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Não foi possível importar a planilha.");
    const resumo = data.resumo;
    if (acao === "simular") {
      renderizarSimulacaoImportacao(resumo);
      return msgSucesso("Simulação concluída. Nenhum dado foi alterado.");
    }
    msgSucesso(`${resumo.adicionados} adicionado(s), ${resumo.atualizados} atualizado(s), ${resumo.ignorados} ignorado(s).`);
    if (resumo.erros.length) msgAviso(resumo.erros.slice(0, 3).join(" | "));
    document.getElementById("modalImportarAsbuilt").hidden = true;
    await carregarRegistros();
  } catch (error) {
    msgErro(error.message);
  }
}

async function executarImportacao() {
  return enviarImportacao("executar");
}

document.getElementById("busca").addEventListener("input", () => agendarCarregamento(1));
document.getElementById("btnAtualizar").addEventListener("click", () => carregarRegistros(paginacaoAsbuilt.pagina));
document.getElementById("btnExportar").addEventListener("click", exportarPlanilha);
document.getElementById("btnAtualizarV2Sgo").addEventListener("click", atualizarTodosV2Sgo);
document.getElementById("btnColunas").addEventListener("click", abrirColunas);
document.getElementById("btnValidacoes").addEventListener("click", abrirValidacoes);
document.getElementById("btnExcluirColunasDB").addEventListener("click", abrirExclusaoColunasBanco);
document.getElementById("btnAtualizarSelecionadas").addEventListener("click", abrirAtualizacaoColunas);
document.getElementById("btnPaginaAnterior").addEventListener("click", () => carregarRegistros(paginacaoAsbuilt.pagina - 1));
document.getElementById("btnProximaPagina").addEventListener("click", () => carregarRegistros(paginacaoAsbuilt.pagina + 1));
document.getElementById("limitePagina").addEventListener("change", () => carregarRegistros(1));
document.getElementById("btnConfigSgo").addEventListener("click", abrirConfiguracaoSgo);
document.getElementById("btnConfigSgoTopo").addEventListener("click", abrirConfiguracaoSgo);
document.getElementById("btnFecharSgoConfig").addEventListener("click", () => { document.getElementById("modalSgoConfig").hidden = true; });
document.getElementById("btnAdicionarEtapa").addEventListener("click", adicionarEtapaSgo);
document.getElementById("btnAdicionarMapeamento").addEventListener("click", () => adicionarMapeamentoSgo());
document.getElementById("btnTestarSgoConfig").addEventListener("click", testarConfiguracaoSgo);
document.getElementById("btnSalvarSgoConfig").addEventListener("click", salvarConfiguracaoSgo);
document.getElementById("btnImportarAsbuilt").addEventListener("click", () => { document.getElementById("modalImportarAsbuilt").hidden = false; });
document.getElementById("btnImportarAsbuiltTopo").addEventListener("click", () => { document.getElementById("modalImportarAsbuilt").hidden = false; });
document.getElementById("btnFecharImportar").addEventListener("click", () => { document.getElementById("modalImportarAsbuilt").hidden = true; });
document.getElementById("btnAnalisarImportacao").addEventListener("click", analisarImportacao);
document.getElementById("btnSimularImportacao").addEventListener("click", () => enviarImportacao("simular"));
document.getElementById("btnExecutarImportacao").addEventListener("click", executarImportacao);
document.getElementById("btnAdicionarBuscaImportacao").addEventListener("click", () => {
  if (!analiseImportacao) return msgAviso("Analise a planilha primeiro.");
  document.getElementById("importLookupRows").insertAdjacentHTML("beforeend", linhaBuscaImportacao());
});
document.getElementById("importLookupRows").addEventListener("click", event => {
  if (!event.target.matches("[data-remove-lookup]")) return;
  const linhas = document.querySelectorAll("#importLookupRows .lookup-row");
  if (linhas.length <= 1) return msgAviso("Mantenha ao menos uma chave de procura.");
  event.target.closest(".lookup-row").remove();
});
document.getElementById("importModo").addEventListener("change", event => {
  document.getElementById("importLookupConfig").hidden = event.target.value === "adicionar";
});
document.getElementById("btnSalvarColunas").addEventListener("click", salvarColunas);
document.getElementById("btnCancelarColunas").addEventListener("click", () => { document.getElementById("modalColunas").hidden = true; });
document.getElementById("btnFecharValidacoes").addEventListener("click", () => { document.getElementById("modalColunas").hidden = true; });
document.getElementById("btnPadraoColunas").addEventListener("click", () => {
  camposVisiveis = new Set(COLUNAS_PADRAO);
  camposVisiveis.add("projeto");
  ordemCamposColunas = [...COLUNAS_PADRAO];
  renderizarListaColunas();
});
document.getElementById("listaColunas").addEventListener("dragstart", iniciarArrasteColuna);
document.getElementById("listaColunas").addEventListener("dragover", arrastarSobreColuna);
document.getElementById("listaColunas").addEventListener("drop", soltarColuna);
document.getElementById("listaColunas").addEventListener("dragend", limparArrasteColunas);
document.getElementById("formNovaColuna").addEventListener("submit", event => {
  criarColuna(event).catch(error => msgErro(error.message));
});
document.getElementById("novaColunaTipo").addEventListener("change", event => {
  document.getElementById("novaColunaOpcoesLabel").hidden = event.target.value !== "lista";
});
document.getElementById("listaColunasAdmin").addEventListener("click", event => {
  const linha = event.target.closest("[data-column-field]");
  if (!linha) return;
  if (event.target.matches("[data-save-column]")) salvarColuna(linha).catch(error => msgErro(error.message));
  if (event.target.matches("[data-delete-column]")) excluirColuna(linha.dataset.columnField).catch(error => msgErro(error.message));
});
document.getElementById("listaColunasBanco").addEventListener("click", event => {
  if (!event.target.matches("[data-delete-db-column]")) return;
  const linha = event.target.closest("[data-database-column]");
  excluirColuna(linha.dataset.databaseColumn).catch(error => msgErro(error.message));
});
document.getElementById("listaColunasAdmin").addEventListener("change", event => {
  if (!event.target.matches("[data-column-type]")) return;
  const linha = event.target.closest("[data-column-field]");
  linha.querySelector(".validation-options").hidden = event.target.value !== "lista";
});
document.getElementById("btnAdicionarBulkColuna").addEventListener("click", () => {
  document.getElementById("bulkColumnRows").insertAdjacentHTML("beforeend", linhaBulkColuna());
});
document.getElementById("btnCancelarBulkColunas").addEventListener("click", () => { document.getElementById("modalAtualizarColunas").hidden = true; });
document.getElementById("btnExecutarBulkColunas").addEventListener("click", () => {
  executarAtualizacaoColunas().catch(error => msgErro(error.message));
});
document.getElementById("btnCancelarV2").addEventListener("click", () => {
  cancelarAtualizacaoV2 = true;
  document.getElementById("btnCancelarV2").disabled = true;
  document.getElementById("v2StatusTexto").textContent = "Cancelando após a consulta atual...";
});
document.getElementById("btnFecharV2").addEventListener("click", () => {
  document.getElementById("modalAtualizarV2").hidden = true;
});
document.getElementById("menuAcoesControle").addEventListener("click", event => {
  if (event.target.closest("button")) event.currentTarget.removeAttribute("open");
});
document.getElementById("bulkColumnRows").addEventListener("change", event => {
  if (event.target.matches("[data-bulk-field]")) atualizarInputBulk(event.target.closest(".bulk-column-row"));
});
document.getElementById("bulkColumnRows").addEventListener("click", event => {
  if (!event.target.matches("[data-remove-bulk]")) return;
  if (document.querySelectorAll("#bulkColumnRows .bulk-column-row").length <= 1) return msgAviso("Mantenha ao menos uma coluna.");
  event.target.closest(".bulk-column-row").remove();
});
document.getElementById("btnNovaLinha").addEventListener("click", () => {
  document.getElementById("modalNovoProjeto").hidden = false;
  document.getElementById("novoProjeto").focus();
});
document.getElementById("btnCancelarNovo").addEventListener("click", () => { document.getElementById("modalNovoProjeto").hidden = true; });
document.getElementById("formNovoProjeto").addEventListener("submit", async event => {
  event.preventDefault();
  const formulario = event.currentTarget;
  try {
    await criarProjeto(document.getElementById("novoProjeto").value.trim(), document.getElementById("novaVersao").value);
    formulario.reset();
    document.getElementById("modalNovoProjeto").hidden = true;
  } catch (error) {
    msgErro(error.message);
  }
});
document.getElementById("btnConsultarSgo").addEventListener("click", () => {
  atualizarSgoRegistros(registrosAsbuilt.filter(item => selecionados.has(Number(item.id))));
});
document.getElementById("sgoEtapas").addEventListener("click", event => {
  if (event.target.matches("[data-remove-step]")) event.target.closest(".config-row").remove();
});
document.getElementById("sgoMapeamentos").addEventListener("click", event => {
  if (event.target.matches("[data-remove-map]")) event.target.closest(".config-row").remove();
});
document.getElementById("sgoCamposTeste").addEventListener("click", event => {
  const linha = event.target.closest("[data-test-path]");
  if (!linha) return;
  const origem = decodeURIComponent(linha.dataset.testPath);
  if (event.target.matches("[data-apply-test-map]")) {
    const destino = linha.querySelector("[data-test-destination]").value;
    dadosSgoConfig.configuracao = lerConfiguracaoSgoDaTela();
    dadosSgoConfig.configuracao.mapeamentos = dadosSgoConfig.configuracao.mapeamentos.filter(item =>
      destino ? !(item.origem === origem && item.destino === destino) : item.origem !== origem
    );
    if (destino) {
      dadosSgoConfig.configuracao.mapeamentos.push({
        origem,
        destino,
        transformacao: linha.querySelector("[data-test-transform]").value,
        regra: linha.querySelector("[data-test-rule]").value
      });
    }
    renderizarConfiguracaoSgo();
    return msgSucesso(destino ? "Vínculo aplicado. Salve a automação para ativá-lo." : "Vínculo removido.");
  }
  if (event.target.matches("[data-use-step-input]")) {
    const etapaId = document.getElementById("sgoEtapaEntradaTeste").value;
    dadosSgoConfig.configuracao = lerConfiguracaoSgoDaTela();
    const etapa = dadosSgoConfig.configuracao.etapas.find(item => item.id === etapaId);
    if (!etapa) return msgAviso("Escolha uma etapa válida.");
    etapa.entrada = origem;
    renderizarConfiguracaoSgo();
    msgSucesso(`O dado selecionado agora alimenta a etapa ${etapaId}.`);
  }
});

document.getElementById("tabelaAsbuilt").addEventListener("input", event => {
  if (event.target.matches(".excel-filter")) {
    filtrosColuna.set(event.target.dataset.filterField, event.target.value.trim().toLocaleLowerCase("pt-BR"));
    agendarSugestoesFiltro(event.target);
    return agendarCarregamento(1);
  }
  if (event.target.matches(".sheet-input") && podeEditarAsbuilt && event.target.type !== "checkbox") agendarSalvamento(event.target);
});
document.getElementById("tabelaAsbuilt").addEventListener("focusin", event => {
  if (event.target.matches(".excel-filter")) carregarSugestoesFiltro(event.target);
});
document.getElementById("tabelaAsbuilt").addEventListener("change", event => {
  if (event.target.matches(".sheet-input") && podeEditarAsbuilt) agendarSalvamento(event.target, true);
});
document.getElementById("tabelaAsbuilt").addEventListener("click", event => {
  if (event.target.id === "btnLimparFiltros") {
    filtrosColuna.clear();
    document.querySelectorAll(".excel-filter").forEach(input => { input.value = ""; });
    return carregarRegistros(1);
  }
  if (event.target.dataset.deleteId) return excluirLinha(Number(event.target.dataset.deleteId));
  const linha = event.target.closest("[data-row-id]");
  if (linha) selecionarLinha(Number(linha.dataset.rowId), event);
});
document.getElementById("tabelaAsbuilt").addEventListener("keydown", event => {
  if (event.key !== "Enter" || !event.target.matches(".sheet-input")) return;
  event.preventDefault();
  agendarSalvamento(event.target, true);
  const campo = event.target.dataset.field;
  const inputs = [...document.querySelectorAll(`.sheet-input[data-field="${campo}"]`)];
  inputs[inputs.indexOf(event.target) + 1]?.focus();
});

document.addEventListener("keydown", event => {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "a") return;
  if (event.target.matches("input, textarea, select, [contenteditable='true']")) return;
  if (document.querySelector(".modal-backdrop:not([hidden])")) return;
  event.preventDefault();
  selecionarTodasLinhas();
});

document.addEventListener("usuario-carregado", event => {
  podeEditarAsbuilt = event.detail.permissoes.includes("medicao.controle_asbuilt.editar");
  const permissoes = event.detail.permissoes || [];
  const administrador = event.detail.tipo_usuario === "admin";
  podeAdministrarColunas = administrador;
  const podeConfigurarSgo = administrador || permissoes.includes("admin.sgo_config");
  const podeImportarAsbuilt = administrador || permissoes.includes("admin.asbuilt_importar");
  document.getElementById("btnConfigSgo").hidden = !podeConfigurarSgo;
  document.getElementById("btnConfigSgoTopo").hidden = !podeConfigurarSgo;
  document.getElementById("btnImportarAsbuilt").hidden = !podeImportarAsbuilt;
  document.getElementById("btnImportarAsbuiltTopo").hidden = !podeImportarAsbuilt;
  document.getElementById("btnNovaLinha").hidden = !podeEditarAsbuilt;
  document.getElementById("btnConsultarSgo").hidden = !podeEditarAsbuilt;
  document.getElementById("btnAtualizarV2Sgo").hidden = !podeEditarAsbuilt;
  document.getElementById("btnAtualizarSelecionadas").hidden = !podeEditarAsbuilt;
  document.getElementById("btnValidacoes").hidden = !podeAdministrarColunas;
  document.getElementById("btnExcluirColunasDB").hidden = !podeAdministrarColunas;
  carregarRegistros();
});
