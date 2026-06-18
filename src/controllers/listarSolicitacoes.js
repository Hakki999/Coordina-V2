const db = require("../models/db");

async function listarSolicitacoes(regional) {
  await db.execute(`
    UPDATE materiais_solicitados
    SET status = 'concluido'
    WHERE regional = ? AND status = 'cancelado'
      AND cancelado_em IS NOT NULL AND data_exe < CURRENT_DATE
  `, [regional]);

  const [rows] = await db.execute(`
    SELECT
      ms.id, ms.usuario_id, ms.regional, ms.projeto, ms.cidade, ms.equipe,
      ms.tensao_rede, ms.data_exe, ms.criado_em, ms.observacao, ms.status,
      ms.cancelado_em, ms.cancelado_por,
      ms.tipo_servico, msi.id AS item_id, msi.solicitacao_id,
      msi.codigo_material, msi.descricao_material, msi.quantidade_sol,
      msi.quantidade_lib, msi.quantidade_dev, msi.unidade,
      msi.observacao AS observacao_item, msi.atualizado_em, msi.atualizado_por
    FROM materiais_solicitados ms
    LEFT JOIN materiais_solicitados_items msi ON msi.solicitacao_id = ms.id
    WHERE ms.regional = ?
    ORDER BY ms.criado_em DESC, ms.id DESC, msi.id ASC
  `, [regional]);

  return rows;
}

module.exports = listarSolicitacoes;
