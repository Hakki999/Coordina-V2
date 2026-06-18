/*
  BI TV - versão ajustada
  - Compatível com backend retornando: dadosBI, dados ou resultado
  - Compatível com equipes em: mes.equipes ou mes.rankingGeralEquipes
  - Compatível com valores: produzidoTotal ou producaoTotal
  - Sem filtro automático removendo equipes
*/

const CONFIG = {
  endpoint: "/api/bi-gpm/resumo",
  acao: "gerarResumoBI",
  autoTrocarMes: false,
  segundosTrocaMes: 35,
  atualizarDadosAutomatico: true,
  segundosAtualizacaoDados: 300,
  segundosAlternanciaRanking: 12,
  maxRankingGeral: 4,
  maxRankingPorTipo: 20
};

let dadosBI = [];
let mesAtualSelecionado = "";
let timerTrocaMes = null;
let timerAtualizacao = null;
let timerAlternanciaRanking = null;
let modoRanking = "top";

/*
  CONTROLE DE/PARA DAS EQUIPES
*/

const equipesPesadas = [
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
  "JUSO014M"
];

const equipesLeves = [
  "ANIE001M",
  "ANIE002M",
  "ANIE003T",
  "ANIE004M",
  "ARAE001M",
  "ARAE001T",
  "ARAE002M",
  "ARAE002T",
  "ARAE003M",
  "ARAE003T",
  "ARAL021M",
  "ARUE001M",
  "ARUE002T",
  "BRIE001M",
  "BRIE002M",
  "BRIE003T",
  "FAIE00",
  "FAIE001M",
  "FAIE001T",
  "FAZE001M",
  "FAZE002T",
  "FIRC001M",
  "FIRC004M",
  "FIRC005M",
  "FIRE001M",
  "FIRE002T",
  "FIRE003M",
  "FIRE004T",
  "FIRE005M",
  "FIRE005N",
  "FIRE006M",
  "FIRE007M",
  "FIRE012M",
  "FIRL001M",
  "FIRL002M",
  "FIRL020M",
  "FIRP002M",
  "FIRP003M",
  "FIRT001M",
  "FIRT002M",
  "GOIE001M",
  "GOIE001T",
  "GOIE002M",
  "GOIE002T",
  "GOIE003M",
  "GOIE003T",
  "GOIE004M",
  "GOIE004T",
  "GOIL020M",
  "GOIL021M",
  "INDE001M",
  "INDE002M",
  "INDE003T",
  "INDE004M",
  "IPUE001M",
  "IPUE001T",
  "IPUE002M",
  "IPUE002T",
  "IPUE003M",
  "IPUE003T",
  "IPUL020M",
  "IPUL021M",
  "ITAE001M",
  "ITAE001T",
  "ITAE002M",
  "ITAE002T",
  "ITAE003M",
  "ITAE003T",
  "ITAL020M",
  "ITAL021M",
  "ITAP005M",
  "ITAP006M",
  "ITIE001M",
  "ITIE001T",
  "JUSC025T",
  "JUSE015M",
  "JUSE050M",
  "JUSE051M",
  "JUSE052M",
  "JUSE053T",
  "JUSE055T",
  "JUSE056M",
  "JUSL020M",
  "JUSP004M",
  "MATE001M",
  "MATE002T",
  "MONF001M",
  "MONF002M",
  "MONF003M",
  "MONF004M",
  "MONF005M",
  "MONF006M",
  "MONF007M",
  "MONF008M",
  "MONF009M",
  "MONF010M",
  "MONF011M",
  "MOZE001M",
  "MOZE001T",
  "PALC025M",
  "PALE001M",
  "PALE002M",
  "PALE003T",
  "PALE004M",
  "PARE001M",
  "PARE002M",
  "PARE003T",
  "SANC025M",
  "SANE001M",
  "SANE001T",
  "SANE002M",
  "SANE003M",
  "SANE004T",
  "SANL020M",
  "TAPE001M",
  "TAPE002T"
];

const equipesLinhaViva = [
  "ARAV002M",
  "FIRV004M",
  "FIRV005M",
  "FIRV007M",
  "FIRV008M",
  "FIRV009M",
  "ITAV006M",
  "ITAV010M",
  "ITAV011M",
  "JUSV001M"
];

/*
  CONTROLE MANUAL - OBRAS X MANUTENÇÃO
  - Coloque aqui as equipes que devem entrar como OBRAS.
  - Se quiser forçar alguma equipe como MANUTENÇÃO, use equipesManutencao.
  - Tudo que não estiver em Obras será considerado Manutenção.
*/

const equipesObras = [
  "ARAO008M",
  "FIRO002M",
  "FIRO003M",
  "FIRO009M",
  "FIRO010M",
  "FIRO011M",
  "FIRO012M",
  "ITAO004M",
  "ITAO006M",
  "ITAO007M",
  "ITAO015M",
  "ITAO016M",
  "ITAV006M",
  "FIRV009M",
  "JUSO013M"
];

const equipesManutencao = [
  "FIRT001M",
  "FIRT002M",
  "FIRP002M",
  "FIRP003M",
  "JUSP004M",
  "ITAP005M",
  "ITAP006M",
  "FIRO017M",
  "ITAO005M",
  "JUSO013M",
  "JUSO013M",
  "ITAO005M",
  "FIRO017M"
];

/*
  Mantive a lista, mas NÃO estou aplicando o filtro.
  Antes isso podia deixar seu front vazio, porque removia várias equipes reais.
*/
const removerEquipes = [
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
  "FIRO017M",
  "ITAO005M",
  "JUSO013M",
  "JUSO013M",
  "ITAO005M",
  "FIRO017M",
  "ARAO008M",
  "FIRO002M",
  "FIRO003M",
  "FIRO009M",
  "FIRO010M",
  "FIRO011M",
  "FIRO012M",
  "ITAO004M",
  "ITAO006M",
  "ITAO007M",
  "ITAO015M",
  "ITAO016M",
  "ITAV006M",
  "FIRV009M",
  "JUSO013M",
  "ARAV002M",
  "FIRV004M",
  "FIRV005M",
  "FIRV007M",
  "FIRV008M",
  "FIRV009M",
  "ITAV006M",
  "ITAV010M",
  "ITAV011M",
  "JUSV001M"
];

const firm = [
  "FIRE001M",
  "FIRE002T",
  "FIRE003M",
  "FIRE004T",
  "FIRE005M",
  "FIRE006M",
  "PARE002M",
  "PARE003T",
  "INDE001M",
  "INDE002M",
  "INDE003T",
  "PALE001M",
  "PALE002M",
  "PALE003T",
  "SANE001T",
  "SANE002M",
  "SANE003M",
  "SANE004T",
  "ANIE002M",
  "ANIE003T",
  "FIRL002M",
  "SANL020M",
  "FIRC001M",
  "SANC025M",
  "PALC025M",
  "MONF001M",
  "MONF002M",
  "MONF003M",
  "MONF004M",
  "MONF005M",
  "MONF006M",
  "MONF009M",
  "MONF010M",
  "MONF011M"
]

const jus = [
  "FAZE001M",
  "FAZE002T",
  "TAPE001M",
  "TAPE002T",
  "MATE001M",
  "MATE002T",
  "JUSE052M",
  "JUSE051M",
  "JUSE053T",
  "JUSE055T",
  "BRIE001M",
  "BRIE003T",
  "ARUE001M",
  "JUSL020M",
  "JUSC025T"
]

