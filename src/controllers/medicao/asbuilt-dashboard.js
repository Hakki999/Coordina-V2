const db = require("../../models/db");
const { sanitizeText } = require("../../utils/security");
const { listarColunasControle, colunaFisica } = require("../controle-asbuilt");

const PESSOA_SQL = "COALESCE(NULLIF(TRIM(a.projetista), ''), NULLIF(TRIM(a.responsavel), ''), 'Sem responsavel')";
const OPERADORES = new Set(["contem", "igual", "vazio", "preenchido", "maior_igual", "menor_igual"]);

function parseFiltros(valor) {
  if (!valor) return [];
  try {
    const filtros = JSON.parse(String(valor));
    return Array.isArray(filtros) ? filtros.slice(0, 15) : [];
  } catch {
    return [];
  }
}

function montarFiltroCustomizado(coluna, operador, valor, params) {
  if (operador === "vazio") {
    params.push(coluna.campo);
    return `NOT EXISTS (
      SELECT 1 FROM controle_asbuilt_valores vf
      INNER JOIN controle_asbuilt_colunas cf ON cf.id = vf.coluna_id
      WHERE vf.registro_id = a.id AND cf.campo = ? AND NULLIF(TRIM(vf.valor_texto), '') IS NOT NULL
    )`;
  }
  params.push(coluna.campo);
  if (operador === "preenchido") {
    return `EXISTS (
      SELECT 1 FROM controle_asbuilt_valores vf
      INNER JOIN controle_asbuilt_colunas cf ON cf.id = vf.coluna_id
      WHERE vf.registro_id = a.id AND cf.campo = ? AND NULLIF(TRIM(vf.valor_texto), '') IS NOT NULL
    )`;
  }
  const comparador = operador === "igual" ? "=" : operador === "maior_igual" ? ">=" : operador === "menor_igual" ? "<=" : "LIKE";
  params.push(comparador === "LIKE" ? `%${valor}%` : valor);
  return `EXISTS (
    SELECT 1 FROM controle_asbuilt_valores vf
    INNER JOIN controle_asbuilt_colunas cf ON cf.id = vf.coluna_id
    WHERE vf.registro_id = a.id AND cf.campo = ? AND vf.valor_texto ${comparador} ?
  )`;
}

function montarWhere(regional, filtros, porCampo) {
  const where = ["a.regional = ?"];
  const params = [regional];
  for (const filtro of filtros) {
    const coluna = porCampo.get(String(filtro?.campo || ""));
    const operador = OPERADORES.has(filtro?.operador) ? filtro.operador : "contem";
    const valor = sanitizeText(filtro?.valor, 255);
    if (!coluna || (!valor && !["vazio", "preenchido"].includes(operador))) continue;
    if (!colunaFisica(coluna)) {
      where.push(montarFiltroCustomizado(coluna, operador, valor, params));
      continue;
    }
    const expressao = `a.${coluna.campo}`;
    if (operador === "vazio") where.push(`NULLIF(TRIM(CAST(${expressao} AS CHAR)), '') IS NULL`);
    else if (operador === "preenchido") where.push(`NULLIF(TRIM(CAST(${expressao} AS CHAR)), '') IS NOT NULL`);
    else if (operador === "igual") {
      where.push(`${expressao} = ?`);
      params.push(valor);
    } else if (operador === "maior_igual" || operador === "menor_igual") {
      where.push(`${expressao} ${operador === "maior_igual" ? ">=" : "<="} ?`);
      params.push(valor);
    } else {
      where.push(`CAST(${expressao} AS CHAR) LIKE ?`);
      params.push(`%${valor}%`);
    }
  }
  return { sql: where.join(" AND "), params };
}

