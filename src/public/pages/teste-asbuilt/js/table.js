(function (root) {
  "use strict";

  let hot = null;

  function destroyTable() {
    if (hot) {
      hot.destroy();
      hot = null;
    }
  }

  function renderTable(rows) {
    destroyTable();

    const data = Array.isArray(rows) ? rows : [];
    const columns = Array.from(new Set(data.flatMap(row => Object.keys(row || {}))));

    if (!data.length || !columns.length) {
      throw new Error("Não foi possível identificar linhas e colunas válidas.");
    }

    hot = new Handsontable(document.getElementById("excel"), {
      data,
      columns: columns.map(column => ({ data: column })),
      colHeaders: columns,
      rowHeaders: true,
      filters: true,
      dropdownMenu: true,
      columnSorting: true,
      contextMenu: true,
      stretchH: "all",
      height: 650,
      width: "100%",
      manualColumnResize: true,
      manualRowResize: true,
      readOnly: false,
      licenseKey: "non-commercial-and-evaluation"
    });

    document.querySelector("#tableBadge").textContent = `${data.length} linha(s)`;
    return data;
  }

  function parseCsv(text) {
    const cleaned = String(text || "")
      .replace(/TIPO "([^"]+)"/g, 'TIPO ""$1""')
      .trim();

    if (!cleaned) throw new Error("Cole algum conteúdo ou selecione um arquivo.");

    const result = Papa.parse(cleaned, {
      header: true,
      skipEmptyLines: "greedy",
      delimiter: "",
      quoteChar: '"',
      escapeChar: '"',
      transformHeader: header => String(header || "").trim()
    });

    if (!result.data.length || !(result.meta.fields || []).length) {
      throw new Error("Não foi possível converter o conteúdo em tabela.");
    }

    if (result.errors.length) {
      console.warn("Avisos durante a leitura do CSV:", result.errors);
    }

    return result.data;
  }

  function sheetToRows(workbook, preferredSheetName) {
    const sheetName = preferredSheetName && workbook.Sheets[preferredSheetName]
      ? preferredSheetName
      : workbook.SheetNames[0];

    if (!sheetName) throw new Error("O arquivo Excel não possui abas legíveis.");

    return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      defval: "",
      raw: false
    });
  }

  async function parseFile(file) {
    if (!file) throw new Error("Selecione um arquivo.");

    const extension = file.name.split(".").pop().toLowerCase();

    if (extension === "csv" || extension === "txt") {
      return parseCsv(await file.text());
    }

    if (extension === "xlsx" || extension === "xls") {
      const buffer = await file.arrayBuffer();
      return sheetToRows(XLSX.read(buffer, { type: "array" }));
    }

    throw new Error("Formato não suportado. Use CSV, TXT, XLSX ou XLS.");
  }

  function getRows() {
    return hot ? hot.getSourceData() : null;
  }

  root.DataTable = {
    destroyTable,
    getRows,
    parseCsv,
    parseFile,
    renderTable,
    sheetToRows
  };
})(window);
