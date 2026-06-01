let todasSolicitacoes = [];
let solicitacoesFiltradas = [];

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

function normalizarTexto(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatarData(data) {
  if (!data) return "-";

  const dataLimpa = String(data).split("T")[0];
  const partes = dataLimpa.split("-");

  if (partes.length !== 3) {
    return dataLimpa;
  }

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function formatarStatus(status) {
  const valor = String(status || "pendente").toLowerCase();

  const nomes = {
    pendente: "Pendente",
    separado: "Separado",
    entregue: "Entregue",
    cancelado: "Cancelado"
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

function normalizarSolicitacoes(rows) {
  const mapa = new Map();

  rows.forEach((item) => {
    const id = pegarIdSolicitacao(item);

    if (!id) return;

    if (!mapa.has(id)) {
      mapa.set(id, {
        id,
        projeto: item.projeto || "",
        cidade: item.cidade || "",
        equipe: item.equipe || "",
        tensao_rede: item.tensao_rede || "",
        data_exe: item.data_exe || "",
        tipo_servico: item.tipo_servico || "",
        observacao: item.observacao || "",
        criado_em: item.criado_em || "",
        status: item.status || "pendente",
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
        descricao,
        quantidade
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

    const response = await fetch("/listar-solicitacoes", {
      method: "POST",
      credentials: "include"
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Erro ao listar solicitações.");
    }

    todasSolicitacoes = normalizarSolicitacoes(data);

    preencherFiltros();
    aplicarFiltros();

  } catch (error) {
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

    tr.innerHTML = `
      <td>#${item.id}</td>
      <td>${item.projeto || "-"}</td>
      <td>${item.cidade || "-"}</td>
      <td>${item.equipe || "-"}</td>
      <td>${item.tensao_rede ? item.tensao_rede + " kV" : "-"}</td>
      <td>${formatarData(item.data_exe)}</td>
      <td>${item.tipo_servico || "-"}</td>
      <td>
        <span class="${classeStatus(item.status)}">
          ${formatarStatus(item.status)}
        </span>
      </td>
      <td>
        <button type="button" class="btn-detalhes">
          Imprimir
        </button>
      </td>
    `;

    tr.addEventListener("dblclick", () => {
      abrirMateriaisSolicitados(item.id);
    });

    tr.querySelector(".btn-detalhes").addEventListener("click", (event) => {
      event.stopPropagation();
      console.warn(item[0]);
      
      imprimirListaMateriais(item);
    });

    tabelaSolicitacoes.appendChild(tr);
  });
}

function abrirMateriaisSolicitados(id) {
  const solicitacao = todasSolicitacoes.find((item) => {
    return String(item.id) === String(id);
  });

  if (!solicitacao) return;

  document.querySelectorAll(".solicitacoes-table tbody tr").forEach((tr) => {
    tr.classList.remove("linha-selecionada");
  });

  const linha = document.querySelector(`.solicitacoes-table tbody tr[data-id="${id}"]`);

  if (linha) {
    linha.classList.add("linha-selecionada");
  }

  resumoSolicitacao.innerHTML = `
    <div class="resumo-item">
      <span>Projeto</span>
      <strong>${solicitacao.projeto || "-"}</strong>
    </div>

    <div class="resumo-item">
      <span>Cidade</span>
      <strong>${solicitacao.cidade || "-"}</strong>
    </div>

    <div class="resumo-item">
      <span>Equipe</span>
      <strong>${solicitacao.equipe || "-"}</strong>
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
      <strong>${solicitacao.tipo_servico || "-"}</strong>
    </div>

    <div class="resumo-item">
      <span>Criado em</span>
      <strong>${formatarData(solicitacao.criado_em)}</strong>
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
        <td colspan="2" class="empty-row">
          Nenhum material encontrado para esta solicitação.
        </td>
      </tr>
    `;

    return;
  }

  materiais.forEach((material) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${material.descricao || "-"}</td>
      <td>${material.quantidade || "-"}</td>
    `;

    tabelaMateriaisModal.appendChild(tr);
  });
}

function fecharModalMateriais() {
  modalMateriais.classList.add("hidden");
  document.body.classList.remove("modal-open");
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