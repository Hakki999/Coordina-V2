function converterQuantidade(qtd) {
  if (qtd === null || qtd === undefined) {
    return {
      numero: null,
      unidade: "",
      original: ""
    };
  }

  const original = String(qtd).trim();

  if (!original) {
    return {
      numero: null,
      unidade: "",
      original: ""
    };
  }

  const texto = original.replace(",", ".");

  const match = texto.match(/^(\d+(?:\.\d+)?)(.*)$/);

  if (!match) {
    return {
      numero: null,
      unidade: original,
      original
    };
  }

  return {
    numero: Number(match[1]),
    unidade: match[2].trim(),
    original
  };
}

function escaparHTML(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function transformarEmCatalogoUPs(materiaisBanco) {
  const catalogoUPs = {};
  materiaisBanco.forEach((item) => {
    const up = String(item.up || "").trim().toUpperCase();
    const descricao = String(item.material || "").trim();
    const quantidade = converterQuantidade(item.quantidade).numero;

    if (!up || !descricao) {
      return;
    }

    if (!catalogoUPs[up]) {
      catalogoUPs[up] = [];
    }

    catalogoUPs[up].push({
      descricao: descricao,
      quantidade: quantidade
    });
  });

  return catalogoUPs;
}

fetch("/api/materiais", {
  credentials: "include"
})
  .then((response) => response.json())
  .then((materiaisBanco) => {
    const catalogoUPs = transformarEmCatalogoUPs(materiaisBanco);

    main(catalogoUPs);
  })
  .catch((error) => {
    msgErro("Erro ao listar materiais");
    console.error("Erro ao listar materiais:", error);
  });

function main(catalogoUPs) {
  const TOTAL_LINHAS = 32;

  window.catalogoUPs = catalogoUPs;

  /*
    ================================
    OPÇÕES DOS SELECTS
    ================================
  */

  const selectsFormulario = {
    cidades: {
      placeholder: "Selecione a cidade",
      opcoes: [
        "Firminópolis",
        "São Luís de Montes Belos",
        "Iporá",
        "Itapuranga",
        "Jussara",
        "Goiânia",
        "Anicuns",
        "Palmeiras de Goiás",
        "Paraúna",
        "Cachoeira de Goiás"
      ]
    },

    equipes: {
      placeholder: "Selecione a equipe",
      opcoes: [
        "ARAO008M",
        "FIRO001M",
        "FIRO002M",
        "FIRO003M",
        "FIRO009M",
        "FIRO010M",
        "FIRO011M",
        "FIRO012M",
        "FIRO017M",
        "ITAO004M",
        "ITAO005M",
        "ITAO006M",
        "ITAO007M",
        "ITAO015M",
        "ITAO016M",
        "JUSO013M",
        "JUSO014M",
        "FIRT001M",
        "FIRT002M",
        "FIRP002M",
        "FIRP003M",
        "JUSP004M",
        "ITAP005M",
        "ITAP006M",
        "ITAV006M",
        "FIRV009M"
      ]
    },

    tensoes: {
      placeholder: "Selecione a tensão",
      opcoes: [
        {
          label: "13.8 kV",
          value: "13.8"
        },
        {
          label: "34.5 kV",
          value: "34.5"
        }
      ]
    },

    tiposServico: {
      placeholder: "Selecione o tipo de serviço",
      opcoes: [
        "Emergência",
        "Manutenção",
        "Obras",
        "Reposição",
        "Leve"
      ]
    }
  };

  /*
    ================================
    ELEMENTOS HTML
    ================================
  */

  const tabelaUps = document.getElementById("tabelaUps");
  const tabelaMateriais = document.getElementById("tabelaMateriais");
  const contadorMateriais = document.getElementById("contadorMateriais");

  const listaUps = document.getElementById("listaUps");

  const btnProximo = document.getElementById("btnProximo");
  const modalFormulario = document.getElementById("modalFormulario");
  const btnFecharModal = document.getElementById("btnFecharModal");
  const btnCancelar = document.getElementById("btnCancelar");
  const formSolicitacao = document.getElementById("formSolicitacao");

  /*
    ================================
    GERAR SELECTS DO FORMULÁRIO
    ================================
  */

  function gerarSelectsFormulario() {
    const selects = document.querySelectorAll("[data-select]");

    selects.forEach((select) => {
      const tipo = select.dataset.select;
      const config = selectsFormulario[tipo];

      if (!config) return;

      select.innerHTML = "";

      const optionInicial = document.createElement("option");
      optionInicial.value = "";
      optionInicial.textContent = config.placeholder || "Selecione";
      select.appendChild(optionInicial);

      config.opcoes.forEach((opcao) => {
        const option = document.createElement("option");

        if (typeof opcao === "string") {
          option.value = opcao;
          option.textContent = opcao;
        } else {
          option.value = opcao.value;
          option.textContent = opcao.label;
        }

        select.appendChild(option);
      });
    });
  }

  /*
    ================================
    GERAR AUTOCOMPLETE DAS UPs
    ================================
  */

  function preencherDatalistUPs() {
    if (!listaUps) return;

    listaUps.innerHTML = "";

    Object.keys(catalogoUPs).forEach((up) => {
      const option = document.createElement("option");
      option.value = up;
      listaUps.appendChild(option);
    });
  }

  /*
    ================================
    CRIAR LINHAS DA TABELA ESQUERDA
    ================================
  */

  function criarLinhasUps() {
    tabelaUps.innerHTML = "";

    for (let i = 0; i < TOTAL_LINHAS; i++) {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>
          <input
            class="input-table input-up"
            type="text"
            list="listaUps"
            placeholder="Ex: N1"
            autocomplete="off"
          />
        </td>

        <td>
          <input
            class="input-table input-qtd"
            type="number"
            min="0"
            step="1"
            placeholder="0"
          />
        </td>
      `;

      const inputUP = tr.querySelector(".input-up");
      const inputQtd = tr.querySelector(".input-qtd");

      inputUP.addEventListener("blur", () => {
        inputUP.value = inputUP.value.toUpperCase();
        atualizarMateriais();
      });

      inputQtd.addEventListener("input", atualizarMateriais);

      tabelaUps.appendChild(tr);
    }
  }

  /*
    ================================
    LER UPs INFORMADAS
    ================================
  */
  function lerUPsSelecionadas() {
    const linhas = Array.from(tabelaUps.querySelectorAll("tr"));
    const upsSelecionadas = [];

    linhas.forEach((linha) => {
      const inputUP = linha.querySelector(".input-up");
      const inputQtd = linha.querySelector(".input-qtd");

      const up = inputUP.value.trim().toUpperCase();
      const quantidade = Number(inputQtd.value);

      linha.classList.remove("invalid-row");

      if (!up && !quantidade) {
        return;
      }

      if (up && !catalogoUPs[up]) {
        inputUP.value = "";
        inputQtd.value = "";
        linha.classList.add("invalid-row");

        setTimeout(() => {
          linha.classList.remove("invalid-row");
        }, 600);

        return;
      }

      if (catalogoUPs[up] && quantidade > 0) {
        upsSelecionadas.push({
          up,
          quantidade
        });
      }
    });

    return upsSelecionadas;
  }
  /*
    ================================
    CALCULAR MATERIAIS
    ================================
  */

  function calcularMateriais(upsSelecionadas) {
    const materiaisSomados = new Map();

    upsSelecionadas.forEach((itemUP) => {
      const materiaisDaUP = catalogoUPs[itemUP.up];

      if (!materiaisDaUP) return;

      materiaisDaUP.forEach((material) => {
        const descricao = material.descricao;
        const quantidadeCalculada = material.quantidade * itemUP.quantidade;

        if (!materiaisSomados.has(descricao)) {
          materiaisSomados.set(descricao, {
            descricao,
            quantidade: 0
          });
        }

        const materialAtual = materiaisSomados.get(descricao);
        materialAtual.quantidade += quantidadeCalculada;
      });
    });

    return Array.from(materiaisSomados.values()).sort((a, b) => {
      return a.descricao.localeCompare(b.descricao);
    });
  }

  /*
    ================================
    RENDERIZAR TABELA DA DIREITA
    ================================
  */

  function formatarQuantidade(valor) {
    if (Number.isInteger(valor)) {
      return String(valor);
    }

    return valor.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function renderizarMateriais(materiais) {
    tabelaMateriais.innerHTML = "";

    if (contadorMateriais) {
      contadorMateriais.textContent = `${materiais.length} ${materiais.length === 1 ? "item" : "itens"}`;
    }

    if (materiais.length === 0) {
      tabelaMateriais.innerHTML = `
        <tr>
          <td colspan="2" class="empty-row">
            Nenhum material selecionado.
          </td>
        </tr>
      `;

      return;
    }

    materiais.forEach((material) => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${escaparHTML(material.descricao)}</td>
        <td>${formatarQuantidade(material.quantidade)}</td>
      `;

      tabelaMateriais.appendChild(tr);
    });
  }

  /*
    ================================
    ATUALIZAR CÁLCULO AUTOMATICAMENTE
    ================================
  */

  function atualizarMateriais() {
    const upsSelecionadas = lerUPsSelecionadas();
    const materiais = calcularMateriais(upsSelecionadas);

    renderizarMateriais(materiais);
  }

  /*
    ================================
    MODAL
    ================================
  */

  function abrirModal() {
    const upsSelecionadas = lerUPsSelecionadas();

    if (upsSelecionadas.length === 0) {
      msgAviso("Informe pelo menos uma UP válida com quantidade maior que zero.");
      return;
    }

    modalFormulario.classList.remove("hidden");
    document.body.classList.add("modal-open");
  }

  function fecharModal() {
    modalFormulario.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }

  /*
    ================================
    FORMULÁRIO
    ================================
  */

  function pegarDadosFormulario() {
    return {
      projeto: document.getElementById("projeto").value.trim(),
      cidade: document.getElementById("cidade").value,
      equipe: document.getElementById("equipe").value,
      tensao_rede: document.getElementById("tensao_rede").value,
      data_exe: document.getElementById("data_exe").value,
      tipo_servico: document.getElementById("tipo_servico").value,
      observacao: document.getElementById("observacao").value.trim()
    };
  }

  function montarPayloadFinal() {
    const upsSelecionadas = lerUPsSelecionadas();
    const dadosFormulario = pegarDadosFormulario();

    return {
      formulario: dadosFormulario,
      upsSelecionadas
    };
  }

  function enviarSolicitacao(event) {
    event.preventDefault();

    if (!formSolicitacao.checkValidity()) {
      formSolicitacao.reportValidity();
      return;
    }

    const upsSelecionadas = lerUPsSelecionadas();

    if (upsSelecionadas.length === 0) {
      msgAviso("Nenhuma UP válida encontrada. Volte e informe pelo menos uma UP.");
      fecharModal();
      return;
    }

    const payload = montarPayloadFinal();

    fetch("/api/solicitacoes", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Erro na resposta do servidor");
        }
        return response.json();
      })
      .then((data) => {
        atualizarMateriais();
        fecharModal();
        formSolicitacao.reset();
        msgSucesso("Solicitação enviada com sucesso!");
      })
      .catch((error) => {
        console.error("Erro ao enviar solicitação:", error);
        msgErro("Erro ao enviar solicitação");
      })
  }

  tabelaUps.querySelectorAll("input").forEach((input) => {
    input.value = "";
  });



  /*
    ================================
    EVENTOS
    ================================
  */

  btnProximo.addEventListener("click", abrirModal);
  btnFecharModal.addEventListener("click", fecharModal);
  btnCancelar.addEventListener("click", fecharModal);
  formSolicitacao.addEventListener("submit", enviarSolicitacao);

  modalFormulario.addEventListener("click", (event) => {
    if (event.target === modalFormulario) {
      fecharModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modalFormulario.classList.contains("hidden")) {
      fecharModal();
    }
  });

  /*
    ================================
    INICIALIZAÇÃO
    ================================
  */

  gerarSelectsFormulario();
  preencherDatalistUPs();
  criarLinhasUps();
  atualizarMateriais();
}
