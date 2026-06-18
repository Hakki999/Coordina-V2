const db = require("../models/db");
const { registrarMovimento } = require("./almoxarifado/estoque");

function quantidadeValida(valor) {
  if (valor === null || valor === undefined || valor === "") return false;
  const numero = Number(valor);
  return Number.isFinite(numero) && numero >= 0 && numero <= 99999999.99;
}

async function atualizarQuantidades(req, res) {
  const itemId = Number(req.params.itemId);
  const quantidadeLibOriginal = req.body.quantidade_lib;
  const quantidadeDevOriginal = req.body.quantidade_dev;
  const quantidadeLib = Number(quantidadeLibOriginal);
  const quantidadeDev = Number(quantidadeDevOriginal);

  if (!Number.isInteger(itemId) || itemId <= 0
    || !quantidadeValida(quantidadeLibOriginal) || !quantidadeValida(quantidadeDevOriginal)) {
    return res.status(400).json({ error: "Quantidades inválidas." });
  }

  if (quantidadeDev > quantidadeLib) {
    return res.status(400).json({ error: "A quantidade devolvida não pode superar a liberada." });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [items] = await connection.execute(`
      SELECT msi.quantidade_sol, msi.quantidade_lib, msi.quantidade_dev,
        msi.codigo_material, msi.descricao_material
      FROM materiais_solicitados_items msi
      INNER JOIN materiais_solicitados ms ON ms.id = msi.solicitacao_id
      WHERE msi.id = ? AND ms.regional = ?
      LIMIT 1 FOR UPDATE
    `, [itemId, req.usuario.regional]);
    const item = items[0];
    if (!item) {
      await connection.rollback();
      return res.status(404).json({ error: "Material não encontrado na sua regional." });
    }

    await connection.execute(`
      UPDATE materiais_solicitados_items msi
      INNER JOIN materiais_solicitados ms ON ms.id = msi.solicitacao_id
      SET msi.quantidade_lib = ?, msi.quantidade_dev = ?,
          msi.atualizado_em = CURRENT_TIMESTAMP, msi.atualizado_por = ?
      WHERE msi.id = ? AND ms.regional = ?
    `, [quantidadeLib, quantidadeDev, req.usuario.id, itemId, req.usuario.regional]);

    const diferencaSaldo = -(quantidadeLib - Number(item.quantidade_lib || 0))
      + (quantidadeDev - Number(item.quantidade_dev || 0));
    let saldoEstoque = null;
    if (diferencaSaldo) {
      if (!item.codigo_material) {
        const error = new Error("Este material não possui código para vincular ao estoque físico.");
        error.status = 409;
        throw error;
      }
      const [estoques] = await connection.execute(`
        SELECT id, quantidade, descricao FROM estoque_fisico
        WHERE regional = ? AND codigo = ? LIMIT 1 FOR UPDATE
      `, [req.usuario.regional, item.codigo_material]);
      const estoque = estoques[0];
      if (!estoque) {
        const error = new Error(`Cadastre o código ${item.codigo_material} no estoque físico antes de liberar ou devolver.`);
        error.status = 409;
        throw error;
      }
      const anterior = Number(estoque.quantidade || 0);
      const posterior = anterior + diferencaSaldo;
      if (posterior < 0) {
        const error = new Error(`Saldo insuficiente para ${item.codigo_material}. Disponível: ${anterior}.`);
        error.status = 409;
        throw error;
      }
      await connection.execute(
        "UPDATE estoque_fisico SET quantidade = ?, atualizado_por = ? WHERE id = ?",
        [posterior, req.usuario.id, estoque.id]
      );
      await registrarMovimento(connection, {
        regional: req.usuario.regional,
        estoqueId: estoque.id,
        codigo: item.codigo_material,
        descricao: item.descricao_material || estoque.descricao,
        anterior,
        posterior,
        diferenca: diferencaSaldo,
        origem: "solicitacao_material",
        referenciaId: itemId,
        usuarioId: req.usuario.id
      });
      saldoEstoque = posterior;
    }
    await connection.commit();
    return res.json({
      message: "Quantidades e saldo do estoque atualizados.",
      item: { id: itemId, quantidade_lib: quantidadeLib, quantidade_dev: quantidadeDev },
      saldo_estoque: saldoEstoque
    });
  } catch (error) {
    await connection.rollback();
    if (error.status) return res.status(error.status).json({ error: error.message });
    throw error;
  } finally {
    connection.release();
  }

}

async function cancelarSolicitacao(req, res) {
  const solicitacaoId = Number(req.params.id);

  if (!Number.isInteger(solicitacaoId) || solicitacaoId <= 0) {
    return res.status(400).json({ error: "Solicitação inválida." });
  }

  const [rows] = await db.execute(`
    SELECT id, usuario_id, status, data_exe
    FROM materiais_solicitados
    WHERE id = ? AND regional = ?
    LIMIT 1
  `, [solicitacaoId, req.usuario.regional]);
  const solicitacao = rows[0];

  if (!solicitacao) {
    return res.status(404).json({ error: "Solicitação não encontrada na sua regional." });
  }

  const podeCancelar = req.usuario.permissoes.includes("logistica.solicitacoes.cancelar");

  if (!podeCancelar) {
    return res.status(403).json({ error: "Você não pode cancelar esta solicitação." });
  }

  if (["cancelado", "concluido"].includes(solicitacao.status)) {
    return res.json({ message: "A solicitação já está encerrada.", status: solicitacao.status });
  }

  await db.execute(`
    UPDATE materiais_solicitados
    SET status = IF(data_exe < CURRENT_DATE, 'concluido', 'cancelado'),
      cancelado_em = CURRENT_TIMESTAMP, cancelado_por = ?
    WHERE id = ? AND regional = ?
  `, [req.usuario.id, solicitacaoId, req.usuario.regional]);
  const [[atualizada]] = await db.execute(
    "SELECT status FROM materiais_solicitados WHERE id = ? AND regional = ? LIMIT 1",
    [solicitacaoId, req.usuario.regional]
  );
  const statusFinal = atualizada.status;

  res.json({
    message: statusFinal === "concluido"
      ? "Solicitação cancelada após a execução e marcada como concluída."
      : "Solicitação cancelada. O histórico foi preservado.",
    status: statusFinal
  });
}

module.exports = { atualizarQuantidades, cancelarSolicitacao };
