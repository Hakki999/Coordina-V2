let todasSolicitacoes = [];
let solicitacoesFiltradas = [];
let solicitacaoAbertaId = null;
let usuarioAtual = window.usuarioAtual || null;

const tabelaSolicitacoes = document.getElementById("tabelaSolicitacoes");
const contadorSolicitacoes = document.getElementById("contadorSolicitacoes");

const buscaGeral = document.getElementById("buscaGeral");
const filtroCidade = document.getElementById("filtroCidade");
const filtroEquipe = document.getElementById("filtroEquipe");
const filtroStatus = document.getElementById("filtroStatus");
const filtroTipo = document.getElementById("filtroTipo");
const dataInicio = document.getElementById("dataInicio");
const dataFim = document.getElementById("dataFim");

const btnAtualizar = document.getElementById("btnAtualizar");
const btnLimparFiltros = document.getElementById("btnLimparFiltros");
const modalMateriais = document.getElementById("modalMateriais");
const resumoSolicitacao = document.getElementById("resumoSolicitacao");
const tabelaMateriaisModal = document.getElementById("tabelaMateriaisModal");
const btnFecharModal = document.getElementById("btnFecharModal");
const btnCancelarSolicitacao = document.getElementById("btnCancelarSolicitacao");
const tituloModalSolicitacao = document.getElementById("tituloModalSolicitacao");
const descricaoModalOperacao = document.getElementById("descricaoModalOperacao");
const timersSalvamento = new Map();
const salvamentosEmAndamento = new Set();
const salvamentosPendentes = new Set();

document.addEventListener("usuario-carregado", event => {
  usuarioAtual = event.detail;
  renderizarSolicitacoes();
});