const gos = [
  "IPUE001M",
  "IPUE002T",
  "IPUE002M",
  "IPUE003T",
  "ITAE001M",
  "ITAE002M",
  "ITAE002T",
  "ITAE003T",
  "ITIE001M",
  "GOIE001M",
  "GOIE002T",
  "GOIE003M",
  "GOIE003T",
  "GOIE004M",
  "FAIE001M",
  "FAIE001T",
  "ARAE001M",
  "ARAE002T",
  "ARAE001T",
  "MOZE001M",
  "MOZE001T",
  "ITAL021M",
  "GOIL020M",
  "GOIL021M",
  "ARAL021M"
]

const CORES_TIPO = {
  "Pesada": "var(--blue)",
  "Leve": "var(--green)",
  "Linha Viva": "var(--purple)",
  "Não classificada": "rgba(100, 116, 139, 0.72)"
};

const HEX_TIPO = {
  "Pesada": "#38bdf8",
  "Leve": "#22c55e",
  "Linha Viva": "#a78bfa",
  "Não classificada": "#64748b",
  "Firminopolis": "#38bdf8",
  "Jussara": "#22c55e",
  "Goias": "#a78bfa"
};

const HEX_OBRA_MANUTENCAO = {
  "Obras": "#f59e0b",
  "Manutenção": "#3b82f6"
};

const $ = seletor => document.querySelector(seletor);

function normalizarTexto(texto) {
  return String(texto || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function obterTipoEquipe(equipe, tipoOriginal) {
  const nomeEquipe = normalizarTexto(equipe);

  const pesadas = equipesPesadas.map(normalizarTexto);
  const leves = equipesLeves.map(normalizarTexto);
  const linhaViva = equipesLinhaViva.map(normalizarTexto);

  if (pesadas.includes(nomeEquipe)) return "Pesada";
  if (leves.includes(nomeEquipe)) return "Leve";
  if (linhaViva.includes(nomeEquipe)) return "Linha Viva";

  const tipoBanco = normalizarTexto(tipoOriginal);

  if (tipoBanco.includes("PESADA")) return "Pesada";
  if (tipoBanco.includes("LEVE")) return "Leve";
  if (tipoBanco.includes("LINHA") || tipoBanco.includes("VIVA")) return "Linha Viva";

  return "Não classificada";
}

function obterClassificacaoObraManutencao(equipe) {
  const nomeEquipe = normalizarTexto(equipe);

  const obras = equipesObras.map(normalizarTexto);
  const manutencao = equipesManutencao.map(normalizarTexto);

  if (obras.includes(nomeEquipe)) return "Obras";
  if (manutencao.includes(nomeEquipe)) return "Manutenção";

  return "Manutenção";
}

function moeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2
  });
}

function numero(valor) {
  return Number(valor || 0).toLocaleString("pt-BR");
}

function percentual(valor) {
  return `${Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })}%`;
}

function normalizarNumeroBI(valor) {
  if (valor === null || valor === undefined || valor === "") return 0;

  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : 0;
  }

  let texto = String(valor)
    .replace("R$", "")
    .replace(/\s/g, "")
    .trim();

  if (texto.includes(",") && texto.includes(".")) {
    texto = texto.replace(/\./g, "").replace(",", ".");
  } else if (texto.includes(",")) {
    texto = texto.replace(",", ".");
  }

  const numeroConvertido = Number(texto);
  return Number.isFinite(numeroConvertido) ? numeroConvertido : 0;
}

function escaparHTML(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setStatus(texto, tipo = "online") {
  const status = $("#statusSistema");
  const dot = $("#statusDot");

  if (status) status.textContent = texto;

  if (dot) {
    if (tipo === "erro") {
      dot.style.background = "var(--red)";
      dot.style.boxShadow = "0 0 0 7px rgba(251, 113, 133, 0.12), 0 0 18px rgba(251, 113, 133, 0.45)";
    } else if (tipo === "carregando") {
      dot.style.background = "var(--yellow)";
      dot.style.boxShadow = "0 0 0 7px rgba(245, 158, 11, 0.12), 0 0 18px rgba(245, 158, 11, 0.45)";
    } else {
      dot.style.background = "var(--green)";
      dot.style.boxShadow = "0 0 0 7px rgba(34, 197, 94, 0.12), 0 0 18px rgba(34, 197, 94, 0.45)";
    }
  }
}

function mostrarLoading(mostrar) {
  const overlay = $("#loadingOverlay");
  if (!overlay) return;

  overlay.classList.toggle("hide", !mostrar);
}

function normalizarMesRecebido(mes) {
  const equipesOriginais =
    Array.isArray(mes.rankingGeralEquipes) ? mes.rankingGeralEquipes :
      Array.isArray(mes.equipes) ? mes.equipes :
        [];

  const equipesNormalizadas = equipesOriginais
    .filter(eq => {
      if (!removerEquipes.length) return true;
      return !removerEquipes.includes(normalizarTexto(eq.equipe));
    })
    .map(eq => {
      const producaoTotal = normalizarNumeroBI(
        eq.producaoTotal ?? eq.produzidoTotal ?? 0
      );

      const metaTotal = normalizarNumeroBI(eq.metaTotal ?? 0);
      const saldoMeta = normalizarNumeroBI(eq.saldoMeta ?? producaoTotal - metaTotal);
      const percentualMeta = metaTotal > 0
        ? (producaoTotal / metaTotal) * 100
        : normalizarNumeroBI(eq.percentualMeta);

      return {
        ...eq,
        equipe: eq.equipe || "SEM EQUIPE",
        tipoEquipe: eq.tipoEquipe || eq.tipo_equipe || "SEM TIPO",
        producaoTotal,
        produzidoTotal: producaoTotal,
        metaTotal,
        saldoMeta,
        percentualMeta,
        dentroMeta: metaTotal > 0 && producaoTotal >= metaTotal,
        quantidadeServicos: normalizarNumeroBI(eq.quantidadeServicos),
        quantidadeProjetos: normalizarNumeroBI(eq.quantidadeProjetos)
      };
    });

  const producaoMes = normalizarNumeroBI(
    mes.producaoTotal ?? mes.produzidoTotal ?? equipesNormalizadas.reduce((t, e) => t + e.producaoTotal, 0)
  );

  const metaMes = normalizarNumeroBI(
    mes.metaTotal ?? equipesNormalizadas.reduce((t, e) => t + e.metaTotal, 0)
  );

  return {
    ...mes,
    mes: mes.mes,
    producaoTotal: producaoMes,
    produzidoTotal: producaoMes,
    metaTotal: metaMes,
    rankingGeralEquipes: equipesNormalizadas,
    equipes: equipesNormalizadas
  };
}

async function carregarBI({ silencioso = false } = {}) {
  try {
    if (!silencioso) mostrarLoading(true);

    setStatus("Atualizando...", "carregando");

    const resposta = await fetch(CONFIG.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({
        acao: CONFIG.acao
      })
    });

    const textoResposta = await resposta.text();

    let json;
    try {
      json = JSON.parse(textoResposta);
    } catch (erroJson) {
      console.error("Resposta não JSON recebida do backend:", textoResposta);
      throw new Error("Backend não retornou JSON válido");
    }

    console.log("RESPOSTA COMPLETA DO BACKEND:", json);

    if (!resposta.ok) {
      throw new Error(json.detalhe || json.erro || `HTTP ${resposta.status}`);
    }

    if (!json.sucesso) {
      throw new Error(json.detalhe || json.erro || "Erro ao gerar resumo");
    }

    const listaRecebida =
      Array.isArray(json.dadosBI) ? json.dadosBI :
        Array.isArray(json.dados) ? json.dados :
          Array.isArray(json.resultado) ? json.resultado :
            [];

    dadosBI = listaRecebida
      .map(normalizarMesRecebido)
      .filter(item => item.mes);

    console.warn("DADOS NORMALIZADOS NO FRONT:", dadosBI);

    if (!dadosBI.length) {
      renderizarSemDados("Nenhum dado encontrado para exibir.");
      return;
    }

    carregarFiltroMes();

    const mesesOrdenados = ordenarMesesDesc(dadosBI);
    const existeMesAnterior = dadosBI.some(item => item.mes === mesAtualSelecionado);
    const mesParaRenderizar = existeMesAnterior
      ? mesAtualSelecionado
      : mesesOrdenados[0]?.mes;

    if (!mesParaRenderizar) {
      renderizarSemDados("Nenhum mês válido encontrado.");
      return;
    }

    renderizarMes(mesParaRenderizar);
    iniciarRotinasAutomaticas();

    setStatus("Online", "online");
  } catch (error) {
    console.error("Erro ao carregar BI:", error);
    setStatus("Erro nos dados", "erro");
    renderizarErro(error);
  } finally {
    mostrarLoading(false);
  }
}

