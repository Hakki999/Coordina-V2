(function criarClienteSgo() {
  const BASE = "http://10.204.8.68:8083";
  const AUTORIZACAO = "Basic SjQwODIxNDQ5OjEwOTFabl8kKnBgIy1TQVA";
  const CONSULTAS = {
    Notas: { nome: "Dados por nota", caminho: "/Service/SolicitacaoInvestimentoService.svc/rest/ListarSolicitacaoInvestimentoPorNota", corpo: id => ({ Nota: id }) },
    NomeObra: { nome: "Dados por nome da obra", caminho: "/Service/SolicitacaoInvestimentoService.svc/rest/ListarSolicitacaoInvestimentoPorNomeProjeto", corpo: id => ({ NomeProjeto: id }) },
    NPEP: { nome: "Status da nota SAP", caminho: "/Service/SolicitacaoInvestimentoService.svc/rest/VerificarStatusNotaSap", corpo: id => ({ sNota: `000${id}` }) },
    FluxoNota: { nome: "Fluxo da solicitação", caminho: "/Service/LogFluxo.svc/rest/GetListLogFluxoBySliId", corpo: id => ({ soliciatacaoid: id }) },
    OrcamentoNota: { nome: "Orçamento", caminho: "/Service/OrcamentoSap.svc/rest/GetOrcamentoSapBySolicitacaoId", corpo: id => id },
    ObterFluxoArquivos: { nome: "Fluxo de arquivos", caminho: "/Service/FileUploadServ.svc/rest/GetArquivoFluxoSol", corpo: id => ({ solId: id, status: "CONS" }) },
    assinaturas: {
      nome: "Assinaturas",
      caminhos: [
        "/Service/DocumentoObra.svc/rest/AEOAssinadoCompanhia",
        "/Service/DocumentoObra.svc/rest/AEOAssinadoParceira",
        "/Service/DocumentoObra.svc/rest/ACOSAssinadoCompanhia",
        "/Service/DocumentoObra.svc/rest/ACOSAssinadoParceira"
      ],
      corpo: id => ({ solId: id })
    },
    ObterNotaPorPEP: { nome: "Nota por PEP", caminho: "/Service/SolicitacaoInvestimentoService.svc/rest/ListarSolicitacaoInvestimentoPorPEP", corpo: id => ({ PEP: id }) }
  };
  const LIMITE_REQUISICOES_SGO = 6;
  const consultasEmAndamento = new Map();
  const filaRequisicoes = [];
  let requisicoesAtivas = 0;
  let configuracaoCache;
  let configuracaoPromise;
  let credenciaisPreferidas = "include";

  const normalizarChave = valor => String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

  function nomeEndpoint(caminho) {
    return caminho.split("/").filter(Boolean).at(-1);
  }

  function liberarRequisicao() {
    requisicoesAtivas = Math.max(0, requisicoesAtivas - 1);
    const proxima = filaRequisicoes.shift();
    if (proxima) {
      requisicoesAtivas += 1;
      proxima();
    }
  }

  async function comLimiteDeRequisicoes(executor) {
    if (requisicoesAtivas >= LIMITE_REQUISICOES_SGO) {
      await new Promise(resolve => filaRequisicoes.push(resolve));
    } else {
      requisicoesAtivas += 1;
    }
    try {
      return await executor();
    } finally {
      liberarRequisicao();
    }
  }

  async function processarEmParalelo(itens, executor, limite = 4, deveParar = () => false) {
    const lista = Array.from(itens || []);
    const resultados = new Array(lista.length);
    let proximoIndice = 0;
    const quantidade = Math.min(Math.max(1, Number(limite) || 1), lista.length);
    const trabalhadores = Array.from({ length: quantidade }, async () => {
      while (!deveParar()) {
        const indice = proximoIndice;
        proximoIndice += 1;
        if (indice >= lista.length) return;
        resultados[indice] = await executor(lista[indice], indice);
      }
    });
    await Promise.all(trabalhadores);
    return resultados;
  }

  async function chamar(caminho, corpo, timeoutMs = 30000) {
    return comLimiteDeRequisicoes(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const executar = credentials => fetch(`${BASE}${caminho}`, {
        headers: {
          accept: "application/json, text/plain, */*",
          "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
          authorization: AUTORIZACAO,
          "content-type": "application/json;charset=UTF-8"
        },
        referrer: `${BASE}/`,
        body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
        method: "POST",
        mode: "cors",
        credentials,
        targetAddressSpace: "local",
        signal: controller.signal
      });
      try {
        let response;
        const primaria = credenciaisPreferidas;
        try {
          response = await executar(primaria);
        } catch (error) {
          if (!(error instanceof TypeError)) throw error;
          const alternativa = primaria === "include" ? "omit" : "include";
          response = await executar(alternativa);
          credenciaisPreferidas = alternativa;
        }
        const texto = await response.text();
        let dados;
        try { dados = JSON.parse(texto); } catch { dados = texto; }
        if (!response.ok) throw new Error(`SGO respondeu HTTP ${response.status}.`);
        return dados;
      } catch (error) {
        if (error.name === "AbortError") throw new Error("Tempo limite excedido na consulta SGO.");
        if (error instanceof TypeError) {
          if (!window.isSecureContext) {
            throw new Error("Abra o Coordina pelo endereco HTTPS para consultar o SGO pela VPN.");
          }
          throw new Error("O navegador bloqueou o acesso ao SGO. Confirme a VPN e permita ao Coordina acessar a rede local.");
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    });
  }

  function encontrarPorChaves(valor, chaves, profundidade = 0) {
    if (profundidade > 12 || valor === null || valor === undefined || typeof valor !== "object") return undefined;
    for (const [chave, item] of Object.entries(valor)) {
      if (chaves.has(normalizarChave(chave)) && item !== null && item !== "" && typeof item !== "object") return item;
    }
    const filhos = Array.isArray(valor) ? [...valor].reverse() : Object.values(valor);
    for (const item of filhos) {
      const encontrado = encontrarPorChaves(item, chaves, profundidade + 1);
      if (encontrado !== undefined) return encontrado;
    }
    return undefined;
  }

  function segmento(valor, chave) {
    if (valor === null || valor === undefined) return undefined;
    if (Array.isArray(valor)) {
      if (/^\d+$/.test(chave)) return valor[Number(chave)];
      for (const item of valor) {
        const encontrado = segmento(item, chave);
        if (encontrado !== undefined) return encontrado;
      }
      return undefined;
    }
    if (typeof valor !== "object") return undefined;
    const real = Object.keys(valor).find(item => normalizarChave(item) === normalizarChave(chave));
    return real === undefined ? undefined : valor[real];
  }

  function caminho(valor, expressao) {
    const partes = String(expressao || "").replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
    return partes.reduce((atual, parte) => segmento(atual, parte), valor);
  }

  function resolver(expressao, contexto) {
    const alternativas = String(expressao || "").split("||").map(item => item.trim()).filter(Boolean);
    for (const alternativa of alternativas) {
      let valor;
      if (alternativa === "$input") valor = contexto.input;
      else if (alternativa.startsWith("$search:")) {
        const chaves = new Set(alternativa.slice(8).split(",").map(normalizarChave).filter(Boolean));
        valor = encontrarPorChaves(contexto.steps, chaves);
      } else if (alternativa.startsWith("$steps.")) {
        valor = caminho(contexto.steps, alternativa.slice(7));
      } else {
        valor = alternativa;
      }
      if (valor !== undefined && valor !== null && valor !== "") return valor;
    }
    return undefined;
  }

  function achatar(valor, prefixo = "$", saida = [], profundidade = 0) {
    if (profundidade > 12) return saida;
    if (valor === null || valor === undefined || typeof valor !== "object") {
      saida.push({ caminho: prefixo, valor });
      return saida;
    }
    const entradas = Object.entries(valor);
    if (!entradas.length) saida.push({ caminho: prefixo, valor: "" });
    entradas.forEach(([chave, item]) => {
      const proximo = Array.isArray(valor) ? `${prefixo}[${chave}]` : `${prefixo}.${chave}`;
      achatar(item, proximo, saida, profundidade + 1);
    });
    return saida;
  }

  async function consultarSgo(tipo, id) {
    const definicao = CONSULTAS[tipo];
    if (!definicao) throw new Error("Tipo de consulta SGO inválido.");
    const entrada = String(id ?? "").trim();
    const chaveConsulta = `${tipo}:${entrada}`;
    if (consultasEmAndamento.has(chaveConsulta)) return consultasEmAndamento.get(chaveConsulta);
    const consulta = (async () => {
      const caminhos = definicao.caminhos || [definicao.caminho];
      const respostas = await Promise.all(caminhos.map(async item => ({
        endpoint: nomeEndpoint(item),
        dados: await chamar(item, definicao.corpo(entrada))
      })));
      const dados = respostas.length === 1 ? respostas[0].dados : respostas;
      return {
        id: entrada,
        tipo,
        endpoint: respostas.map(item => item.endpoint).join(", "),
        status: "Consulta concluída",
        dados,
        consultadoEm: new Date().toISOString()
      };
    })();
    consultasEmAndamento.set(chaveConsulta, consulta);
    try {
      return await consulta;
    } finally {
      consultasEmAndamento.delete(chaveConsulta);
    }
  }

  async function carregarConfiguracao(forcar = false) {
    if (configuracaoCache && !forcar) return configuracaoCache;
    if (configuracaoPromise && !forcar) return configuracaoPromise;
    configuracaoPromise = (async () => {
      const response = await fetch("/api/sgo/config", { credentials: "include" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar a configuração SGO.");
      configuracaoCache = data;
      return data;
    })();
    try {
      return await configuracaoPromise;
    } finally {
      configuracaoPromise = null;
    }
  }

  function transformar(valor, tipo) {
    if (valor === undefined || valor === null || valor === "") return undefined;
    if (tipo === "texto") return typeof valor === "object" ? JSON.stringify(valor) : String(valor);
    if (tipo === "maiusculo") return String(valor).toLocaleUpperCase("pt-BR");
    if (tipo === "minusculo") return String(valor).toLocaleLowerCase("pt-BR");
    if (tipo === "sim_nao") return valor === true || valor === 1 || String(valor).toLowerCase() === "true" ? "Sim" : "Não";
    if (tipo === "numero") {
      const texto = String(valor).trim();
      const numero = Number(texto.includes(",") ? texto.replace(/\./g, "").replace(",", ".") : texto);
      return Number.isFinite(numero) ? numero : valor;
    }
    if (tipo === "data") {
      const data = new Date(valor);
      return Number.isNaN(data.getTime()) ? valor : data.toISOString().slice(0, 10);
    }
    return valor;
  }

  async function executarPipeline(id, configuracaoInformada, registroAtual = {}) {
    const carregada = configuracaoInformada ? null : await carregarConfiguracao();
    const configuracao = configuracaoInformada || carregada.configuracao;
    const contexto = { input: String(id ?? "").trim(), steps: {} };
    const consultas = [];
    const etapasAtivas = configuracao.etapas.filter(item => item.ativo !== false);
    const idsAtivos = new Set(etapasAtivas.map(item => item.id));
    const concluidas = new Set();
    let pendentes = [...etapasAtivas];

    while (pendentes.length) {
      let prontas = pendentes.filter(etapa => {
        const dependencias = [...String(etapa.entrada || "").matchAll(/\$steps\.([a-zA-Z0-9_-]+)/g)]
          .map(item => item[1])
          .filter(dependencia => idsAtivos.has(dependencia));
        return dependencias.every(dependencia => concluidas.has(dependencia));
      });
      if (!prontas.length) prontas = [pendentes[0]];

      const resultados = await Promise.all(prontas.map(async etapa => {
        const entrada = resolver(etapa.entrada || "$input", contexto);
        try {
          const resultado = await consultarSgo(etapa.tipo, entrada);
          contexto.steps[etapa.id] = resultado.dados;
          return { ...resultado, etapaId: etapa.id, etapaNome: etapa.nome, entrada };
        } catch (error) {
          contexto.steps[etapa.id] = { erro: error.message };
          return { id: contexto.input, tipo: etapa.tipo, etapaId: etapa.id, etapaNome: etapa.nome, entrada, erro: error.message };
        }
      }));
      consultas.push(...resultados);
      prontas.forEach(etapa => {
        concluidas.add(etapa.id);
        pendentes = pendentes.filter(item => item.id !== etapa.id);
      });
    }
    const dados = {};
    configuracao.mapeamentos.forEach(item => {
      const valor = transformar(resolver(item.origem, contexto), item.transformacao);
      const atual = registroAtual?.[item.destino];
      const vazio = atual === undefined || atual === null || atual === "";
      if (item.regra === "nunca" || (item.regra === "se_vazio" && !vazio)) return;
      if (item.regra === "se_diferente" && String(atual ?? "") === String(valor ?? "")) return;
      if (valor !== undefined && valor !== null && valor !== "") dados[item.destino] = valor;
    });
    if (!consultas.some(item => !item.erro)) throw new Error(consultas[0]?.erro || "Não foi possível consultar o projeto no SGO.");
    return { dados, consultas, contexto };
  }

  async function consultarDadosProjeto(id, registroAtual) {
    return executarPipeline(id, undefined, registroAtual);
  }

  window.sgoClient = {
    BASE,
    CONSULTAS,
    consultarSgo,
    consultarDadosProjeto,
    executarPipeline,
    carregarConfiguracao,
    processarEmParalelo,
    resolver,
    achatar
  };
  window.consultarStatusSgo = async id => {
    const resultado = await executarPipeline(id);
    return { dados: resultado.contexto.steps, dadosControle: resultado.dados, consultadoEm: new Date().toISOString() };
  };
})();