function escaparHTML(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizarTexto(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatarData(data, horario = false) {
  if (!data) return "-";

  const dataLimpa = String(data).split("T")[0];
  const partes = dataLimpa.split("-");

  if (partes.length !== 3) {
    return dataLimpa;
  }

  if (horario) {
    const horario = String(data).split("T")[1]?.substring(0, 5) || "";
    return `${partes[2]}/${partes[1]}/${partes[0]} ${horario}`;
  }

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function formatarStatus(status) {
  const valor = String(status || "pendente").toLowerCase();

  const nomes = {
    pendente: "Pendente",
    separado: "Separado",
    entregue: "Entregue",
    cancelado: "Cancelado",
    concluido: "Concluído"
  };

  return nomes[valor] || status;
}

function classeStatus(status) {
  const valor = String(status || "pendente").toLowerCase();
  return `status-badge status-${valor}`;
}

function pegarIdSolicitacao(item) {
  return item.id || item.solicitacao_id || item.id_solicitacao;
}

function podeCancelarSolicitacao(status) {
  return Boolean(usuarioAtual)
    && !["cancelado", "concluido"].includes(status)
    && usuarioAtual.permissoes?.includes("logistica.solicitacoes.cancelar");
}

function podeEditarQuantidades() {
  return usuarioAtual?.permissoes?.includes("logistica.solicitacoes.operar");
}

function normalizarSolicitacoes(rows) {
  const mapa = new Map();

  rows.forEach((item) => {
    const id = pegarIdSolicitacao(item);

    if (!id) return;

    if (!mapa.has(id)) {
      mapa.set(id, {
        id,
        usuario_id: item.usuario_id,
        regional: item.regional,
        projeto: item.projeto || "",
        cidade: item.cidade || "",
        equipe: item.equipe || "",
        tensao_rede: item.tensao_rede || "",
        data_exe: item.data_exe || "",
        tipo_servico: item.tipo_servico || "",
        observacao: item.observacao || "",
        criado_em: item.criado_em || "",
        status: item.status || "pendente",
        cancelado_em: item.cancelado_em || null,
        cancelado_por: item.cancelado_por || null,
        materiais: []
      });
    }

    const solicitacao = mapa.get(id);

    const descricao =
      item.descricao_material ||
      item.descricao ||
      item.material ||
      "";

    const quantidade =
      item.quantidade_sol ||
      item.quantidade ||
      item.qtd ||
      "";

    if (descricao) {
      solicitacao.materiais.push({
        id: item.item_id,
        codigo_material: item.codigo_material || "",
        descricao,
        quantidade,
        quantidade_lib: item.quantidade_lib ?? 0,
        quantidade_dev: item.quantidade_dev ?? 0,
        unidade: item.unidade || ""
      });
    }
  });

  return Array.from(mapa.values());
}

async function carregarSolicitacoes() {
  try {
    tabelaSolicitacoes.innerHTML = `
      <tr>
        <td colspan="9" class="empty-row">
          Carregando solicitações...
        </td>
      </tr>
    `;

    const response = await fetch("/api/solicitacoes", { credentials: "include" });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Erro ao listar solicitações.");
    }

    msgSucesso("Solicitações carregadas com sucesso!");

    todasSolicitacoes = normalizarSolicitacoes(data);

    preencherFiltros();
    aplicarFiltros();

  } catch (error) {
    msgErro("Erro ao carregar solicitações");
    console.error("Erro ao carregar solicitações:", error);

    tabelaSolicitacoes.innerHTML = `
      <tr>
        <td colspan="9" class="empty-row">
          Erro ao carregar solicitações.
        </td>
      </tr>
    `;
  }
}

function preencherFiltros() {
  const cidades = [...new Set(todasSolicitacoes.map((s) => s.cidade).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  const equipes = [...new Set(todasSolicitacoes.map((s) => s.equipe).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  preencherSelect(filtroCidade, cidades, "Todas");
  preencherSelect(filtroEquipe, equipes, "Todas");
}

function preencherSelect(select, valores, textoInicial) {
  const valorAtual = select.value;

  select.innerHTML = `<option value="">${textoInicial}</option>`;

  valores.forEach((valor) => {
    const option = document.createElement("option");
    option.value = valor;
    option.textContent = valor;
    select.appendChild(option);
  });

  select.value = valorAtual;
}

function aplicarFiltros() {
  const termo = normalizarTexto(buscaGeral.value);
  const cidade = normalizarTexto(filtroCidade.value);
  const equipe = normalizarTexto(filtroEquipe.value);
  const status = normalizarTexto(filtroStatus.value);
  const tipo = normalizarTexto(filtroTipo.value);

  const inicio = dataInicio.value ? new Date(dataInicio.value + "T00:00:00") : null;
  const fim = dataFim.value ? new Date(dataFim.value + "T23:59:59") : null;

  solicitacoesFiltradas = todasSolicitacoes.filter((item) => {
    const textoGeral = normalizarTexto(`
      ${item.id}
      ${item.projeto}
      ${item.cidade}
      ${item.equipe}
      ${item.status}
      ${item.tipo_servico}
      ${item.observacao}
    `);

    const dataExecucao = item.data_exe
      ? new Date(String(item.data_exe).split("T")[0] + "T12:00:00")
      : null;

    if (termo && !textoGeral.includes(termo)) return false;
    if (cidade && normalizarTexto(item.cidade) !== cidade) return false;
    if (equipe && normalizarTexto(item.equipe) !== equipe) return false;
    if (status && normalizarTexto(item.status) !== status) return false;
    if (tipo && normalizarTexto(item.tipo_servico) !== tipo) return false;

    if (inicio && !dataExecucao) return false;
    if (fim && !dataExecucao) return false;

    if (inicio && dataExecucao < inicio) return false;
    if (fim && dataExecucao > fim) return false;

    return true;
  });

  renderizarSolicitacoes();
}

function renderizarSolicitacoes() {
  tabelaSolicitacoes.innerHTML = "";

  contadorSolicitacoes.textContent =
    `${solicitacoesFiltradas.length} ${solicitacoesFiltradas.length === 1 ? "solicitação encontrada" : "solicitações encontradas"}`;

  if (solicitacoesFiltradas.length === 0) {
    tabelaSolicitacoes.innerHTML = `
      <tr>
        <td colspan="9" class="empty-row">
          Nenhuma solicitação encontrada.
        </td>
      </tr>
    `;

    return;
  }

  solicitacoesFiltradas.forEach((item) => {
    const tr = document.createElement("tr");

    tr.dataset.id = item.id;
    if (item.status === "cancelado") tr.classList.add("linha-cancelada");
    if (item.status === "concluido") tr.classList.add("linha-concluida");
    const podeCancelar = podeCancelarSolicitacao(item.status);

    tr.innerHTML = `
      <td data-label="ID">#${item.id}</td>
      <td data-label="Projeto">${escaparHTML(item.projeto || "-")}</td>
      <td data-label="Cidade">${escaparHTML(item.cidade || "-")}</td>
      <td data-label="Equipe">${escaparHTML(item.equipe || "-")}</td>
      <td data-label="Tensão">${escaparHTML(item.tensao_rede ? item.tensao_rede + " kV" : "-")}</td>
      <td data-label="Execução">${formatarData(item.data_exe)}</td>
      <td data-label="Tipo">${escaparHTML(item.tipo_servico || "-")}</td>
      <td data-label="Status">
        <span class="${classeStatus(item.status)}">
          ${formatarStatus(item.status)}
        </span>
      </td>
      <td data-label="Ações" class="acoes-solicitacao">
        <button type="button" class="btn-operar">Detalhes</button>
        <button type="button" class="btn-detalhes">Imprimir</button>
        ${podeCancelar ? '<button type="button" class="btn-cancelar-linha">Cancelar</button>' : ""}
      </td>
    `;

    tr.addEventListener("dblclick", () => {
      abrirMateriaisSolicitados(item.id);
    });

    tr.querySelector(".btn-detalhes").addEventListener("click", (event) => {
      event.stopPropagation();
      imprimirListaMateriais(item);
    });

    tr.querySelector(".btn-operar").addEventListener("click", event => {
      event.stopPropagation();
      abrirMateriaisSolicitados(item.id);
    });

    tr.querySelector(".btn-cancelar-linha")?.addEventListener("click", event => {
      event.stopPropagation();
      cancelarSolicitacao(item.id);
    });

    tabelaSolicitacoes.appendChild(tr);
  });
}

function abrirMateriaisSolicitados(id) {
  const solicitacao = todasSolicitacoes.find((item) => {
    return String(item.id) === String(id);
  });

  if (!solicitacao) return;
  solicitacaoAbertaId = solicitacao.id;
  tituloModalSolicitacao.textContent = `Solicitação #${solicitacao.id}`;
  const podeCancelar = podeCancelarSolicitacao(solicitacao.status);
  btnCancelarSolicitacao.hidden = !podeCancelar;
  descricaoModalOperacao.textContent = podeEditarQuantidades()
    ? "As alterações em liberada e devolvida são salvas automaticamente."
    : "Consulte os materiais desta solicitação.";

  document.querySelectorAll(".solicitacoes-table tbody tr").forEach((tr) => {
    tr.classList.remove("linha-selecionada");
  });

  const linha = document.querySelector(`.solicitacoes-table tbody tr[data-id="${id}"]`);

  if (linha) {
    linha.classList.add("linha-selecionada");
  }

  resumoSolicitacao.innerHTML = `
    ${["cancelado", "concluido"].includes(solicitacao.status) ? `
      <div class="cancelamento-alerta">
        Solicitação ${solicitacao.status === "concluido" ? "concluída após cancelamento" : "cancelada"}${solicitacao.cancelado_em ? ` em ${formatarData(solicitacao.cancelado_em)}` : ""}.
        O registro permanece disponível para consulta.
      </div>
    ` : ""}
    <div class="resumo-item">
      <span>Projeto</span>
      <strong>${escaparHTML(solicitacao.projeto || "-")}</strong>
    </div>

    <div class="resumo-item">
      <span>Cidade</span>
      <strong>${escaparHTML(solicitacao.cidade || "-")}</strong>
    </div>

    <div class="resumo-item">
      <span>Equipe</span>
      <strong>${escaparHTML(solicitacao.equipe || "-")}</strong>
    </div>

    <div class="resumo-item">
      <span>Status</span>
      <strong>${formatarStatus(solicitacao.status)}</strong>
    </div>

    <div class="resumo-item">
      <span>Tensão</span>
      <strong>${solicitacao.tensao_rede ? solicitacao.tensao_rede + " kV" : "-"}</strong>
    </div>

    <div class="resumo-item">
      <span>Execução</span>
      <strong>${formatarData(solicitacao.data_exe)}</strong>
    </div>

    <div class="resumo-item">
      <span>Tipo</span>
      <strong>${escaparHTML(solicitacao.tipo_servico || "-")}</strong>
    </div>

    <div class="resumo-item">
      <span>Criado em</span>
      <strong>${formatarData(solicitacao.criado_em, true)}</strong>
    </div>
  `;

  renderizarMateriaisModal(solicitacao.materiais);

  modalMateriais.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function renderizarMateriaisModal(materiais) {
  tabelaMateriaisModal.innerHTML = "";

  if (!materiais || materiais.length === 0) {
    tabelaMateriaisModal.innerHTML = `
      <tr>
        <td colspan="6" class="empty-row">
          Nenhum material encontrado para esta solicitação.
        </td>
      </tr>
    `;

    return;
  }

  materiais.forEach((material) => {
    const tr = document.createElement("tr");
    const podeEditar = podeEditarQuantidades();


    material.quantidade_lib = material.quantidade_lib == 0.00 ? "" : material.quantidade_lib;
    material.quantidade_dev = material.quantidade_dev == 0.00 ? "" : material.quantidade_dev;

    tr.innerHTML = `
      <td data-label="Código">${escaparHTML(material.codigo_material || "-")}</td>
      <td data-label="Descrição">${escaparHTML(material.descricao || "-")}</td>
      <td data-label="Solicitada">${escaparHTML(material.quantidade || "-")}</td>
      <td data-label="Liberada">
        ${podeEditar ? `
          <input class="input-operacao input-liberada" type="number" min="0" step="0.01"
            value="${escaparHTML(material.quantidade_lib)}"
            aria-label="Quantidade liberada de ${escaparHTML(material.descricao)}" />
        ` : `<strong class="quantidade-consulta">${escaparHTML(material.quantidade_lib)}</strong>`}
      </td>
      <td data-label="Devolvida">
        ${podeEditar ? `
          <input class="input-operacao input-devolvida" type="number" min="0" step="0.01"
            max="${escaparHTML(material.quantidade_lib)}" value="${escaparHTML(material.quantidade_dev)}"
            aria-label="Quantidade devolvida de ${escaparHTML(material.descricao)}" />
        ` : `<strong class="quantidade-consulta">${escaparHTML(material.quantidade_dev)}</strong>`}
      </td>
      <td data-label="Atualização">
        <span class="estado-salvamento ${podeEditar ? "" : "somente-consulta"}">
          ${podeEditar ? "Sem alterações" : "Somente consulta"}
        </span>
      </td>
    `;

    if (podeEditar) configurarSalvamentoAutomatico(material, tr);

    tabelaMateriaisModal.appendChild(tr);
  });
}

function configurarSalvamentoAutomatico(material, linha) {
  const liberada = linha.querySelector(".input-liberada");
  const devolvida = linha.querySelector(".input-devolvida");

  const agendar = () => {
    const estado = linha.querySelector(".estado-salvamento");
    estado.className = "estado-salvamento pendente";
    estado.textContent = "Alterado...";
    clearTimeout(timersSalvamento.get(material.id));
    timersSalvamento.set(material.id, setTimeout(() => {
      timersSalvamento.delete(material.id);
      atualizarQuantidadesItem(material, linha);
    }, 700));
  };

  [liberada, devolvida].forEach(input => {

    input.addEventListener("input", agendar);
    input.addEventListener("change", () => {
      clearTimeout(timersSalvamento.get(material.id));
      timersSalvamento.delete(material.id);
      atualizarQuantidadesItem(material, linha);
    });
  });
}

function fecharModalMateriais() {
  modalMateriais.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

async function atualizarQuantidadesItem(material, linha) {
  if (salvamentosEmAndamento.has(material.id)) {
    salvamentosPendentes.add(material.id);
    return;
  }

  const estado = linha.querySelector(".estado-salvamento");
  const inputLiberada = linha.querySelector(".input-liberada");
  const inputDevolvida = linha.querySelector(".input-devolvida");
  let quantidadeLib = Number(inputLiberada.value);
  let quantidadeDev = Number(inputDevolvida.value);

  if (
    !Number.isFinite(quantidadeLib) || !Number.isFinite(quantidadeDev)
    || quantidadeLib < 0 || quantidadeDev < 0
     || quantidadeDev > quantidadeLib) {
    estado.className = "estado-salvamento erro";
    estado.textContent = "Valor inválido";
    return;
  }

  quantidadeLib = quantidadeLib == "" ? 0 : quantidadeLib;
  quantidadeDev = quantidadeDev == "" ? 0 : quantidadeDev;

  salvamentosEmAndamento.add(material.id);
  estado.className = "estado-salvamento salvando";
  estado.textContent = "Salvando...";
  try {
    const response = await fetch(`/api/solicitacoes/itens/${material.id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantidade_lib: quantidadeLib, quantidade_dev: quantidadeDev })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Erro ao atualizar quantidades.");

    material.quantidade_lib = data.item.quantidade_lib;
    material.quantidade_dev = data.item.quantidade_dev;
    linha.querySelector(".input-devolvida").max = data.item.quantidade_lib;
    estado.className = "estado-salvamento salvo";
    estado.textContent = data.saldo_estoque === null || data.saldo_estoque === undefined
      ? "Salvo"
      : `Salvo • estoque ${data.saldo_estoque}`;
  } catch (error) {
    estado.className = "estado-salvamento erro";
    estado.textContent = "Não salvo";
    msgErro(error.message);
  } finally {
    salvamentosEmAndamento.delete(material.id);
    if (salvamentosPendentes.delete(material.id)) {
      atualizarQuantidadesItem(material, linha);
    }
  }
}

async function cancelarSolicitacao(id) {
  if (!window.confirm("Cancelar esta solicitação? Ela continuará visível no histórico.")) return;

  try {
    const response = await fetch(`/api/solicitacoes/${id}/cancelar`, {
      method: "PATCH",
      credentials: "include"
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Erro ao cancelar solicitação.");

    const solicitacao = todasSolicitacoes.find(item => Number(item.id) === Number(id));
    if (solicitacao) {
      solicitacao.status = data.status || "cancelado";
      solicitacao.cancelado_em = new Date().toISOString();
    }
    aplicarFiltros();
    if (Number(solicitacaoAbertaId) === Number(id)) fecharModalMateriais();
    msgAviso(data.message);
  } catch (error) {
    msgErro(error.message);
  }
}

function limparFiltros() {
  buscaGeral.value = "";
  filtroCidade.value = "";
  filtroEquipe.value = "";
  filtroStatus.value = "";
  filtroTipo.value = "";
  dataInicio.value = "";
  dataFim.value = "";

  aplicarFiltros();
}

[
  buscaGeral,
  filtroCidade,
  filtroEquipe,
  filtroStatus,
  filtroTipo,
  dataInicio,
  dataFim
].forEach((elemento) => {
  elemento.addEventListener("input", aplicarFiltros);
  elemento.addEventListener("change", aplicarFiltros);
});

btnLimparFiltros.addEventListener("click", limparFiltros);
btnFecharModal.addEventListener("click", fecharModalMateriais);
btnCancelarSolicitacao.addEventListener("click", () => cancelarSolicitacao(solicitacaoAbertaId));

modalMateriais.addEventListener("click", (event) => {
  if (event.target === modalMateriais) {
    fecharModalMateriais();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modalMateriais.classList.contains("hidden")) {
    fecharModalMateriais();
  }
});

carregarSolicitacoes();
