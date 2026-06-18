const ExcelJS = require("exceljs");
const db = require("../models/db");

const TIPOS = new Set(["completo", "pedidos", "materiais"]);
const AZUL = "1D4ED8";
const AZUL_CLARO = "DBEAFE";
const CINZA = "F1F5F9";
const BRANCO = "FFFFFF";

function formatarPlanilha(sheet, titulo, subtitulo, colunas, linhas) {
  sheet.views = [{ state: "frozen", ySplit: 4 }];
  sheet.mergeCells(1, 1, 1, colunas.length);
  sheet.getCell("A1").value = titulo;
  sheet.getCell("A1").font = { bold: true, size: 18, color: { argb: BRANCO } };
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  sheet.getCell("A1").alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 34;

  sheet.mergeCells(2, 1, 2, colunas.length);
  sheet.getCell("A2").value = subtitulo;
  sheet.getCell("A2").font = { italic: true, color: { argb: "475569" } };
  sheet.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL_CLARO } };
  sheet.getRow(2).height = 24;

  sheet.columns = colunas.map(coluna => ({
    key: coluna.key,
    width: coluna.width || 18
  }));

  const cabecalho = sheet.getRow(4);
  cabecalho.values = colunas.map(coluna => coluna.header);
  cabecalho.height = 25;
  cabecalho.eachCell(cell => {
    cell.font = { bold: true, color: { argb: BRANCO } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: "1E3A8A" } } };
  });

  linhas.forEach((linha, index) => {
    const row = sheet.addRow(linha);
    row.height = 21;
    row.eachCell(cell => {
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: index % 2 === 0 ? BRANCO : CINZA }
      };
      cell.border = { bottom: { style: "hair", color: { argb: "CBD5E1" } } };
    });
  });

  sheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: Math.max(4, linhas.length + 4), column: colunas.length }
  };
  sheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
    margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }
  };
}

function dataExcel(valor) {
  return valor ? new Date(valor) : "";
}

async function buscarDados(regional) {
  const [pedidos] = await db.execute(`
    SELECT ms.id, ms.regional, u.nome AS solicitante, ms.projeto, ms.cidade, ms.equipe,
      ms.tensao_rede, ms.data_exe, ms.tipo_servico, ms.status, ms.observacao,
      ms.criado_em, ms.cancelado_em, COUNT(msi.id) AS total_itens,
      COALESCE(SUM(msi.quantidade_sol), 0) AS total_solicitado,
      COALESCE(SUM(msi.quantidade_lib), 0) AS total_liberado,
      COALESCE(SUM(msi.quantidade_dev), 0) AS total_devolvido
    FROM materiais_solicitados ms
    LEFT JOIN usuarios u ON u.id = ms.usuario_id
    LEFT JOIN materiais_solicitados_items msi ON msi.solicitacao_id = ms.id
    WHERE ms.regional = ?
    GROUP BY ms.id, ms.regional, u.nome, ms.projeto, ms.cidade, ms.equipe,
      ms.tensao_rede, ms.data_exe, ms.tipo_servico, ms.status, ms.observacao,
      ms.criado_em, ms.cancelado_em
    ORDER BY ms.criado_em DESC, ms.id DESC
  `, [regional]);

  const [materiais] = await db.execute(`
    SELECT ms.id AS solicitacao_id, ms.regional, u.nome AS solicitante, ms.projeto,
      ms.cidade, ms.equipe, ms.data_exe, ms.tipo_servico, ms.status,
      msi.codigo_material, msi.descricao_material, msi.unidade,
      msi.quantidade_sol, msi.quantidade_lib, msi.quantidade_dev,
      msi.observacao AS observacao_item, msi.atualizado_em
    FROM materiais_solicitados ms
    LEFT JOIN usuarios u ON u.id = ms.usuario_id
    INNER JOIN materiais_solicitados_items msi ON msi.solicitacao_id = ms.id
    WHERE ms.regional = ?
    ORDER BY ms.criado_em DESC, ms.id DESC, msi.id ASC
  `, [regional]);

  return { pedidos, materiais };
}

function adicionarPedidos(workbook, pedidos, regional) {
  const sheet = workbook.addWorksheet("Pedidos");
  const colunas = [
    { header: "Pedido", key: "id", width: 11 },
    { header: "Regional", key: "regional", width: 11 },
    { header: "Solicitante", key: "solicitante", width: 24 },
    { header: "Projeto", key: "projeto", width: 24 },
    { header: "Cidade", key: "cidade", width: 20 },
    { header: "Equipe", key: "equipe", width: 16 },
    { header: "Execução", key: "data_exe", width: 14 },
    { header: "Tipo", key: "tipo_servico", width: 18 },
    { header: "Status", key: "status", width: 14 },
    { header: "Itens", key: "total_itens", width: 10 },
    { header: "Solicitado", key: "total_solicitado", width: 14 },
    { header: "Liberado", key: "total_liberado", width: 14 },
    { header: "Devolvido", key: "total_devolvido", width: 14 },
    { header: "Criado em", key: "criado_em", width: 18 },
    { header: "Observação", key: "observacao", width: 36 }
  ];
  const linhas = pedidos.map(p => ({
    ...p,
    id: `#${p.id}`,
    data_exe: dataExcel(p.data_exe),
    criado_em: dataExcel(p.criado_em),
    total_itens: Number(p.total_itens),
    total_solicitado: Number(p.total_solicitado),
    total_liberado: Number(p.total_liberado),
    total_devolvido: Number(p.total_devolvido)
  }));
  formatarPlanilha(sheet, "Relatório de pedidos", `Regional ${regional} • ${pedidos.length} pedidos`, colunas, linhas);
  sheet.getColumn("data_exe").numFmt = "dd/mm/yyyy";
  sheet.getColumn("criado_em").numFmt = "dd/mm/yyyy hh:mm";
  ["total_solicitado", "total_liberado", "total_devolvido"].forEach(key => {
    sheet.getColumn(key).numFmt = "#,##0.00";
  });
}

