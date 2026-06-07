const db = require("../models/db");

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

  const [items] = await db.execute(`
    SELECT msi.quantidade_sol
    FROM materiais_solicitados_items msi
    INNER JOIN materiais_solicitados ms ON ms.id = msi.solicitacao_id
    WHERE msi.id = ? AND ms.regional = ?
    LIMIT 1
  `, [itemId, req.usuario.regional]);

  if (!items[0]) {
    return res.status(404).json({ error: "Material não encontrado na sua regional." });
  }

  if (quantidadeDev > quantidadeLib) {
    return res.status(400).json({ error: "A quantidade devolvida não pode superar a liberada." });
  }

  await db.execute(`
    UPDATE materiais_solicitados_items msi
    INNER JOIN materiais_solicitados ms ON ms.id = msi.solicitacao_id
    SET msi.quantidade_lib = ?, msi.quantidade_dev = ?,
        msi.atualizado_em = CURRENT_TIMESTAMP, msi.atualizado_por = ?
    WHERE msi.id = ? AND ms.regional = ?
  `, [quantidadeLib, quantidadeDev, req.usuario.id, itemId, req.usuario.regional]);

  res.json({
    message: "Quantidades atualizadas.",
    item: { id: itemId, quantidade_lib: quantidadeLib, quantidade_dev: quantidadeDev }
  });
}

async function cancelarSolicitacao(req, res) {
  const solicitacaoId = Number(req.params.id);

  if (!Number.isInteger(solicitacaoId) || solicitacaoId <= 0) {
    return res.status(400).json({ error: "Solicitação inválida." });
  }

  const [rows] = await db.execute(`
    SELECT id, usuario_id, status
    FROM materiais_solicitados
    WHERE id = ? AND regional = ?
    LIMIT 1
  `, [solicitacaoId, req.usuario.regional]);
  const solicitacao = rows[0];

  if (!solicitacao) {
    return res.status(404).json({ error: "Solicitação não encontrada na sua regional." });
  }

  const podeCancelar = ["admin", "almoxarifado", "programacao"]
    .includes(req.usuario.tipo_usuario);

  if (!podeCancelar) {
    return res.status(403).json({ error: "Você não pode cancelar esta solicitação." });
  }

  if (solicitacao.status === "cancelado") {
    return res.json({ message: "A solicitação já está cancelada." });
  }

  await db.execute(`
    UPDATE materiais_solicitados
    SET status = 'cancelado', cancelado_em = CURRENT_TIMESTAMP, cancelado_por = ?
    WHERE id = ? AND regional = ?
  `, [req.usuario.id, solicitacaoId, req.usuario.regional]);

  res.json({ message: "Solicitação cancelada. O histórico foi preservado." });
}

module.exports = { atualizarQuantidades, cancelarSolicitacao };
