const db = require("../models/db");

//crie uma função para listar todas as solicitações da tabela materiais_solicitados_items materiais_solicitados

async function listarSolicitacoes(req, res) {
try {
    const [rows] = await db.query(`
      SELECT 
        ms.id,
        ms.usuario_id,
        ms.projeto,
        ms.cidade,
        ms.equipe,
        ms.tensao_rede,
        ms.data_exe,
        ms.criado_em,
        ms.observacao,
        ms.status,
        ms.tipo_servico,

        msi.id AS item_id,
        msi.solicitacao_id,
        msi.codigo_material,
        msi.descricao_material,
        msi.quantidade_sol,
        msi.quantidade_lib,
        msi.quantidade_dev,
        msi.unidade,
        msi.observacao AS observacao_item

      FROM materiais_solicitados ms

      LEFT JOIN materiais_solicitados_items msi
        ON msi.solicitacao_id = ms.id

      ORDER BY ms.criado_em DESC, ms.id DESC, msi.id ASC
    `);

    res.json(rows);

  } catch (error) {
    console.error("Erro ao listar solicitações:", error);

    res.status(500).json({
      error: "Erro ao listar solicitações"
    });
  }

}

module.exports = listarSolicitacoes;