function adicionarMateriais(workbook, materiais, regional) {
  const sheet = workbook.addWorksheet("Materiais detalhados");
  const colunas = [
    { header: "Pedido", key: "solicitacao_id", width: 11 },
    { header: "Regional", key: "regional", width: 11 },
    { header: "Projeto", key: "projeto", width: 24 },
    { header: "Cidade", key: "cidade", width: 19 },
    { header: "Equipe", key: "equipe", width: 15 },
    { header: "Solicitante", key: "solicitante", width: 23 },
    { header: "Código", key: "codigo_material", width: 17 },
    { header: "Descrição do material", key: "descricao_material", width: 42 },
    { header: "Unidade", key: "unidade", width: 12 },
    { header: "Solicitada", key: "quantidade_sol", width: 14 },
    { header: "Liberada", key: "quantidade_lib", width: 14 },
    { header: "Devolvida", key: "quantidade_dev", width: 14 },
    { header: "Status", key: "status", width: 14 },
    { header: "Execução", key: "data_exe", width: 14 },
    { header: "Atualizado em", key: "atualizado_em", width: 18 },
    { header: "Observação do item", key: "observacao_item", width: 32 }
  ];
  const linhas = materiais.map(m => ({
    ...m,
    solicitacao_id: `#${m.solicitacao_id}`,
    quantidade_sol: Number(m.quantidade_sol),
    quantidade_lib: Number(m.quantidade_lib),
    quantidade_dev: Number(m.quantidade_dev),
    data_exe: dataExcel(m.data_exe),
    atualizado_em: dataExcel(m.atualizado_em)
  }));
  formatarPlanilha(sheet, "Materiais solicitados • linha a linha", `Regional ${regional} • ${materiais.length} materiais`, colunas, linhas);
  sheet.getColumn("data_exe").numFmt = "dd/mm/yyyy";
  sheet.getColumn("atualizado_em").numFmt = "dd/mm/yyyy hh:mm";
  ["quantidade_sol", "quantidade_lib", "quantidade_dev"].forEach(key => {
    sheet.getColumn(key).numFmt = "#,##0.00";
  });
}

function adicionarResumo(workbook, pedidos, materiais, regional) {
  const sheet = workbook.addWorksheet("Resumo");
  sheet.columns = [{ width: 34 }, { width: 22 }];
  sheet.mergeCells("A1:B1");
  sheet.getCell("A1").value = "Resumo operacional";
  sheet.getCell("A1").font = { bold: true, size: 20, color: { argb: BRANCO } };
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  sheet.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
  sheet.getRow(1).height = 38;

  const metricas = [
    ["Regional", regional],
    ["Gerado em", new Date()],
    ["Total de pedidos", pedidos.length],
    ["Pedidos pendentes", pedidos.filter(p => p.status === "pendente").length],
    ["Pedidos cancelados", pedidos.filter(p => p.status === "cancelado").length],
    ["Materiais detalhados", materiais.length],
    ["Quantidade solicitada", materiais.reduce((s, m) => s + Number(m.quantidade_sol), 0)],
    ["Quantidade liberada", materiais.reduce((s, m) => s + Number(m.quantidade_lib), 0)],
    ["Quantidade devolvida", materiais.reduce((s, m) => s + Number(m.quantidade_dev), 0)]
  ];

  metricas.forEach((metrica, index) => {
    const row = sheet.addRow(metrica);
    row.height = 26;
    row.getCell(1).font = { bold: true, color: { argb: "334155" } };
    row.eachCell(cell => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: index % 2 ? CINZA : BRANCO } };
      cell.border = { bottom: { style: "thin", color: { argb: "CBD5E1" } } };
      cell.alignment = { vertical: "middle" };
    });
  });
  sheet.getCell("B3").numFmt = "dd/mm/yyyy hh:mm";
  ["B8", "B9", "B10"].forEach(celula => { sheet.getCell(celula).numFmt = "#,##0.00"; });
}

async function exportarSolicitacoes(req, res) {
  const tipo = String(req.query.tipo || "completo").toLowerCase();
  if (!TIPOS.has(tipo)) return res.status(400).json({ error: "Tipo de exportação inválido." });

  const { pedidos, materiais } = await buscarDados(req.usuario.regional);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Coordina";
  workbook.created = new Date();

  if (tipo === "completo") adicionarResumo(workbook, pedidos, materiais, req.usuario.regional);
  if (tipo === "completo" || tipo === "pedidos") adicionarPedidos(workbook, pedidos, req.usuario.regional);
  if (tipo === "completo" || tipo === "materiais") adicionarMateriais(workbook, materiais, req.usuario.regional);

  const nome = `controle-materiais-${tipo}-${req.usuario.regional}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.set({
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${nome}"`,
    "Cache-Control": "no-store"
  });
  await workbook.xlsx.write(res);
  res.end();
}

module.exports = exportarSolicitacoes;
