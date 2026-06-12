let registrosOriginais = [];
let registrosAtuais = [];
let idsExcluidos = [];

const tabelaConfigMateriais = document.getElementById("tabelaConfigMateriais");
const contadorRegistros = document.getElementById("contadorRegistros");

const filtroUP = document.getElementById("filtroUP");
const filtroMaterial = document.getElementById("filtroMaterial");
const filtroAlterados = document.getElementById("filtroAlterados");

const btnLimparFiltros = document.getElementById("btnLimparFiltros");
const btnAdicionarLinha = document.getElementById("btnAdicionarLinha");
const btnSalvar = document.getElementById("btnSalvar");

function normalizarTexto(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function gerarIdTemporario() {
  return `novo_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
}

async function carregarConfiguracoes() {
  try {
    tabelaConfigMateriais.innerHTML = `
      <tr>
        <td colspan="8" class="empty-row">
          Carregando configurações...
        </td>
      </tr>
    `;

    const response = await fetch("/api/materiais", { credentials: "include" });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Erro ao carregar configurações.");
    }

    registrosOriginais = data.map((item) => ({
      id: item.id,
      up: item.up || "",
      qtd: item.qtd || item.quantidade || "",
      material: item.material || "",
      codigo_13_8: item.codigo_13_8 || "",
      codigo_34_5: item.codigo_34_5 || "",
      _status: "normal"
    }));

    registrosAtuais = JSON.parse(JSON.stringify(registrosOriginais));
    idsExcluidos = [];

    aplicarFiltros();

  } catch (error) {
    console.error("Erro ao carregar configurações:", error);

    tabelaConfigMateriais.innerHTML = `
      <tr>
        <td colspan="8" class="empty-row">
          Erro ao carregar configurações.
        </td>
      </tr>
    `;
  }
}

function aplicarFiltros() {
  const upFiltro = normalizarTexto(filtroUP.value);
  const materialFiltro = normalizarTexto(filtroMaterial.value);
  const tipoFiltro = filtroAlterados.value;

  let lista = registrosAtuais.filter((item) => {
    const up = normalizarTexto(item.up);
    const material = normalizarTexto(item.material);

    if (upFiltro && !up.includes(upFiltro)) return false;
    if (materialFiltro && !material.includes(materialFiltro)) return false;

    if (tipoFiltro === "alterados" && item._status !== "editado") return false;
    if (tipoFiltro === "novos" && item._status !== "novo") return false;

    return true;
  });

  renderizarTabela(lista);
}

function renderizarTabela(lista) {
  tabelaConfigMateriais.innerHTML = "";

  contadorRegistros.textContent =
    `${lista.length} ${lista.length === 1 ? "registro encontrado" : "registros encontrados"}`;

  if (lista.length === 0) {
    tabelaConfigMateriais.innerHTML = `
      <tr>
        <td colspan="8" class="empty-row">
          Nenhum registro encontrado.
        </td>
      </tr>
    `;

    return;
  }

  lista.forEach((item) => {
    const tr = document.createElement("tr");

    tr.dataset.chave = item.id;

    if (item._status === "novo") {
      tr.classList.add("linha-nova");
    }

    if (item._status === "editado") {
      tr.classList.add("linha-editada");
    }

    tr.innerHTML = `
      <td>${typeof item.id === "number" ? item.id : "Novo"}</td>

      <td>
        <input 
          class="input-cell" 
          data-campo="up" 
          value="${escaparAtributo(item.up)}" 
          placeholder="Ex: N1"
        />
      </td>

      <td>
        <input 
          class="input-cell" 
          data-campo="qtd" 
          value="${escaparAtributo(item.qtd)}" 
          placeholder="Ex: 2"
        />
      </td>

      <td>
        <input 
          class="input-cell" 
          data-campo="material" 
          value="${escaparAtributo(item.material)}" 
          placeholder="Descrição do material"
        />
      </td>

      <td>
        <input
          class="input-cell"
          data-campo="codigo_13_8"
          value="${escaparAtributo(item.codigo_13_8)}"
          placeholder="Código para 13.8 kV"
        />
      </td>

      <td>
        <input
          class="input-cell"
          data-campo="codigo_34_5"
          value="${escaparAtributo(item.codigo_34_5)}"
          placeholder="Código para 34.5 kV"
        />
      </td>

      <td>
        ${gerarBadgeStatus(item._status)}
      </td>

      <td>
        <button type="button" class="btn-excluir">
          Excluir
        </button>
      </td>
    `;

    tr.querySelectorAll(".input-cell").forEach((input) => {
      input.addEventListener("input", () => {
        atualizarCampo(item.id, input.dataset.campo, input.value);
      });
    });

    tr.querySelector(".btn-excluir").addEventListener("click", () => {
      excluirLinha(item.id);
    });

    tabelaConfigMateriais.appendChild(tr);
  });
}

function escaparAtributo(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function gerarBadgeStatus(status) {
  if (status === "novo") {
    return `<span class="badge-status badge-novo">Novo</span>`;
  }

  if (status === "editado") {
    return `<span class="badge-status badge-editado">Editado</span>`;
  }

  return `<span class="badge-status badge-normal">Normal</span>`;
}

function atualizarCampo(id, campo, valor) {
  const item = registrosAtuais.find((registro) => String(registro.id) === String(id));

  if (!item) return;

  if (campo === "up") {
    item[campo] = valor.toUpperCase();
  } else {
    item[campo] = valor;
  }

  if (item._status !== "novo") {
    const original = registrosOriginais.find((registro) => Number(registro.id) === Number(id));

    const foiAlterado =
      original &&
      (
        String(original.up || "") !== String(item.up || "") ||
        String(original.qtd || "") !== String(item.qtd || "") ||
        String(original.material || "") !== String(item.material || "") ||
        String(original.codigo_13_8 || "") !== String(item.codigo_13_8 || "") ||
        String(original.codigo_34_5 || "") !== String(item.codigo_34_5 || "")
      );

    item._status = foiAlterado ? "editado" : "normal";
  }

  atualizarContadorAlteracoes();
}

function adicionarLinha() {
  const novo = {
    id: gerarIdTemporario(),
    up: "",
    qtd: "",
    material: "",
    codigo_13_8: "",
    codigo_34_5: "",
    _status: "novo"
  };

  registrosAtuais.unshift(novo);
  aplicarFiltros();
}

function excluirLinha(id) {
  const item = registrosAtuais.find((registro) => String(registro.id) === String(id));

  if (!item) return;

  const confirmar = confirm("Deseja excluir esta linha?");

  if (!confirmar) return;

  if (typeof item.id === "number") {
    idsExcluidos.push(item.id);
  }

  registrosAtuais = registrosAtuais.filter((registro) => String(registro.id) !== String(id));

  aplicarFiltros();
  atualizarContadorAlteracoes();
}

function limparFiltros() {
  filtroUP.value = "";
  filtroMaterial.value = "";
  filtroAlterados.value = "";

  aplicarFiltros();
}

function validarAntesDeSalvar() {
  const itensParaSalvar = registrosAtuais.filter((item) => {
    return item._status === "novo" || item._status === "editado";
  });

  for (const item of itensParaSalvar) {
    if (!String(item.up || "").trim()) {
      msgAviso("UP é um campo obrigatório. Por favor, preencha todas as linhas antes de salvar.");
      return false;
    }

    if (!String(item.qtd || "").trim()) {
      msgAviso("Quantidade é um campo obrigatório. Por favor, preencha todas as linhas antes de salvar.");
      return false;
    }

    if (!String(item.material || "").trim()) {
      msgAviso("Material é um campo obrigatório. Por favor, preencha todas as linhas antes de salvar.");
      return false;
    }
  }

  return true;
}

async function salvarAlteracoes() {
  try {
    if (!validarAntesDeSalvar()) return;

    const itensAlterados = registrosAtuais
      .filter((item) => item._status === "novo" || item._status === "editado")
      .map((item) => ({
        id: typeof item.id === "number" ? item.id : null,
        up: String(item.up || "").trim().toUpperCase(),
        qtd: String(item.qtd || "").trim(),
        material: String(item.material || "").trim(),
        codigo_13_8: String(item.codigo_13_8 || "").trim(),
        codigo_34_5: String(item.codigo_34_5 || "").trim()
      }));

    if (itensAlterados.length === 0 && idsExcluidos.length === 0) {
      msgAviso("Nenhuma alteração para salvar.");
      return;
    }

    btnSalvar.disabled = true;
    btnSalvar.textContent = "Salvando...";

    const response = await fetch("/api/materiais", {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        itens: itensAlterados,
        deletados: idsExcluidos
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Erro ao salvar alterações.");
    }

    msgSucesso("Configurações salvas com sucesso!");

    await carregarConfiguracoes();

  } catch (error) {
    console.error("Erro ao salvar configurações:", error);
    msgErro(error.message || "Erro ao salvar configurações.");
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.textContent = "Salvar alterações";
  }
}

function atualizarContadorAlteracoes() {
  const alterados = registrosAtuais.filter((item) => item._status === "editado").length;
  const novos = registrosAtuais.filter((item) => item._status === "novo").length;
  const excluidos = idsExcluidos.length;

  if (alterados || novos || excluidos) {
    contadorRegistros.textContent =
      `${registrosAtuais.length} registros | ${novos} novos | ${alterados} editados | ${excluidos} excluídos`;
  }
}

filtroUP.addEventListener("input", aplicarFiltros);
filtroMaterial.addEventListener("input", aplicarFiltros);
filtroAlterados.addEventListener("change", aplicarFiltros);

btnLimparFiltros.addEventListener("click", limparFiltros);
btnAdicionarLinha.addEventListener("click", adicionarLinha);
btnSalvar.addEventListener("click", salvarAlteracoes);

carregarConfiguracoes();