async function resumo(req, res) {
  const regional = req.usuario.regional;
  const colunas = await listarColunasControle();
  const porCampo = new Map(colunas.map(coluna => [coluna.campo, coluna]));
  const filtros = parseFiltros(req.query.filtros);
  const where = montarWhere(regional, filtros, porCampo);

  const executar = sql => db.execute(sql, [...where.params]);
  const [[totais], [colaboradores], [statusSap], [statusSgo], [evolucao]] = await Promise.all([
    executar(`
      SELECT COUNT(*) AS total,
        SUM(CASE WHEN a.data_asbuilt IS NOT NULL THEN 1 ELSE 0 END) AS concluidos,
        SUM(CASE WHEN a.data_asbuilt IS NULL THEN 1 ELSE 0 END) AS pendentes,
        COALESCE(SUM(a.valor), 0) AS valor_total,
        COALESCE(SUM(a.este_mes), 0) AS valor_mes
      FROM controle_asbuilt a WHERE ${where.sql}
    `),
    executar(`
      SELECT ${PESSOA_SQL} AS colaborador,
        COUNT(*) AS quantidade,
        SUM(CASE WHEN a.data_asbuilt IS NOT NULL THEN 1 ELSE 0 END) AS concluidos,
        SUM(CASE WHEN a.data_asbuilt >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01') THEN 1 ELSE 0 END) AS concluidos_mes,
        COALESCE(SUM(a.valor), 0) AS valor
      FROM controle_asbuilt a
      WHERE ${where.sql}
      GROUP BY colaborador
      ORDER BY concluidos DESC, quantidade DESC
      LIMIT 100
    `),
    executar(`
      SELECT COALESCE(NULLIF(TRIM(a.status_sap), ''), 'Sem status') AS status,
        COUNT(*) AS quantidade, COALESCE(SUM(a.valor), 0) AS valor
      FROM controle_asbuilt a WHERE ${where.sql}
      GROUP BY COALESCE(NULLIF(TRIM(a.status_sap), ''), 'Sem status') ORDER BY quantidade DESC
    `),
    executar(`
      SELECT COALESCE(NULLIF(TRIM(a.status_sgo), ''), 'Sem status') AS status,
        COUNT(*) AS quantidade, COALESCE(SUM(a.valor), 0) AS valor
      FROM controle_asbuilt a WHERE ${where.sql}
      GROUP BY COALESCE(NULLIF(TRIM(a.status_sgo), ''), 'Sem status') ORDER BY quantidade DESC
    `),
    executar(`
      SELECT DATE_FORMAT(a.data_asbuilt, '%Y-%m') AS mes, COUNT(*) AS quantidade,
        COALESCE(SUM(a.valor), 0) AS valor
      FROM controle_asbuilt a
      WHERE ${where.sql} AND a.data_asbuilt IS NOT NULL
      GROUP BY DATE_FORMAT(a.data_asbuilt, '%Y-%m')
      ORDER BY mes DESC LIMIT 12
    `)
  ]);

  const solicitada = sanitizeText(req.query.pessoa, 150);
  const pessoa = colaboradores.find(item => item.colaborador === solicitada)?.colaborador
    || colaboradores[0]?.colaborador
    || "";
  let individual = null;
  if (pessoa) {
    const paramsPessoa = [...where.params, pessoa];
    const [[metricas], [recentes], [mensal]] = await Promise.all([
      db.execute(`
        SELECT COUNT(*) AS total,
          SUM(CASE WHEN a.data_asbuilt IS NOT NULL THEN 1 ELSE 0 END) AS concluidos,
          SUM(CASE WHEN a.data_asbuilt IS NULL THEN 1 ELSE 0 END) AS pendentes,
          SUM(CASE WHEN a.data_asbuilt >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01') THEN 1 ELSE 0 END) AS concluidos_mes,
          COALESCE(SUM(a.valor), 0) AS valor
        FROM controle_asbuilt a
        WHERE ${where.sql} AND ${PESSOA_SQL} = ?
      `, paramsPessoa),
      db.execute(`
        SELECT a.id, a.projeto, a.nome, a.status, a.status_sap, a.status_sgo, a.data_asbuilt, a.criado_em
        FROM controle_asbuilt a
        WHERE ${where.sql} AND ${PESSOA_SQL} = ?
        ORDER BY a.criado_em DESC, a.id DESC LIMIT 20
      `, paramsPessoa),
      db.execute(`
        SELECT DATE_FORMAT(a.data_asbuilt, '%Y-%m') AS mes, COUNT(*) AS quantidade
        FROM controle_asbuilt a
        WHERE ${where.sql} AND ${PESSOA_SQL} = ? AND a.data_asbuilt IS NOT NULL
        GROUP BY DATE_FORMAT(a.data_asbuilt, '%Y-%m')
        ORDER BY mes DESC LIMIT 12
      `, paramsPessoa)
    ]);
    individual = { pessoa, metricas: metricas[0] || {}, recentes, mensal: mensal.reverse() };
  }

  res.json({
    totais: totais[0] || {},
    colaboradores,
    statusSap,
    statusSgo,
    evolucao: evolucao.reverse(),
    individual,
    filtrosDisponiveis: colunas.map(({ campo, titulo, tipo, opcoes }) => ({ campo, titulo, tipo, opcoes }))
  });
}

module.exports = { resumo };