function carregarFiltroMes() {
  const select = $("#filtroMes");
  if (!select) return;

  const meses = ordenarMesesDesc(dadosBI);

  select.innerHTML = meses.map(item => `
    <option value="${escaparHTML(item.mes)}">${escaparHTML(formatarMes(item.mes))}</option>
  `).join("");

  select.onchange = () => {
    renderizarMes(select.value);
    reiniciarTrocaAutomatica();
  };
}

function ordenarMesesDesc(lista) {
  return [...lista].sort((a, b) => String(b.mes || "").localeCompare(String(a.mes || "")));
}

function ordenarMesesAsc(lista) {
  return [...lista].sort((a, b) => String(a.mes || "").localeCompare(String(b.mes || "")));
}

function normalizarPDonuts(mes) {
  const dados = dadosBI.filter(item => item.mes == mes)[0].equipes;

  const cidades = {
    Firminopolis: {
      tipo: "Firminopolis",
      total: dados
        .filter(item => firm.includes(item.equipe))
        .reduce((acc, item) => acc + Number(item.producao || item.producaoTotal || 0), 0)
    },
    Jussara: {
      tipo: "Jussara",
      total: dados
        .filter(item => jus.includes(item.equipe))
        .reduce((acc, item) => acc + Number(item.producao || item.producaoTotal || 0), 0)
    },
    Goias: {
      tipo: "Goias",
      total: dados
        .filter(item => gos.includes(item.equipe))
        .reduce((acc, item) => acc + Number(item.producao || item.producaoTotal || 0), 0)
    }

  }

  console.log(cidades);

  return cidades;
}

function renderizarMes(mesSelecionado) {
  const mes = dadosBI.find(item => item.mes === mesSelecionado);
  if (!mes) return;

  mesAtualSelecionado = mesSelecionado;

  const select = $("#filtroMes");
  if (select) select.value = mesSelecionado;

  const equipesBase = mes.rankingGeralEquipes || mes.equipes || [];
  const equipesClassificadas = classificarEquipes(equipesBase);

  const cards = calcularCardsDoMes(equipesClassificadas);
  const resumoTipo = calcularResumoPorTipo(equipesClassificadas);
  const resumoObraManutencao = calcularResumoObraManutencao(equipesClassificadas);
  const comparativo = calcularComparativoMensal(mesSelecionado, cards.producaoTotal);
  const statusMeta = calcularStatusMeta(equipesClassificadas, cards);

  animarTextoNumerico("producaoTotal", cards.producaoTotal, moeda);
  animarTextoNumerico("metaTotal", cards.metaTotal, moeda);
  animarTextoNumerico("saldoMeta", cards.saldoMeta, moeda);
  animarTextoNumerico("percentualMeta", cards.percentualMeta, percentual);
  animarTextoNumerico("qtdServicos", cards.quantidadeServicos, numero);
  animarTextoNumerico("qtdEquipes", cards.quantidadeEquipes, numero);

  atualizarStatusMetaHeader(statusMeta);

  setTexto("subtitulo", `${formatarMes(mesSelecionado)} • ${numero(cards.quantidadeEquipes)} equipes • ${statusMeta.texto}`);
  setTexto("deltaProducao", `${comparativo.texto} • ${statusMeta.textoCurto}`);
  setTexto("badgeEvolucao", `${percentual(cards.percentualMeta)} da meta`);
  setTexto("badgeTop", `Top ${Math.min(CONFIG.maxRankingGeral, equipesClassificadas.length)}`);

  setTexto(
    "badgeRankingTipo",
    statusMeta.equipesComMeta > 0
      ? `${statusMeta.equipesDentroMeta}/${statusMeta.equipesComMeta} equipes OK`
      : `${Object.keys(resumoTipo).length} tipos`
  );

  renderizarTicker({
    mes,
    cards,
    equipes: equipesClassificadas,
    statusMeta
  });

  renderizarGraficoEvolucao();


  const dnomalizado = normalizarPDonuts(mesSelecionado);

  let vlrTotal = 0;

  Object.entries(dnomalizado).forEach(([chave, valor]) => {
    console.log(chave);

    vlrTotal+= valor.total;
  });


  renderizarDonutTipos(dnomalizado, vlrTotal);
  renderizarDonutObraManutencao(resumoObraManutencao, cards.producaoTotal);
  renderizarTopEquipes(equipesClassificadas);
  renderizarRankingPorTipo(equipesClassificadas, resumoTipo, cards.producaoTotal, resumoObraManutencao);
}

function classificarEquipes(equipes = []) {
  return equipes.map(eq => {
    const equipe = eq.equipe || "SEM EQUIPE";
    const tipoEquipe = obterTipoEquipe(equipe, eq.tipoEquipe || eq.tipo_equipe);
    const classificacaoObraManutencao = obterClassificacaoObraManutencao(equipe);

    const producaoTotal = normalizarNumeroBI(
      eq.producaoTotal ?? eq.produzidoTotal ?? 0
    );

    const metaTotal = normalizarNumeroBI(eq.metaTotal ?? 0);

    const saldoMeta = eq.saldoMeta !== undefined && eq.saldoMeta !== null
      ? normalizarNumeroBI(eq.saldoMeta)
      : producaoTotal - metaTotal;

    const percentualMeta = metaTotal > 0
      ? (producaoTotal / metaTotal) * 100
      : normalizarNumeroBI(eq.percentualMeta);

    const dentroMeta = metaTotal > 0 && producaoTotal >= metaTotal;

    return {
      ...eq,
      equipe,
      tipoEquipe,
      classificacaoObraManutencao,
      producaoTotal,
      produzidoTotal: producaoTotal,
      metaTotal,
      saldoMeta,
      percentualMeta,
      dentroMeta,
      quantidadeServicos: normalizarNumeroBI(eq.quantidadeServicos),
      quantidadeProjetos: normalizarNumeroBI(eq.quantidadeProjetos)
    };
  });
}

