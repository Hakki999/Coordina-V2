const redshift = require("../../services/bi/redshift");

async function resumo(req, res) {
  try {
    const [producao, metas] = await Promise.all([
      redshift.query(`
        SELECT TO_CHAR(DATE_TRUNC('month', dta_exec_rcb), 'YYYY-MM') AS mes,
          UPPER(TRIM(des_equipe_rcb)) AS equipe, MAX(des_tip_eqp_rcb) AS tipo_equipe,
          SUM(COALESCE(TRY_CAST(NULLIF(TRIM(vlr_total_serv_rcb), '') AS DECIMAL(18, 2)), 0)) AS produzido_total
        FROM res_cubo_servico
        WHERE dta_exec_rcb IS NOT NULL AND des_equipe_rcb IS NOT NULL
          AND UPPER(TRIM(num_cont_rcb)) = 'ANCORA TÉCNICO - MONTES BELOS'
        GROUP BY TO_CHAR(DATE_TRUNC('month', dta_exec_rcb), 'YYYY-MM'), UPPER(TRIM(des_equipe_rcb))
      `),
      redshift.query(`
        SELECT TO_CHAR(DATE_TRUNC('month', dta_meta_msd), 'YYYY-MM') AS mes,
          UPPER(TRIM(des_equipe_cms)) AS equipe,
          SUM(COALESCE(TRY_CAST(NULLIF(TRIM(vlr_meta_msd), '') AS DECIMAL(18, 2)), 0)) AS meta_total
        FROM res_cubo_servico_meta
        WHERE dta_meta_msd IS NOT NULL AND des_equipe_cms IS NOT NULL
          AND DATE_TRUNC('month', dta_meta_msd) <= DATE_TRUNC('month', DATEADD(day, -1, CURRENT_DATE))
          AND UPPER(TRIM(num_cont_cms)) = 'ANCORA TÉCNICO - MONTES BELOS'
        GROUP BY TO_CHAR(DATE_TRUNC('month', dta_meta_msd), 'YYYY-MM'), UPPER(TRIM(des_equipe_cms))
      `)
    ]);

    const mapa = new Map();
    for (const item of producao.rows) {
      mapa.set(`${item.mes}|${item.equipe}`, {
        mes: item.mes,
        equipe: item.equipe || "SEM EQUIPE",
        tipoEquipe: item.tipo_equipe || "SEM TIPO",
        produzidoTotal: Number(item.produzido_total || 0),
        metaTotal: 0
      });
    }
    for (const item of metas.rows) {
      const chave = `${item.mes}|${item.equipe}`;
      const atual = mapa.get(chave) || {
        mes: item.mes, equipe: item.equipe || "SEM EQUIPE", tipoEquipe: "SEM TIPO", produzidoTotal: 0, metaTotal: 0
      };
      atual.metaTotal = Number(item.meta_total || 0);
      mapa.set(chave, atual);
    }

    const meses = new Map();
    for (const item of mapa.values()) {
      const mes = meses.get(item.mes) || { mes: item.mes, produzidoTotal: 0, metaTotal: 0, equipes: [] };
      mes.produzidoTotal += item.produzidoTotal;
      mes.metaTotal += item.metaTotal;
      mes.equipes.push({
        ...item,
        dentroMeta: item.metaTotal > 0 && item.produzidoTotal >= item.metaTotal,
        percentualMeta: item.metaTotal > 0 ? (item.produzidoTotal / item.metaTotal) * 100 : 0
      });
      meses.set(item.mes, mes);
    }
    const dadosBI = [...meses.values()].map(mes => ({
      ...mes,
      dentroMeta: mes.metaTotal > 0 && mes.produzidoTotal >= mes.metaTotal,
      percentualMeta: mes.metaTotal > 0 ? (mes.produzidoTotal / mes.metaTotal) * 100 : 0,
      equipes: mes.equipes.sort((a, b) => b.produzidoTotal - a.produzidoTotal)
    })).sort((a, b) => a.mes.localeCompare(b.mes));
    res.json({ sucesso: true, dadosBI });
  } catch (error) {
    console.error("Erro no BI GPM:", error.message);
    res.status(500).json({ sucesso: false, erro: "Erro ao carregar BI GPM.", detalhe: error.message });
  }
}

module.exports = { resumo };
