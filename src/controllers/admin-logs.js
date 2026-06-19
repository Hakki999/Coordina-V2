const db = require("../models/db");
const { sanitizeText } = require("../utils/security");

function inteiroLimitado(valor, padrao, minimo, maximo) {
  const numero = Number(valor);
  if (!Number.isInteger(numero)) return padrao;
  return Math.min(maximo, Math.max(minimo, numero));
}

async function listar(req, res) {
  const pagina = inteiroLimitado(req.query.pagina, 1, 1, 100000);
  const limite = inteiroLimitado(req.query.limite, 100, 25, 300);
  const offset = (pagina - 1) * limite;
  const where = [];
  const params = [];

  const usuario = sanitizeText(req.query.usuario, 100);
  const acao = sanitizeText(req.query.acao, 100);
  const status = sanitizeText(req.query.status, 20);
  const dataInicio = sanitizeText(req.query.dataInicio, 10);
  const dataFim = sanitizeText(req.query.dataFim, 10);

  if (usuario) {
    where.push("(usuario_nome LIKE ? OR CAST(usuario_id AS CHAR) = ?)");
    params.push(`%${usuario}%`, usuario);
  }
  if (acao) {
    where.push("acao = ?");
    params.push(acao);
  }
  if (status === "sucesso" || status === "erro") {
    where.push("sucesso = ?");
    params.push(status === "sucesso" ? 1 : 0);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dataInicio)) {
    where.push("criado_em >= ?");
    params.push(`${dataInicio} 00:00:00`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
    where.push("criado_em < DATE_ADD(?, INTERVAL 1 DAY)");
    params.push(`${dataFim} 00:00:00`);
  }

  const clausula = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [[totalRow], [logs], [acoes]] = await Promise.all([
    db.execute(`SELECT COUNT(*) AS total FROM auditoria_logs ${clausula}`, params),
    db.execute(`
      SELECT id, usuario_id, usuario_nome, tipo_usuario, regional, acao, metodo, rota,
        status_http, sucesso, ip, user_agent, detalhes_json, criado_em
      FROM auditoria_logs
      ${clausula}
      ORDER BY criado_em DESC, id DESC
      LIMIT ${limite} OFFSET ${offset}
    `, params),
    db.execute("SELECT DISTINCT acao FROM auditoria_logs ORDER BY acao")
  ]);

  const total = Number(totalRow[0]?.total || 0);
  res.json({
    logs: logs.map(item => {
      let detalhes = {};
      try { detalhes = JSON.parse(item.detalhes_json || "{}"); } catch {}
      return { ...item, sucesso: Boolean(item.sucesso), detalhes };
    }),
    acoes: acoes.map(item => item.acao),
    paginacao: {
      pagina,
      limite,
      total,
      totalPaginas: Math.max(1, Math.ceil(total / limite))
    }
  });
}

module.exports = { listar };