function calcularCardsDoMes(equipes = []) {
  const producaoTotal = equipes.reduce((total, eq) => total + normalizarNumeroBI(eq.producaoTotal), 0);
  const metaTotal = equipes.reduce((total, eq) => total + normalizarNumeroBI(eq.metaTotal), 0);
  const quantidadeServicos = equipes.reduce((total, eq) => total + normalizarNumeroBI(eq.quantidadeServicos), 0);
  const quantidadeProjetos = equipes.reduce((total, eq) => total + normalizarNumeroBI(eq.quantidadeProjetos), 0);
  const quantidadeEquipes = equipes.length;

  const equipesComMeta = equipes.filter(eq => normalizarNumeroBI(eq.metaTotal) > 0);
  const equipesDentroMeta = equipesComMeta.filter(eq => normalizarNumeroBI(eq.producaoTotal) >= normalizarNumeroBI(eq.metaTotal));
  const equipesForaMeta = equipesComMeta.filter(eq => normalizarNumeroBI(eq.producaoTotal) < normalizarNumeroBI(eq.metaTotal));

  const saldoMeta = producaoTotal - metaTotal;
  const percentualMeta = metaTotal > 0 ? (producaoTotal / metaTotal) * 100 : 0;

  return {
    producaoTotal,
    metaTotal,
    saldoMeta,
    percentualMeta,
    quantidadeServicos,
    quantidadeProjetos,
    quantidadeEquipes,
    equipesComMeta: equipesComMeta.length,
    equipesDentroMeta: equipesDentroMeta.length,
    equipesForaMeta: equipesForaMeta.length,
    mediaPorProjeto: quantidadeProjetos > 0 ? producaoTotal / quantidadeProjetos : 0,
    mediaPorServico: quantidadeServicos > 0 ? producaoTotal / quantidadeServicos : 0
  };
}

function calcularResumoPorTipo(equipes = []) {
  const criarGrupo = tipo => ({
    tipo,
    total: 0,
    metaTotal: 0,
    saldoMeta: 0,
    percentualMeta: 0,
    equipes: 0,
    equipesComMeta: 0,
    equipesDentroMeta: 0,
    equipesForaMeta: 0,
    servicos: 0,
    projetos: 0
  });

  const grupos = {
    "Pesada": criarGrupo("Pesada"),
    "Leve": criarGrupo("Leve"),
    "Linha Viva": criarGrupo("Linha Viva"),
    "Não classificada": criarGrupo("Não classificada")
  };

  equipes.forEach(eq => {
    const tipo = eq.tipoEquipe || "Não classificada";

    if (!grupos[tipo]) {
      grupos[tipo] = criarGrupo(tipo);
    }

    const producao = normalizarNumeroBI(eq.producaoTotal);
    const meta = normalizarNumeroBI(eq.metaTotal);

    grupos[tipo].total += producao;
    grupos[tipo].metaTotal += meta;
    grupos[tipo].equipes += 1;
    grupos[tipo].servicos += normalizarNumeroBI(eq.quantidadeServicos);
    grupos[tipo].projetos += normalizarNumeroBI(eq.quantidadeProjetos);

    if (meta > 0) {
      grupos[tipo].equipesComMeta += 1;

      if (producao >= meta) {
        grupos[tipo].equipesDentroMeta += 1;
      } else {
        grupos[tipo].equipesForaMeta += 1;
      }
    }
  });

  Object.values(grupos).forEach(grupo => {
    grupo.saldoMeta = grupo.total - grupo.metaTotal;
    grupo.percentualMeta = grupo.metaTotal > 0 ? (grupo.total / grupo.metaTotal) * 100 : 0;
  });

  return grupos;
}

function calcularResumoObraManutencao(equipes = []) {
  const criarGrupo = tipo => ({
    tipo,
    total: 0,
    metaTotal: 0,
    saldoMeta: 0,
    percentualMeta: 0,
    equipes: 0,
    equipesComMeta: 0,
    equipesDentroMeta: 0,
    equipesForaMeta: 0,
    servicos: 0,
    projetos: 0
  });

  const grupos = {
    "Obras": criarGrupo("Obras"),
    "Manutenção": criarGrupo("Manutenção")
  };

  equipes.forEach(eq => {
    const classificacao = obterClassificacaoObraManutencao(eq.equipe);

    const producao = normalizarNumeroBI(eq.producaoTotal);
    const meta = normalizarNumeroBI(eq.metaTotal);

    grupos[classificacao].total += producao;
    grupos[classificacao].metaTotal += meta;
    grupos[classificacao].equipes += 1;
    grupos[classificacao].servicos += normalizarNumeroBI(eq.quantidadeServicos);
    grupos[classificacao].projetos += normalizarNumeroBI(eq.quantidadeProjetos);

    if (meta > 0) {
      grupos[classificacao].equipesComMeta += 1;

      if (producao >= meta) {
        grupos[classificacao].equipesDentroMeta += 1;
      } else {
        grupos[classificacao].equipesForaMeta += 1;
      }
    }
  });

  Object.values(grupos).forEach(grupo => {
    grupo.saldoMeta = grupo.total - grupo.metaTotal;
    grupo.percentualMeta = grupo.metaTotal > 0 ? (grupo.total / grupo.metaTotal) * 100 : 0;
  });

  return grupos;
}

function calcularStatusMeta(equipes = [], cards = {}) {
  const equipesComMeta = equipes.filter(eq => normalizarNumeroBI(eq.metaTotal) > 0);
  const equipesForaMeta = equipesComMeta.filter(eq => normalizarNumeroBI(eq.producaoTotal) < normalizarNumeroBI(eq.metaTotal));
  const equipesDentroMeta = equipesComMeta.length - equipesForaMeta.length;

  if (!equipesComMeta.length || normalizarNumeroBI(cards.metaTotal) <= 0) {
    return {
      status: "sem-meta",
      classe: "sem-meta",
      texto: "Sem meta definida",
      textoCurto: "Sem meta",
      equipesComMeta: 0,
      equipesDentroMeta: 0,
      equipesForaMeta: 0
    };
  }

  if (!equipesForaMeta.length) {
    return {
      status: "dentro",
      classe: "dentro",
      texto: "DENTRO DA META",
      textoCurto: "Todas as equipes dentro da meta",
      equipesComMeta: equipesComMeta.length,
      equipesDentroMeta,
      equipesForaMeta: 0
    };
  }

  return {
    status: "fora",
    classe: "fora",
    texto: "FORA DA META",
    textoCurto: `${equipesForaMeta.length} equipe(s) fora da meta`,
    equipesComMeta: equipesComMeta.length,
    equipesDentroMeta,
    equipesForaMeta: equipesForaMeta.length
  };
}

function atualizarStatusMetaHeader(statusMeta) {
  const pill = $("#statusMetaHeader");
  if (!pill) return;

  pill.textContent = statusMeta.texto;
  pill.className = `meta-status-pill ${statusMeta.classe}`;
}

