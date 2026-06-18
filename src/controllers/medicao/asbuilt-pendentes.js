const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const db = require("../../models/db");
const { sanitizeText } = require("../../utils/security");

const STORAGE_DIR = path.resolve(__dirname, "../../../storage/asbuilt-pendentes");

function idValido(valor) {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function dataValida(valor) {
  const data = String(valor ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const objeto = new Date(`${data}T00:00:00Z`);
  return !Number.isNaN(objeto.getTime()) && objeto.toISOString().slice(0, 10) === data ? data : null;
}

async function listar(req, res) {
  const [rows] = await db.execute(`
    SELECT p.id, p.projeto, p.data_conclusao, p.cidade, p.localizacao,
      p.precisa_ir_campo, p.observacao, p.pdf_nome, p.criado_em,
      DATEDIFF(CURRENT_DATE, p.data_conclusao) AS tempo_finalizado_dias,
      u.nome AS criado_por_nome
    FROM asbuilt_pendentes p
    LEFT JOIN usuarios u ON u.id = p.criado_por
    WHERE p.regional = ?
    ORDER BY p.data_conclusao ASC, p.id DESC
  `, [req.usuario.regional]);
  res.json(rows);
}

async function criar(req, res) {
  const projeto = sanitizeText(req.body?.projeto, 100);
  const dataConclusao = dataValida(req.body?.data_conclusao);
  const cidade = sanitizeText(req.body?.cidade, 150);
  const localizacao = sanitizeText(req.body?.localizacao, 255);
  const observacao = sanitizeText(req.body?.observacao, 4000);
  const precisaIrCampo = req.body?.precisa_ir_campo === true || req.body?.precisa_ir_campo === 1 ? 1 : 0;

  if (!projeto || !dataConclusao) {
    return res.status(400).json({ error: "Projeto e data de conclusão são obrigatórios." });
  }

  try {
    const [result] = await db.execute(`
      INSERT INTO asbuilt_pendentes
        (regional, projeto, data_conclusao, cidade, localizacao, precisa_ir_campo, observacao, criado_por)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      req.usuario.regional,
      projeto,
      dataConclusao,
      cidade || null,
      localizacao || null,
      precisaIrCampo,
      observacao || null,
      req.usuario.id
    ]);
    res.status(201).json({ message: "Projeto pendente adicionado.", id: result.insertId });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Este projeto já está na lista de pendências." });
    }
    throw error;
  }
}

async function excluir(req, res) {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ error: "Projeto inválido." });

  const [rows] = await db.execute(
    "SELECT pdf_arquivo FROM asbuilt_pendentes WHERE id = ? AND regional = ? LIMIT 1",
    [id, req.usuario.regional]
  );
  if (!rows[0]) return res.status(404).json({ error: "Projeto não encontrado." });

  await db.execute("DELETE FROM asbuilt_pendentes WHERE id = ? AND regional = ?", [id, req.usuario.regional]);
  if (rows[0].pdf_arquivo) {
    await fs.unlink(path.join(STORAGE_DIR, rows[0].pdf_arquivo)).catch(() => {});
  }
  res.json({ message: "Projeto removido das pendências." });
}

async function enviarPdf(req, res) {
  const id = idValido(req.params.id);
  let nomeOriginal = sanitizeText(req.get("x-file-name"), 255) || "projeto.pdf";
  try { nomeOriginal = decodeURIComponent(nomeOriginal); } catch {}
  const arquivo = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

  if (!id || !arquivo.length || arquivo.length > 20 * 1024 * 1024 || arquivo.subarray(0, 4).toString() !== "%PDF") {
    return res.status(400).json({ error: "Envie um PDF válido de até 20 MB." });
  }

  const [rows] = await db.execute(
    "SELECT pdf_arquivo FROM asbuilt_pendentes WHERE id = ? AND regional = ? LIMIT 1",
    [id, req.usuario.regional]
  );
  if (!rows[0]) return res.status(404).json({ error: "Projeto não encontrado." });

  await fs.mkdir(STORAGE_DIR, { recursive: true });
  const nomeArquivo = `${req.usuario.regional}-${id}-${crypto.randomBytes(8).toString("hex")}.pdf`;
  await fs.writeFile(path.join(STORAGE_DIR, nomeArquivo), arquivo);
  await db.execute(`
    UPDATE asbuilt_pendentes SET pdf_nome = ?, pdf_arquivo = ?
    WHERE id = ? AND regional = ?
  `, [nomeOriginal, nomeArquivo, id, req.usuario.regional]);

  if (rows[0].pdf_arquivo && rows[0].pdf_arquivo !== nomeArquivo) {
    await fs.unlink(path.join(STORAGE_DIR, rows[0].pdf_arquivo)).catch(() => {});
  }
  res.json({ message: "PDF anexado ao projeto." });
}

async function baixarPdf(req, res) {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ error: "Projeto inválido." });
  const [rows] = await db.execute(`
    SELECT pdf_nome, pdf_arquivo FROM asbuilt_pendentes
    WHERE id = ? AND regional = ? LIMIT 1
  `, [id, req.usuario.regional]);
  const registro = rows[0];
  if (!registro?.pdf_arquivo) return res.status(404).json({ error: "Este projeto não possui PDF." });

  res.download(path.join(STORAGE_DIR, registro.pdf_arquivo), registro.pdf_nome || "projeto.pdf");
}

module.exports = { listar, criar, excluir, enviarPdf, baixarPdf };
