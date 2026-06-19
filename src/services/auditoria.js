const db = require("../models/db");

const CAMPOS_SENSIVEIS = new Set([
  "senha", "senha_atual", "nova_senha", "password", "token", "authorization", "cookie"
]);

function limitarTexto(valor, limite = 500) {
  return String(valor ?? "").slice(0, limite);
}

function sanitizarDetalhes(valor, profundidade = 0) {
  if (profundidade > 5) return "[limite de profundidade]";
  if (valor === null || valor === undefined) return valor;
  if (Buffer.isBuffer(valor)) return `[arquivo binario: ${valor.length} bytes]`;
  if (Array.isArray(valor)) return valor.slice(0, 50).map(item => sanitizarDetalhes(item, profundidade + 1));
  if (typeof valor !== "object") return typeof valor === "string" ? limitarTexto(valor, 1000) : valor;

  const resultado = {};
  for (const [chave, item] of Object.entries(valor).slice(0, 80)) {
    resultado[chave] = CAMPOS_SENSIVEIS.has(chave.toLowerCase())
      ? "[protegido]"
      : sanitizarDetalhes(item, profundidade + 1);
  }
  return resultado;
}

function acaoDaRequisicao(req) {
  if (req.auditoriaAcao) return limitarTexto(req.auditoriaAcao, 100);
  const caminho = req.route?.path || req.path || req.originalUrl || "";
  const chave = `${req.method} ${caminho}`;
  const regras = [
    [/^POST \/login$/, "LOGIN"],
    [/^POST \/logout$/, "LOGOUT"],
    [/^PUT \/api\/minha-senha$/, "ALTERAR_SENHA"],
    [/^POST \/api\/solicitacoes$/, "CRIAR_SOLICITACAO"],
    [/^GET \/api\/solicitacoes-exportar$/, "EXPORTAR_SOLICITACOES"],
    [/^PUT \/api\/solicitacoes\/itens/, "OPERAR_SOLICITACAO"],
    [/^PATCH \/api\/solicitacoes/, "CANCELAR_SOLICITACAO"],
    [/^PUT \/api\/materiais$/, "ATUALIZAR_CATALOGO"],
    [/^POST \/api\/controle-asbuilt$/, "CRIAR_ASBUILT"],
    [/^GET \/api\/controle-asbuilt\/exportar$/, "EXPORTAR_ASBUILT"],
    [/^GET \/api\/controle-asbuilt\/:id\/pdf$/, "BAIXAR_PDF_ASBUILT"],
    [/^PUT \/api\/controle-asbuilt\/atualizar-colunas$/, "ATUALIZAR_ASBUILT_EM_MASSA"],
    [/^PUT \/api\/controle-asbuilt\/:id\/dados$/, "ATUALIZAR_ASBUILT_SGO"],
    [/^PUT \/api\/controle-asbuilt\/:id$/, "ATUALIZAR_ASBUILT"],
    [/^DELETE \/api\/controle-asbuilt\/:id$/, "EXCLUIR_ASBUILT"],
    [/^POST \/api\/controle-asbuilt\/colunas$/, "CRIAR_COLUNA_ASBUILT"],
    [/^PUT \/api\/controle-asbuilt\/colunas/, "ATUALIZAR_COLUNA_ASBUILT"],
    [/^DELETE \/api\/controle-asbuilt\/colunas/, "EXCLUIR_COLUNA_ASBUILT"],
    [/^POST \/api\/controle-asbuilt\/importar\/executar$/, "IMPORTAR_ASBUILT"],
    [/^POST \/api\/asbuilt-pendentes$/, "CRIAR_ASBUILT_PENDENTE"],
    [/^PUT \/api\/asbuilt-pendentes/, "ENVIAR_PDF_ASBUILT"],
    [/^DELETE \/api\/asbuilt-pendentes/, "EXCLUIR_ASBUILT_PENDENTE"],
    [/^PUT \/api\/admin\/sgo\/config$/, "CONFIGURAR_SGO"],
    [/^PUT \/api\/almoxarifado\/estoque$/, "ATUALIZAR_ESTOQUE"],
    [/^POST \/api\/almoxarifado\/estoque\/importar$/, "IMPORTAR_ESTOQUE"],
    [/^POST \/api\/usuarios$/, "CRIAR_USUARIO"],
    [/^PUT \/api\/usuarios/, "ATUALIZAR_USUARIO"],
    [/^DELETE \/api\/usuarios/, "EXCLUIR_USUARIO"],
    [/^POST \/api\/admin\/perfis$/, "CRIAR_PERFIL"],
    [/^PUT \/api\/admin\/perfis/, "ATUALIZAR_PERFIL"],
    [/^DELETE \/api\/admin\/perfis/, "EXCLUIR_PERFIL"],
    [/^POST \/api\/admin\/regionais$/, "CRIAR_REGIONAL"],
    [/^DELETE \/api\/admin\/regionais/, "EXCLUIR_REGIONAL"]
  ];
  return regras.find(([padrao]) => padrao.test(chave))?.[1]
    || (req.method === "GET" ? "ACESSAR_PAGINA" : `${req.method}_${limitarTexto(caminho, 70)}`);
}

function deveAuditar(req) {
  if (req.method === "OPTIONS" || req.path === "/api/admin/logs") return false;
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return true;
  if (req.method !== "GET") return false;
  if (/\/exportar(?:$|\/)|\/pdf$/.test(req.path)) return true;
  return !req.path.startsWith("/api/") && req.path !== "/perfil";
}

async function registrarAuditoria({
  usuario,
  acao,
  metodo,
  rota,
  statusHttp,
  ip,
  userAgent,
  detalhes
}) {
  await db.execute(`
    INSERT INTO auditoria_logs
      (usuario_id, usuario_nome, tipo_usuario, regional, acao, metodo, rota,
       status_http, sucesso, ip, user_agent, detalhes_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    usuario?.id || null,
    limitarTexto(usuario?.nome || "Nao identificado", 100),
    limitarTexto(usuario?.tipo_usuario || "", 50) || null,
    limitarTexto(usuario?.regional || "", 20) || null,
    limitarTexto(acao, 100),
    limitarTexto(metodo, 10),
    limitarTexto(rota, 255),
    Number(statusHttp) || 0,
    Number(statusHttp) >= 200 && Number(statusHttp) < 400 ? 1 : 0,
    limitarTexto(ip, 64) || null,
    limitarTexto(userAgent, 500) || null,
    JSON.stringify(sanitizarDetalhes(detalhes))
  ]);
}

module.exports = {
  sanitizarDetalhes,
  acaoDaRequisicao,
  deveAuditar,
  registrarAuditoria
};