function calcularComparativoMensal(mesSelecionado, totalAtual) {
  const meses = ordenarMesesAsc(dadosBI);
  const indice = meses.findIndex(item => item.mes === mesSelecionado);

  if (indice <= 0) {
    return {
      valor: 0,
      texto: "Primeiro mês da série"
    };
  }

  const mesAnterior = meses[indice - 1];
  const equipesAnterior = classificarEquipes(
    mesAnterior.rankingGeralEquipes || mesAnterior.equipes || []
  );

  const totalAnterior = calcularCardsDoMes(equipesAnterior).producaoTotal;

  if (!totalAnterior) {
    return {
      valor: 0,
      texto: "Sem base no mês anterior"
    };
  }

  const variacao = ((totalAtual - totalAnterior) / totalAnterior) * 100;
  const sinal = variacao >= 0 ? "▲" : "▼";

  return {
    valor: variacao,
    texto: `${sinal} ${percentual(Math.abs(variacao))} vs. ${formatarMesCurto(mesAnterior.mes)}`
  };
}

function obterMesAtualLocal() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");

  return `${ano}-${mes}`;
}

function renderizarGraficoEvolucao() {
  const container = $("#chartEvolucao");
  if (!container) return;

  const mesAtualFixo = obterMesAtualLocal();

  const meses = ordenarMesesAsc(dadosBI).map(item => {
    const equipes = classificarEquipes(
      item.rankingGeralEquipes || item.equipes || []
    );

    const cards = calcularCardsDoMes(equipes);

    /*
      REGRA:
      - Produção aparece em todos os meses.
      - Meta só aparece do mês atual para frente.
      - Meses anteriores ficam sem meta no gráfico.
    */
    const deveMostrarMeta = String(item.mes || "") >= mesAtualFixo;

    return {
      mes: item.mes,
      producao: cards.producaoTotal,
      meta: deveMostrarMeta ? cards.metaTotal : null,
      percentualMeta: deveMostrarMeta ? cards.percentualMeta : null
    };
  });

  if (!meses.length) {
    container.innerHTML = `<div class="empty-state">Sem dados para o gráfico.</div>`;
    return;
  }

  const width = 680;
  const height = 250;
  const padding = {
    top: 30,
    right: 34,
    bottom: 46,
    left: 58
  };

  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const valores = meses.flatMap(item => {
    const lista = [item.producao];

    if (item.meta !== null && item.meta !== undefined) {
      lista.push(item.meta);
    }

    return lista;
  });

  const max = Math.max(...valores, 1);
  const min = 0;
  const range = Math.max(max - min, 1);

  function calcularPontos(chave) {
    return meses.map((item, index) => {
      const x = meses.length === 1
        ? padding.left + plotW / 2
        : padding.left + (index / (meses.length - 1)) * plotW;

      const valorOriginal = item[chave];

      if (valorOriginal === null || valorOriginal === undefined) {
        return {
          ...item,
          valor: null,
          x,
          y: null
        };
      }

      const valor = normalizarNumeroBI(valorOriginal);
      const y = padding.top + plotH - ((valor - min) / range) * plotH;

      return {
        ...item,
        valor,
        x,
        y
      };
    });
  }

  function criarLinhaSVG(pontos) {
    return pontos
      .filter(p => p.valor !== null && p.y !== null)
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");
  }

  const pontosProducao = calcularPontos("producao");
  const pontosMeta = calcularPontos("meta");

  const linhaProducao = criarLinhaSVG(pontosProducao);
  const linhaMeta = criarLinhaSVG(pontosMeta);

  const area = `${linhaProducao} L ${pontosProducao[pontosProducao.length - 1].x.toFixed(1)} ${padding.top + plotH} L ${pontosProducao[0].x.toFixed(1)} ${padding.top + plotH} Z`;

  const linhasGrade = [0, 0.25, 0.5, 0.75, 1].map(fator => {
    const y = padding.top + plotH * fator;
    return `<line class="chart-grid-line" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" />`;
  }).join("");

  const labelsEixo = pontosProducao.map((p, i) => {
    const deveExibir = pontosProducao.length <= 8 ||
      i === 0 ||
      i === pontosProducao.length - 1 ||
      i % Math.ceil(pontosProducao.length / 6) === 0;

    if (!deveExibir) return "";

    return `
      <text class="axis-label" x="${p.x}" y="${height - 14}" text-anchor="middle">
        ${escaparHTML(formatarMesCurto(p.mes))}
      </text>
    `;
  }).join("");

  const labelsPontos = pontosProducao.map((p, i) => {
    const deveExibir = pontosProducao.length <= 5 ||
      i === pontosProducao.length - 1 ||
      p.mes === mesAtualSelecionado;

    if (!deveExibir) return "";

    const metaPonto = pontosMeta[i];

    const yProducao = Math.max(16, p.y - 12);

    const labelMeta = metaPonto &&
      metaPonto.valor !== null &&
      metaPonto.y !== null
      ? `
          <text class="chart-label chart-label-meta" x="${metaPonto.x}" y="${Math.min(height - 52, metaPonto.y + 18)}" text-anchor="middle">
            ${escaparHTML(formatarMoedaCompacta(metaPonto.valor))}
          </text>
        `
      : "";

    return `
      <text class="chart-label" x="${p.x}" y="${yProducao}" text-anchor="middle">
        ${escaparHTML(formatarMoedaCompacta(p.producao))}
      </text>

      ${labelMeta}
    `;
  }).join("");

  const dotsProducao = pontosProducao.map(p => `
    <circle class="chart-dot" cx="${p.x}" cy="${p.y}" r="${p.mes === mesAtualSelecionado ? 6 : 4}" />
  `).join("");

  const dotsMeta = pontosMeta
    .filter(p => p.valor !== null && p.y !== null)
    .map(p => `
      <circle class="chart-dot-meta" cx="${p.x}" cy="${p.y}" r="${p.mes === mesAtualSelecionado ? 5 : 3.5}" />
    `).join("");

  container.innerHTML = `
    <svg class="evolution-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Gráfico de produção comparada com meta mensal">
      <defs>
        <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.34" />
          <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.02" />
        </linearGradient>
      </defs>

      ${linhasGrade}

      <path class="chart-area-fill" d="${area}" />

      ${linhaMeta
      ? `<path class="chart-line-meta" d="${linhaMeta}" />`
      : ""
    }

      <path class="chart-line" d="${linhaProducao}" />

      ${dotsMeta}
      ${dotsProducao}
      ${labelsPontos}
      ${labelsEixo}

      <g class="chart-legend-svg">
        <circle cx="${padding.left}" cy="16" r="4" class="chart-dot" />
        <text x="${padding.left + 10}" y="20" class="chart-legend-text">Produzido</text>

        <circle cx="${padding.left + 112}" cy="16" r="4" class="chart-dot-meta" />
        <text x="${padding.left + 122}" y="20" class="chart-legend-text">Meta a partir do mês atual</text>
      </g>
    </svg>
  `;
}



