const ExcelJS = require("exceljs");
const db = require("../models/db");
const { COLUNAS, listarColunasControle, anexarValoresCustomizados } = require("./controle-asbuilt");

const AZUL = "1D4ED8";
const AZUL_CLARO = "DBEAFE";
const BRANCO = "FFFFFF";
const CINZA = "F8FAFC";

async function exportarControleAsbuilt(req, res) {
  const colunas = await listarColunasControle();
  const campos = COLUNAS.map(coluna => coluna.campo).join(", ");
  const [registros] = await db.execute(`
    SELECT id, ${campos}
    FROM controle_asbuilt
    WHERE regional = ?
    ORDER BY criado_em DESC, id DESC
  `, [req.usuario.regional]);
  await anexarValoresCustomizados(registros, colunas);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Coordina";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Controle As-Built");

  sheet.columns = colunas.map(coluna => ({
    header: coluna.titulo,
    key: coluna.campo,
    width: Math.max(12, Math.round(coluna.largura / 8))
  }));
  sheet.views = [{ state: "frozen", ySplit: 1, xSplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, registros.length + 1), column: colunas.length }
  };

  const cabecalho = sheet.getRow(1);
  cabecalho.height = 28;
  cabecalho.eachCell(cell => {
    cell.font = { bold: true, color: { argb: BRANCO } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: "1E3A8A" } } };
  });

  registros.forEach((registro, index) => {
    const row = sheet.addRow(registro);
    row.height = 22;
    row.eachCell(cell => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: index % 2 ? CINZA : BRANCO }
      };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.border = { bottom: { style: "hair", color: { argb: AZUL_CLARO } } };
    });
  });

  colunas.filter(coluna => coluna.tipo === "data").forEach(coluna => {
    sheet.getColumn(coluna.campo).numFmt = "dd/mm/yyyy";
  });
  colunas.filter(coluna => coluna.tipo === "moeda").forEach(coluna => {
    sheet.getColumn(coluna.campo).numFmt = 'R$ #,##0.00;[Red]-R$ #,##0.00';
  });

  const nome = `controle-asbuilt-${req.usuario.regional}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.set({
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${nome}"`,
    "Cache-Control": "no-store"
  });
  await workbook.xlsx.write(res);
  res.end();
}

module.exports = exportarControleAsbuilt;
