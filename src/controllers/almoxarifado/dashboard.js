const db = require("../../models/db");

async function resumo(req, res) {
  const regional = req.usuario.regional;
  const [[totais], [movimentos], [maisMovimentados], [baixoEstoque]] = await Promise.all([
    db.execute(`
      SELECT COUNT(*) AS itens, COALESCE(SUM(quantidade), 0) AS saldo_total,
        SUM(CASE WHEN quantidade <= 0 THEN 1 ELSE 0 END) AS zerados
      FROM estoque_fisico WHERE regional = ?
    `, [regional]),
    db.execute(`
      SELECT DATE_FORMAT(criado_em, '%Y-%m-%d') AS dia, tipo, SUM(quantidade) AS quantidade
      FROM movimentacoes_estoque
      WHERE regional = ? AND criado_em >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
      GROUP BY DATE_FORMAT(criado_em, '%Y-%m-%d'), tipo
      ORDER BY dia
    `, [regional]),
    db.execute(`
      SELECT codigo, descricao,
        SUM(CASE WHEN tipo = 'entrada' THEN quantidade ELSE 0 END) AS entradas,
        SUM(CASE WHEN tipo = 'saida' THEN quantidade ELSE 0 END) AS saidas
      FROM movimentacoes_estoque
      WHERE regional = ? AND criado_em >= DATE_SUB(CURRENT_DATE, INTERVAL 90 DAY)
      GROUP BY codigo, descricao
      ORDER BY (entradas + saidas) DESC LIMIT 15
    `, [regional]),
    db.execute(`
      SELECT codigo, descricao, quantidade, unidade
      FROM estoque_fisico WHERE regional = ?
      ORDER BY quantidade ASC, descricao LIMIT 15
    `, [regional])
  ]);
  res.json({ totais: totais[0] || {}, movimentos, maisMovimentados, baixoEstoque });
}

module.exports = { resumo };