function renderizarDonutTipos(resumoTipo = {}, totalGeral = 0) {
  const donut = $("#donutChart");
  const legend = $("#legendTipos");
  const center = $("#donutCenter");
  const badge = $("#badgeTipo");

  if (!donut || !legend || !center) return;

  // Remove "Não classificada" do resumo para o donut de tipos
  const resumoSemNaoClassificada = { ...resumoTipo };
  delete resumoSemNaoClassificada["Não classificada"];

  const itens = Object.values(resumoSemNaoClassificada)
    .filter(item => item.total > 0 || item.equipes > 0)
    .sort((a, b) => b.total - a.total);

  if (!itens.length || !totalGeral) {
    donut.style.background = "conic-gradient(rgba(100, 116, 139, 0.4) 0 100%)";
    center.innerHTML = `0%<small>sem dados</small>`;
    legend.innerHTML = `<div class="empty-state">Sem produção por tipo.</div>`;
    setTexto("badgeTipo", "0%");
    return;
  }

  let acumulado = 0;

  const partes = itens.map(item => {
    const inicio = acumulado;
    const fatia = (item.total / totalGeral) * 100;
    const fim = acumulado + fatia;
    acumulado = fim;

    return `${HEX_TIPO[item.tipo] || "#64748b"} ${inicio.toFixed(2)}% ${fim.toFixed(2)}%`;
  });

  donut.style.background = `conic-gradient(${partes.join(", ")})`;

  const maior = itens[0];
  const maiorPercentual = (maior.total / totalGeral) * 100;

  center.innerHTML = `
    ${percentual(maiorPercentual)}
    <small>${escaparHTML(maior.tipo)}</small>
  `;

  if (badge) {
    badge.textContent = `${maior.tipo} lidera`;
  }

  legend.innerHTML = itens.map(item => {
    const perc = totalGeral ? (item.total / totalGeral) * 100 : 0;

    return `
      <div class="legend-item">
        <span class="legend-color" style="background:${HEX_TIPO[item.tipo] || "#64748b"}"></span>
        <span class="legend-title">${escaparHTML(item.tipo)}</span>
        <span class="legend-value">${percentual(perc)}</span>
      </div>
    `;
  }).join("");
}

function renderizarDonutObraManutencao(resumoObraManutencao = {}, totalGeral = 0) {
  const donut = $("#donutObraManutencaoChart");
  const legend = $("#legendObraManutencao");
  const center = $("#donutObraManutencaoCenter");

  if (!donut || !legend || !center) return;

  const HEX_OBRA_MANUTENCAO = {
    "Obras": "#f59e0b",
    "Manutenção": "#3b82f6"
  };

  const itens = Object.values(resumoObraManutencao)
    .filter(item => item.total > 0 || item.equipes > 0)
    .sort((a, b) => b.total - a.total);

  if (!itens.length || !totalGeral) {
    donut.style.background = "conic-gradient(rgba(100, 116, 139, 0.4) 0 100%)";
    center.innerHTML = `0%<small>sem dados</small>`;
    legend.innerHTML = `<div class="empty-state">Sem dados Obras x Manutenção.</div>`;
    return;
  }

  let acumulado = 0;

  const partes = itens.map(item => {
    const inicio = acumulado;
    const fatia = (item.total / totalGeral) * 100;
    const fim = acumulado + fatia;
    acumulado = fim;

    return `${HEX_OBRA_MANUTENCAO[item.tipo]} ${inicio.toFixed(2)}% ${fim.toFixed(2)}%`;
  });

  donut.style.background = `conic-gradient(${partes.join(", ")})`;

  const maior = itens[0];
  const maiorPercentual = (maior.total / totalGeral) * 100;

  center.innerHTML = `
    ${percentual(maiorPercentual)}
    <small>${escaparHTML(maior.tipo)}</small>
  `;

  legend.innerHTML = itens.map(item => {
    const perc = totalGeral ? (item.total / totalGeral) * 100 : 0;

    return `
      <div class="legend-item">
        <span class="legend-color" style="background:${HEX_OBRA_MANUTENCAO[item.tipo]}"></span>
        <span class="legend-title">${escaparHTML(item.tipo)}</span>
        <span class="legend-value">${percentual(perc)}</span>
        <span class="legend-detail">${numero(item.equipes)} equipes • ${formatarMoedaCompacta(item.total)}</span>
      </div>
    `;
  }).join("");
}

function renderizarTopEquipes(equipes = []) {
  const container = $("#topEquipes");
  if (!container) return;

  container.classList.remove("modo-menores", "animando-troca");
  void container.offsetWidth;
  container.classList.add("animando-troca");

  if (modoRanking === "bottom") {
    container.classList.add("modo-menores");
  }

  const baseOrdenada = [...equipes]
    .filter(item => Number(item.producaoTotal || 0) > 0)
    .sort((a, b) => {
      return modoRanking === "top"
        ? b.producaoTotal - a.producaoTotal
        : a.producaoTotal - b.producaoTotal;
    });

  const lista = baseOrdenada.slice(0, CONFIG.maxRankingGeral);

  const titulo = modoRanking === "top" ? "Maiores equipes" : "Menores equipes";
  const dica = modoRanking === "top"
    ? "Top produções do mês"
    : "Equipes com menor produção positiva no mês";

  setTexto("tituloTopEquipes", titulo);
  setTexto("hintTopEquipes", dica);
  setTexto("badgeTop", modoRanking === "top" ? `Top ${lista.length}` : `Menores ${lista.length}`);

  if (!lista.length) {
    container.innerHTML = `<div class="empty-state">Nenhuma equipe encontrada.</div>`;
    return;
  }

  const maior = Math.max(...lista.map(item => item.producaoTotal), 1);

  container.innerHTML = lista
    .map((item, index) => montarLinhaRanking(item, index, maior))
    .join("");
}

function montarLinhaRanking(item, index, maior) {
  const temMeta = normalizarNumeroBI(item.metaTotal) > 0;

  const largura = temMeta
    ? Math.min(100, Math.max(3, normalizarNumeroBI(item.percentualMeta)))
    : Math.max(3, (normalizarNumeroBI(item.producaoTotal) / maior) * 100);

  const classeMeta = temMeta
    ? item.dentroMeta
      ? "meta-ok"
      : "meta-fora"
    : "meta-sem";

  const detalheMeta = temMeta
    ? `${percentual(item.percentualMeta)} da meta • saldo ${formatarMoedaCompacta(item.saldoMeta)}`
    : "sem meta definida";

  return `
    <div class="rank-row ${classeMeta}" style="animation-delay:${index * 0.05}s">
      <div class="rank-pos">${index + 1}</div>

      <div class="rank-info">
        <strong title="${escaparHTML(item.equipe)}">
          ${escaparHTML(item.equipe || "SEM EQUIPE")}
        </strong>

        <small>
          ${escaparHTML(item.tipoEquipe || "Não classificada")} • ${escaparHTML(detalheMeta)}
        </small>
      </div>

      <div class="rank-value">
        ${formatarMoedaCompacta(item.producaoTotal)}
      </div>

      <div class="bar-track">
        <div class="bar-fill ${classeMeta}" style="--w:${largura.toFixed(2)}%"></div>
      </div>
    </div>
  `;
}

