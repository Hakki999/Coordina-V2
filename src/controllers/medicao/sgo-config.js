const db = require("../../models/db");
const { COLUNAS, listarColunasControle } = require("../controle-asbuilt");
const { sanitizeText } = require("../../utils/security");

const CHAVE = "controle_asbuilt";
const TIPOS_PERMITIDOS = new Set([
  "Notas", "NomeObra", "NPEP", "FluxoNota", "OrcamentoNota",
  "ObterFluxoArquivos", "assinaturas", "ObterNotaPorPEP"
]);

const CONFIGURACAO_PADRAO = {
  chave: CHAVE,
  nome: "Atualização do Controle As-Built",
  descricao: "Consulta dados do projeto no SGO e preenche automaticamente o controle.",
  ativo: true,
  etapas: [
    { id: "nota", nome: "Dados por nota", tipo: "Notas", entrada: "$input", ativo: true },
    { id: "fluxo", nome: "Fluxo da solicitação", tipo: "FluxoNota", entrada: "$steps.nota.SliId || $input", ativo: true },
    { id: "orcamento", nome: "Orçamento", tipo: "OrcamentoNota", entrada: "$steps.nota.SliId || $input", ativo: true }
  ],
  mapeamentos: [
    { destino: "status_sgo", origem: "$search:statusFluxo,descricaoStatus,descStatus,status,situacao,etapa,nomeFluxo" },
    { destino: "status_sap", origem: "$search:statusSAP,statusNotaSAP,situacaoSAP" },
    { destino: "sapid", origem: "$search:sliId,solicitacaoId,nota,notaSAP,idSolicitacao" },
    { destino: "pep", origem: "$search:pep,elemento_pep,nPEP" },
    { destino: "pi", origem: "$search:pi,numeroPI" },
    { destino: "nome", origem: "$search:nomeProjeto,nomeObra,descricaoProjeto" },
    { destino: "projetista", origem: "$search:projetista,nomeProjetista" },
    { destino: "status", origem: "$search:statusAsBuilt,statusProjeto,situacaoProjeto" },
    { destino: "asbuilt", origem: "$search:asbuilt,numeroAsBuilt,codigoAsBuilt" },
    { destino: "segmento", origem: "$search:segmento,tipoObra,tipoProjeto" },
    { destino: "oc", origem: "$search:oc,ordemCompra,numeroOC" },
    { destino: "ciclo", origem: "$search:ciclo" },
    { destino: "pep_n4", origem: "$search:pepN4,numeroPepN4" },
    { destino: "prod", origem: "$search:prod,producao" },
    { destino: "restricao", origem: "$search:restricao,observacaoRestricao" },
    { destino: "valor", origem: "$steps.orcamento.valorTotal || $steps.orcamento.valorOrcamento || $steps.orcamento.valor" },
    { destino: "versao", origem: "$search:versao,versaoProjeto" }
  ]
};

function parseJson(valor, fallback) {
  try {
    const parsed = JSON.parse(valor);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function linhaParaConfig(linha) {
  if (!linha) return {
    ...CONFIGURACAO_PADRAO,
    etapas: CONFIGURACAO_PADRAO.etapas.map(item => ({ ...item })),
    mapeamentos: CONFIGURACAO_PADRAO.mapeamentos.map(item => ({ ...item, regra: item.regra || "sempre" }))
  };
  return {
    chave: linha.chave,
    nome: linha.nome,
    descricao: linha.descricao || "",
    ativo: Boolean(linha.ativo),
    etapas: parseJson(linha.etapas_json, CONFIGURACAO_PADRAO.etapas),
    mapeamentos: parseJson(linha.mapeamentos_json, CONFIGURACAO_PADRAO.mapeamentos)
      .map(item => ({ ...item, regra: item.regra || "sempre" })),
    atualizadoEm: linha.atualizado_em
  };
}

async function buscar() {
  const [rows] = await db.execute(`
    SELECT chave, nome, descricao, etapas_json, mapeamentos_json, ativo, atualizado_em
    FROM sgo_configuracoes WHERE chave = ? LIMIT 1
  `, [CHAVE]);
  return linhaParaConfig(rows[0]);
}

function validarEtapas(etapas) {
  if (!Array.isArray(etapas) || !etapas.length || etapas.length > 30) return null;
  const ids = new Set();
  const validas = [];
  for (const etapa of etapas) {
    const id = sanitizeText(etapa.id, 50).replace(/[^a-zA-Z0-9_-]/g, "");
    const tipo = sanitizeText(etapa.tipo, 50);
    if (!id || ids.has(id) || !TIPOS_PERMITIDOS.has(tipo)) return null;
    ids.add(id);
    validas.push({
      id,
      nome: sanitizeText(etapa.nome || tipo, 100),
      tipo,
      entrada: sanitizeText(etapa.entrada || "$input", 500),
      ativo: etapa.ativo !== false
    });
  }
  return validas;
}

function validarMapeamentos(mapeamentos, colunas = COLUNAS) {
  if (!Array.isArray(mapeamentos) || mapeamentos.length > 100) return null;
  const destinos = new Set(colunas.map(coluna => coluna.campo));
  const validos = [];
  for (const item of mapeamentos) {
    const destino = sanitizeText(item.destino, 100);
    const origem = sanitizeText(item.origem, 1000);
    if (!destinos.has(destino) || !origem) return null;
    validos.push({
      destino,
      origem,
      transformacao: ["automatico", "texto", "maiusculo", "minusculo", "numero", "data", "sim_nao"].includes(item.transformacao)
        ? item.transformacao : "automatico",
      regra: ["sempre", "se_vazio", "se_diferente", "nunca"].includes(item.regra) ? item.regra : "sempre"
    });
  }
  return validos;
}

async function obter(req, res) {
  const colunas = await listarColunasControle();
  res.json({
    configuracao: await buscar(),
    tiposConsulta: [...TIPOS_PERMITIDOS],
    colunas: colunas.map(({ campo, titulo, tipo }) => ({ campo, titulo, tipo }))
  });
}

async function salvar(req, res) {
  const colunas = await listarColunasControle();
  const etapas = validarEtapas(req.body?.etapas);
  const mapeamentos = validarMapeamentos(req.body?.mapeamentos, colunas);
  if (!etapas || !mapeamentos) {
    return res.status(400).json({ error: "A configuração possui etapas ou mapeamentos inválidos." });
  }
  const nome = sanitizeText(req.body?.nome || CONFIGURACAO_PADRAO.nome, 150);
  const descricao = sanitizeText(req.body?.descricao, 500);
  await db.execute(`
    INSERT INTO sgo_configuracoes
      (chave, nome, descricao, etapas_json, mapeamentos_json, ativo, atualizado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE nome = VALUES(nome), descricao = VALUES(descricao),
      etapas_json = VALUES(etapas_json), mapeamentos_json = VALUES(mapeamentos_json),
      ativo = VALUES(ativo), atualizado_por = VALUES(atualizado_por)
  `, [
    CHAVE,
    nome,
    descricao || null,
    JSON.stringify(etapas),
    JSON.stringify(mapeamentos),
    req.body?.ativo === false ? 0 : 1,
    req.usuario.id
  ]);
  res.json({ message: "Configuração da automação SGO salva.", configuracao: await buscar() });
}

module.exports = { obter, salvar, CONFIGURACAO_PADRAO };