function renderizarRankingPorTipo(equipes = [], resumoTipo = {}, totalGeral = 0, resumoObraManutencao = {}) {
  const container = $("#rankingPorTipo");
  if (!container) return;

  if (!equipes.length) {
    container.innerHTML = `<div class="empty-state">Nenhuma equipe encontrada.</div>`;
    return;
  }

  const tiposOrdem = ["Pesada", "Leve", "Linha Viva"];

  container.classList.remove("modo-menores", "animando-troca");
  void container.offsetWidth;
  container.classList.add("animando-troca");

  if (modoRanking === "bottom") {
    container.classList.add("modo-menores");
  }

  setTexto(
    "tituloRankingTipo",
    modoRanking === "top" ? "Ranking por classificação" : "Menores por classificação"
  );

  setTexto(
    "hintRankingTipo",
    modoRanking === "top"
      ? "Maiores equipes por tipo"
      : "Menores equipes positivas por tipo"
  );

  const cardsPorTipoHTML = tiposOrdem.map((tipo, indexTipo) => {
    const equipesTipo = equipes
      .filter(eq => (eq.tipoEquipe || "Não classificada") === tipo)
      .filter(eq => modoRanking === "top" || Number(eq.producaoTotal || 0) > 0)
      .sort((a, b) => {
        return modoRanking === "top"
          ? b.producaoTotal - a.producaoTotal
          : a.producaoTotal - b.producaoTotal;
      });

    const resumo = resumoTipo[tipo] || {
      total: 0,
      metaTotal: 0,
      saldoMeta: 0,
      percentualMeta: 0,
      equipes: 0,
      servicos: 0,
      projetos: 0
    };

    const percentualTipo = normalizarNumeroBI(resumo.percentualMeta);
    const progresso = Math.min(100, Math.max(0, percentualTipo));
    const top = equipesTipo.slice(0, CONFIG.maxRankingPorTipo);
    const rotuloModo = modoRanking === "top" ? "Top" : "Menores";

    if (!top.length) return;
    return `
      <div class="type-card" style="animation-delay:${indexTipo * 0.06}s">
        <div class="type-head">
          <div class="type-title">
            <h3>${escaparHTML(tipo)}</h3>

            <small>
              <span class="troca-label">
                ${rotuloModo} • ${numero(resumo.equipes)} equipes • ${percentual(percentualTipo)} da meta
              </span>
            </small>
          </div>

          <div class="type-total">
            ${formatarMoedaCompacta(resumo.total)} / ${formatarMoedaCompacta(resumo.metaTotal)}
          </div>
        </div>

        <div class="mini-progress">
          <span style="--w:${progresso.toFixed(2)}%; background:linear-gradient(90deg, ${HEX_TIPO[tipo] || "#64748b"}, rgba(255,255,255,0.5));"></span>
        </div>

        <div class="mini-list">
          ${top.length
        ? top.map((item, index) => montarMiniLinha(item, index)).join("")
        : `<div class="empty-state">Sem equipes neste tipo.</div>`
      }
        </div>
      </div>
    `;
  }).join("");

  const cardObrasManutencaoHTML = montarCardObrasManutencao(
    equipes,
    resumoObraManutencao,
    tiposOrdem.length
  );

  container.innerHTML = cardsPorTipoHTML + cardObrasManutencaoHTML;
}

function montarCardObrasManutencao(equipes = [], resumoObraManutencao = {}, indexCard = 0) {
  const tipos = ["Obras", "Manutenção"];
  const rotuloModo = modoRanking === "top" ? "Top" : "Menores";

  const totalProducao = tipos.reduce((total, tipo) => {
    return total + normalizarNumeroBI(resumoObraManutencao[tipo]?.total);
  }, 0);

  const totalMeta = tipos.reduce((total, tipo) => {
    return total + normalizarNumeroBI(resumoObraManutencao[tipo]?.metaTotal);
  }, 0);

  const percentualGeral = totalMeta > 0 ? (totalProducao / totalMeta) * 100 : 0;
  const progressoGeral = Math.min(100, Math.max(0, percentualGeral));

  const gruposHTML = tipos.map(tipo => {
    const resumo = resumoObraManutencao[tipo] || {
      total: 0,
      metaTotal: 0,
      saldoMeta: 0,
      percentualMeta: 0,
      equipes: 0,
      equipesComMeta: 0,
      equipesDentroMeta: 0,
      equipesForaMeta: 0,
      servicos: 0,
      projetos: 0
    };

    const equipesGrupo = equipes
      .filter(eq => (eq.classificacaoObraManutencao || obterClassificacaoObraManutencao(eq.equipe)) === tipo)
      .filter(eq => modoRanking === "top" || Number(eq.producaoTotal || 0) > 0)
      .sort((a, b) => {
        return modoRanking === "top"
          ? b.producaoTotal - a.producaoTotal
          : a.producaoTotal - b.producaoTotal;
      });

    const top = equipesGrupo.slice(0, CONFIG.maxRankingPorTipo);
    const percentualGrupo = normalizarNumeroBI(resumo.percentualMeta);
    const progressoGrupo = Math.min(100, Math.max(0, percentualGrupo));
    const cor = HEX_OBRA_MANUTENCAO[tipo] || "#64748b";

    return `
      <div class="om-group">
        <div class="om-group-head">
          <div>
            <strong>${escaparHTML(tipo)}</strong>
            <small>${numero(resumo.equipes)} equipes • ${percentual(percentualGrupo)} da meta</small>
          </div>

          <span>${formatarMoedaCompacta(resumo.total)}</span>
        </div>

        <div class="mini-progress om-progress">
          <span style="--w:${progressoGrupo.toFixed(2)}%; background:linear-gradient(90deg, ${cor}, rgba(255,255,255,0.5));"></span>
        </div>
      </div>
    `;
  }).join("");

  return " ";
  return `
    <div class="type-card obras-manutencao-card" style="animation-delay:${indexCard * 0.06}s">
      <div class="type-head">
        <div class="type-title">
          <h3>Obras x Manutenção</h3>

          <small>
            <span class="troca-label">
              ${rotuloModo} • comparativo por classificação • ${percentual(percentualGeral)} da meta
            </span>
          </small>
        </div>

        <div class="type-total">
          ${formatarMoedaCompacta(totalProducao)} / ${formatarMoedaCompacta(totalMeta)}
        </div>
      </div>

      <div class="mini-progress obras-manutencao-progress">
        <span style="--w:${progressoGeral.toFixed(2)}%; background:linear-gradient(90deg, ${HEX_OBRA_MANUTENCAO.Obras}, ${HEX_OBRA_MANUTENCAO["Manutenção"]});"></span>
      </div>

      <div class="om-grid">
        ${gruposHTML}
      </div>
    </div>
  `;
}

function montarMiniLinha(item, index) {
  const temMeta = normalizarNumeroBI(item.metaTotal) > 0;

  const classeMeta = temMeta
    ? item.dentroMeta
      ? "meta-ok"
      : "meta-fora"
    : "meta-sem";

  return `
    <div class="mini-row ${classeMeta}">
      <span class="mini-pos">${index + 1}</span>

      <span class="mini-name">
        <strong title="${escaparHTML(item.equipe)}">
          ${escaparHTML(item.equipe || "SEM EQUIPE")}
        </strong>

        <small>
          ${temMeta ? `${percentual(item.percentualMeta)} da meta` : "sem meta"}
        </small>
      </span>

      <span class="mini-value">
        ${formatarMoedaCompacta(item.producaoTotal)}
      </span>
    </div>
  `;
}

function renderizarTicker({ mes, cards, equipes, statusMeta }) {
  const ticker = $("#ticker");
  if (!ticker) return;

  const melhores = [...equipes]
    .sort((a, b) => b.producaoTotal - a.producaoTotal)
    .slice(0, 5);

  const pontoAtencao = [...equipes]
    .filter(e => normalizarNumeroBI(e.metaTotal) > 0 && !e.dentroMeta)
    .sort((a, b) => normalizarNumeroBI(a.percentualMeta) - normalizarNumeroBI(b.percentualMeta))[0];

  const classeStatusTicker = statusMeta?.status === "fora"
    ? "ticker-danger"
    : "ticker-value";

  const itens = [
    tickerItem("📅", "Mês", formatarMes(mes.mes), "ticker-info"),
    tickerItem("💰", "Produção", moeda(cards.producaoTotal), "ticker-value"),
    tickerItem("🎯", "Meta", moeda(cards.metaTotal), "ticker-info"),
    tickerItem("📊", "Saldo", moeda(cards.saldoMeta), cards.saldoMeta >= 0 ? "ticker-value" : "ticker-danger"),
    tickerItem("📈", "Atingimento", percentual(cards.percentualMeta), classeStatusTicker),
    tickerItem("👷", "Equipes", numero(cards.quantidadeEquipes), "ticker-info"),

    ...melhores.map(eq => {
      return tickerItem(
        "🏆",
        `${eq.equipe} • ${eq.tipoEquipe}`,
        `${moeda(eq.producaoTotal)} • ${percentual(eq.percentualMeta)}`,
        "ticker-value"
      );
    }),

    pontoAtencao
      ? tickerItem(
        "⚠️",
        `${pontoAtencao.equipe} fora da meta`,
        `${percentual(pontoAtencao.percentualMeta)} • falta ${formatarMoedaCompacta(Math.abs(pontoAtencao.saldoMeta))}`,
        "ticker-danger"
      )
      : ""
  ].filter(Boolean);

  const conteudo = itens.join("");
  ticker.innerHTML = conteudo + conteudo;
}

function tickerItem(icone, label, valor, classe) {
  return `
    <div class="ticker-item">
      <span>${icone}</span>
      <span class="ticker-label">${escaparHTML(label)}:</span>
      <span class="${classe}">${escaparHTML(valor)}</span>
    </div>
  `;
}

function renderizarSemDados(mensagem) {
  setStatus("Sem dados", "erro");

  atualizarStatusMetaHeader({
    texto: "SEM META",
    classe: "sem-meta"
  });

  setTexto("producaoTotal", "R$ 0,00");
  setTexto("metaTotal", "R$ 0,00");
  setTexto("saldoMeta", "R$ 0,00");
  setTexto("percentualMeta", "0%");
  setTexto("qtdServicos", "0");
  setTexto("qtdEquipes", "0");

  const chartEvolucao = $("#chartEvolucao");
  const legendTipos = $("#legendTipos");
  const topEquipes = $("#topEquipes");
  const rankingPorTipo = $("#rankingPorTipo");
  const ticker = $("#ticker");

  if (chartEvolucao) chartEvolucao.innerHTML = `<div class="empty-state">${escaparHTML(mensagem)}</div>`;
  if (legendTipos) legendTipos.innerHTML = `<div class="empty-state">${escaparHTML(mensagem)}</div>`;
  if (topEquipes) topEquipes.innerHTML = `<div class="empty-state">${escaparHTML(mensagem)}</div>`;
  if (rankingPorTipo) rankingPorTipo.innerHTML = `<div class="empty-state">${escaparHTML(mensagem)}</div>`;
  if (ticker) ticker.innerHTML = `<div class="ticker-item"><span class="ticker-label">${escaparHTML(mensagem)}</span></div>`;
}

function renderizarErro(error) {
  const mensagem = `Erro ao carregar dados: ${error.message || "verifique o backend"}`;
  renderizarSemDados(mensagem);
}

function animarTextoNumerico(id, valorFinal, formatador) {
  const elemento = document.getElementById(id);
  if (!elemento) return;

  const inicio = 0;
  const fim = Number(valorFinal || 0);
  const duracao = 650;
  const inicioTempo = performance.now();

  function atualizar(agora) {
    const progresso = Math.min((agora - inicioTempo) / duracao, 1);
    const suavizado = 1 - Math.pow(1 - progresso, 3);
    const valor = inicio + (fim - inicio) * suavizado;

    elemento.textContent = formatador(valor);

    if (progresso < 1) {
      requestAnimationFrame(atualizar);
    }
  }

  requestAnimationFrame(atualizar);
}

function setTexto(id, valor) {
  const elemento = document.getElementById(id);

  if (elemento) {
    elemento.textContent = valor;
  }
}

function formatarMes(mes) {
  if (!mes) return "";

  const [ano, numeroMes] = String(mes).split("-");

  const nomes = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro"
  ];

  const indice = Number(numeroMes) - 1;

  return `${nomes[indice] || numeroMes} / ${ano}`;
}

function formatarMesCurto(mes) {
  if (!mes) return "";

  const [ano, numeroMes] = String(mes).split("-");

  const nomes = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez"
  ];

  const indice = Number(numeroMes) - 1;

  return `${nomes[indice] || numeroMes}/${String(ano || "").slice(-2)}`;
}

function formatarMoedaCompacta(valor) {
  const numeroValor = Number(valor || 0);

  if (Math.abs(numeroValor) >= 1_000_000) {
    return `R$ ${(numeroValor / 1_000_000).toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    })} mi`;
  }

  if (Math.abs(numeroValor) >= 1_000) {
    return `R$ ${(numeroValor / 1_000).toLocaleString("pt-BR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })} mil`;
  }

  return moeda(numeroValor);
}

function atualizarRelogio() {
  const relogio = $("#relogio");
  if (!relogio) return;

  const agora = new Date();

  relogio.textContent = agora.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function obterResumoMesAtual() {
  const mes = dadosBI.find(item => item.mes === mesAtualSelecionado);
  if (!mes) return null;

  const equipes = classificarEquipes(
    mes.rankingGeralEquipes || mes.equipes || []
  );

  const cards = calcularCardsDoMes(equipes);
  const resumoTipo = calcularResumoPorTipo(equipes);
  const resumoObraManutencao = calcularResumoObraManutencao(equipes);

  return {
    mes,
    equipes,
    cards,
    resumoTipo,
    resumoObraManutencao
  };
}

function alternarRankings() {
  const resumo = obterResumoMesAtual();
  if (!resumo) return;

  modoRanking = modoRanking === "top" ? "bottom" : "top";

  renderizarTopEquipes(resumo.equipes);
  renderizarRankingPorTipo(resumo.equipes, resumo.resumoTipo, resumo.cards.producaoTotal, resumo.resumoObraManutencao);
}

function iniciarRotinasAutomaticas() {
  reiniciarTrocaAutomatica();

  if (CONFIG.atualizarDadosAutomatico && !timerAtualizacao) {
    timerAtualizacao = setInterval(() => {
      carregarBI({
        silencioso: true
      });
    }, CONFIG.segundosAtualizacaoDados * 1000);
  }

  if (!timerAlternanciaRanking) {
    timerAlternanciaRanking = setInterval(() => {
      alternarRankings();
    }, CONFIG.segundosAlternanciaRanking * 1000);
  }
}

function reiniciarTrocaAutomatica() {
  if (timerTrocaMes) {
    clearInterval(timerTrocaMes);
    timerTrocaMes = null;
  }

  if (!CONFIG.autoTrocarMes || dadosBI.length <= 1) return;

  timerTrocaMes = setInterval(() => {
    const meses = ordenarMesesDesc(dadosBI);
    const indiceAtual = meses.findIndex(item => item.mes === mesAtualSelecionado);
    const proximoIndice = indiceAtual >= 0 ? (indiceAtual + 1) % meses.length : 0;

    renderizarMes(meses[proximoIndice].mes);
  }, CONFIG.segundosTrocaMes * 1000);
}

atualizarRelogio();
setInterval(atualizarRelogio, 1000);
carregarBI();
