(function () {
  "use strict";

  const state = {
    step: 1,
    materials: null,
    services: null,
    catalog: Array.isArray(window.CADERNO_EQTL) ? window.CADERNO_EQTL : [],
    result: null
  };

  const elements = {
    csvText: document.querySelector("#csvText"),
    dataFile: document.querySelector("#dataFile"),
    dataFileStatus: document.querySelector("#dataFileStatus"),
    catalogFile: document.querySelector("#catalogFile"),
    catalogStatus: document.querySelector("#catalogStatus"),
    catalogHeroStatus: document.querySelector("#catalogHeroStatus"),
    importButton: document.querySelector("#importButton"),
    nextStep: document.querySelector("#nextStep"),
    resetButton: document.querySelector("#resetButton"),
    messageBox: document.querySelector("#messageBox"),
    resultsPanel: document.querySelector("#resultsPanel"),
    comparisonSummary: document.querySelector("#comparisonSummary"),
    inputTitle: document.querySelector("#inputTitle"),
    inputDescription: document.querySelector("#inputDescription"),
    currentStepText: document.querySelector("#currentStepText"),
    currentStepDesc: document.querySelector("#currentStepDesc"),
    workflowItems: document.querySelectorAll(".workflow-item"),
    tablePanel: document.querySelector(".table-panel"),
    inputPanel: document.querySelector(".input-panel")
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function displayPoint(point) {
    if (!point || point === "GERAL") return "Geral";
    if (point === "__GLOBAL__") return "Global (coluna de ponto não reconhecida)";
    return point;
  }

  function showMessage(type, title, text) {
    const icons = { info: "i", success: "✓", warning: "!", danger: "×" };

    elements.messageBox.className = `message ${type}`;
    elements.messageBox.innerHTML = `
      <div class="message-icon">${icons[type] || "i"}</div>
      <div>
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(text)}</span>
      </div>
    `;
  }

  function updateCatalogStatus() {
    const count = state.catalog.length;
    elements.catalogHeroStatus.textContent = count
      ? `${count} itens carregados`
      : "Nenhum catálogo carregado";
    elements.catalogStatus.textContent = count
      ? `${count} itens disponíveis para validar códigos, unidades, cadernos e cabos.`
      : "Carregue o arquivo do caderno EQTL para validar serviços.";
  }

  function updateStep() {
    elements.workflowItems.forEach((item, index) => {
      item.classList.toggle("completed", index + 1 < state.step);
      item.classList.toggle("active", index + 1 === state.step);
    });

    if (state.step === 1) {
      elements.currentStepText.textContent = "1 de 2";
      elements.currentStepDesc.textContent = "Importe materiais / UP por Barramento";
      elements.inputTitle.textContent = "Importar materiais / UP por Barramento";
      elements.inputDescription.textContent = "Cole o CSV ou selecione o arquivo com materiais e pontos.";
      elements.nextStep.textContent = "Salvar materiais e continuar";
    } else if (state.step === 2) {
      elements.currentStepText.textContent = "2 de 2";
      elements.currentStepDesc.textContent = "Importe serviços / Medição Única";
      elements.inputTitle.textContent = "Importar serviços / Medição Única";
      elements.inputDescription.textContent = "Cole o CSV ou selecione o arquivo com os serviços do As Built.";
      elements.nextStep.textContent = "Salvar serviços e analisar";
    } else {
      elements.currentStepText.textContent = "Finalizado";
      elements.currentStepDesc.textContent = "Relatório de inconsistências gerado";
      elements.inputPanel.classList.add("hidden");
      elements.tablePanel.classList.add("hidden");
    }
  }

  function clearImport() {
    elements.csvText.value = "";
    elements.dataFile.value = "";
    elements.dataFileStatus.textContent = "Nenhum arquivo selecionado";
    DataTable.destroyTable();
    document.querySelector("#tableBadge").textContent = "0 linhas";
  }

  function getRuntimeConfig() {
    return {
      ...window.VALIDATOR_CONFIG,
      tolerancePercent: Number(document.querySelector("#tolerancePercent").value || 10),
      cable: {
        ...window.VALIDATOR_CONFIG.cable,
        quantityMultipliersByPhase: {
          ...window.VALIDATOR_CONFIG.cable.quantityMultipliersByPhase,
          ABC: Number(document.querySelector("#cableFactorABC").value || 4.41)
        }
      },
      rules: {
        ...window.VALIDATOR_CONFIG.rules,
        catalog: document.querySelector("#ruleCatalog").checked,
        pointIntegrity: document.querySelector("#rulePoint").checked,
        customLinks: document.querySelector("#ruleLinks").checked,
        cable: document.querySelector("#ruleCable").checked,
        dataQuality: document.querySelector("#ruleQuality").checked
      }
    };
  }

  async function importCurrentData() {
    try {
      let rows;

      if (elements.dataFile.files[0]) {
        rows = await DataTable.parseFile(elements.dataFile.files[0]);
      } else {
        rows = DataTable.parseCsv(elements.csvText.value);
      }

      DataTable.renderTable(rows);
      showMessage("success", "Conteúdo importado", `${rows.length} linha(s) disponíveis para conferência.`);
    } catch (error) {
      showMessage("danger", "Falha na importação", error.message);
    }
  }

  function saveStep() {
    const rows = DataTable.getRows();

    if (!rows || !rows.length) {
      showMessage("warning", "Nenhuma tabela importada", "Importe e confira os dados antes de salvar a etapa.");
      return;
    }

    if (state.step === 1) {
      state.materials = rows;
      state.step = 2;
      clearImport();
      updateStep();
      showMessage("success", "Materiais salvos", "Agora importe a base de serviços / Medição Única.");
      return;
    }

    if (state.step === 2) {
      state.services = rows;
      runAnalysis();
    }
  }

  function severityLabel(severity) {
    return {
      critical: "CRÍTICO",
      error: "ERRO",
      warning: "ALERTA",
      info: "INFORMAÇÃO"
    }[severity] || severity;
  }

  function sourceLabel(source) {
    return {
      material: "Materiais",
      service: "Serviços",
      ambos: "Materiais x Serviços"
    }[source] || source;
  }

  function issueCard(issue) {
    return `
      <article class="issue-card ${escapeHtml(issue.severity)}"
        data-severity="${escapeHtml(issue.severity)}"
        data-search="${escapeHtml([
          issue.rule, issue.category, issue.point, issue.code, issue.message,
          issue.expected, issue.found, issue.details
        ].join(" ").toLowerCase())}">
        <div class="issue-card-head">
          <div>
            <div class="issue-tags">
              <span class="severity-tag">${severityLabel(issue.severity)}</span>
              <span>${escapeHtml(issue.category)}</span>
              <span>${escapeHtml(sourceLabel(issue.source))}</span>
            </div>
            <h4>${escapeHtml(issue.message)}</h4>
          </div>
          <strong class="point-tag">Ponto: ${escapeHtml(displayPoint(issue.point))}</strong>
        </div>

        <div class="issue-grid">
          <div><span>Regra</span><strong>${escapeHtml(issue.rule)}</strong></div>
          <div><span>Linha de origem</span><strong>${escapeHtml(issue.line || "-")}</strong></div>
          <div><span>Código</span><strong>${escapeHtml(issue.code || "-")}</strong></div>
          <div><span>Esperado</span><strong>${escapeHtml(issue.expected || "-")}</strong></div>
          <div><span>Encontrado</span><strong>${escapeHtml(issue.found || "-")}</strong></div>
        </div>
        ${issue.details ? `<p class="issue-details">${escapeHtml(issue.details)}</p>` : ""}
      </article>
    `;
  }

  function renderResults(result) {
    const summary = result.summary;
    elements.resultsPanel.classList.remove("hidden");
    elements.comparisonSummary.innerHTML = `
      <div class="summary-header">
        <div>
          <span class="summary-label">Relatório do As Built</span>
          <h3>${summary.errors || summary.critical ? "Foram encontradas inconsistências" : "Nenhum erro impeditivo encontrado"}</h3>
          <p>
            ${summary.pointsWithIssues} de ${summary.points} ponto(s) possuem ocorrência.
            Catálogo consultado: ${summary.catalogItems} itens.
          </p>
        </div>
        <div class="summary-counter">
          <strong>${summary.totalIssues}</strong>
          <span>ocorrências</span>
        </div>
      </div>

      <div class="summary-kpis validation-kpis">
        <div class="summary-kpi critical"><span>Críticos</span><strong>${summary.critical}</strong></div>
        <div class="summary-kpi danger"><span>Erros</span><strong>${summary.errors}</strong></div>
        <div class="summary-kpi warning"><span>Alertas</span><strong>${summary.warnings}</strong></div>
        <div class="summary-kpi info"><span>Informações</span><strong>${summary.info}</strong></div>
        <div class="summary-kpi"><span>Pontos analisados</span><strong>${summary.points}</strong></div>
        <div class="summary-kpi"><span>Materiais / Serviços</span><strong>${summary.materials} / ${summary.services}</strong></div>
        <div class="summary-kpi"><span>Serviços retirados ignorados</span><strong>${summary.excludedServices}</strong></div>
      </div>

      <details class="detected-columns">
        <summary>Colunas reconhecidas pelo sistema</summary>
        <div>
          <span>Materiais: ID <strong>${escapeHtml(result.columns.material.key || "não reconhecido")}</strong>,
            ponto <strong>${escapeHtml(result.columns.material.point || "não reconhecido")}</strong>,
            código <strong>${escapeHtml(result.columns.material.code || "não reconhecido")}</strong>,
            quantidade <strong>${escapeHtml(result.columns.material.quantity || "não reconhecida")}</strong>.</span>
          <span>Serviços: ID <strong>${escapeHtml(result.columns.service.key || "não reconhecido")}</strong>,
            ponto <strong>${escapeHtml(result.columns.service.point || "localizado pela UP")}</strong>,
            código <strong>${escapeHtml(result.columns.service.code || "não reconhecido")}</strong>,
            quantidade <strong>${escapeHtml(result.columns.service.quantity || "não reconhecida")}</strong>.</span>
        </div>
      </details>

      <div class="result-toolbar">
        <input id="issueSearch" type="search" placeholder="Filtrar por ponto, código, regra ou texto...">
        <select id="severityFilter">
          <option value="">Todas as severidades</option>
          <option value="critical">Críticos</option>
          <option value="error">Erros</option>
          <option value="warning">Alertas</option>
          <option value="info">Informações</option>
        </select>
        <button class="btn btn-secondary" id="exportCsv" type="button">Exportar CSV</button>
        <button class="btn btn-secondary" id="exportJson" type="button">Exportar JSON</button>
        <button class="btn btn-primary" id="newAnalysis" type="button">Nova análise</button>
      </div>

      <div id="filterCounter" class="filter-counter">${result.issues.length} ocorrência(s) exibida(s)</div>
      <div id="issueList" class="issue-list">
        ${result.issues.length
          ? result.issues.map(issueCard).join("")
          : '<div class="empty-state"><strong>As bases passaram nas regras habilitadas.</strong><span>Revise também os avisos informativos ao adicionar novos vínculos.</span></div>'}
      </div>
    `;

    document.querySelector("#issueSearch").addEventListener("input", filterIssues);
    document.querySelector("#severityFilter").addEventListener("change", filterIssues);
    document.querySelector("#exportCsv").addEventListener("click", () => exportIssues("csv"));
    document.querySelector("#exportJson").addEventListener("click", () => exportIssues("json"));
    document.querySelector("#newAnalysis").addEventListener("click", resetAll);
  }

  function filterIssues() {
    const search = document.querySelector("#issueSearch").value.toLowerCase().trim();
    const severity = document.querySelector("#severityFilter").value;
    const cards = Array.from(document.querySelectorAll(".issue-card"));
    let visible = 0;

    cards.forEach(card => {
      const matchesSearch = !search || card.dataset.search.includes(search);
      const matchesSeverity = !severity || card.dataset.severity === severity;
      const show = matchesSearch && matchesSeverity;
      card.classList.toggle("hidden", !show);
      if (show) visible += 1;
    });

    document.querySelector("#filterCounter").textContent = `${visible} ocorrência(s) exibida(s)`;
  }

  function download(content, filename, type) {
    const blob = new Blob([content], { type });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function exportIssues(format) {
    if (!state.result) return;

    if (format === "json") {
      download(
        JSON.stringify(state.result, null, 2),
        "relatorio-validacao-asbuilt.json",
        "application/json;charset=utf-8"
      );
      return;
    }

    const rows = state.result.issues.map(issue => ({
      Severidade: severityLabel(issue.severity),
      Regra: issue.rule,
      Categoria: issue.category,
      Ponto: displayPoint(issue.point),
      Origem: sourceLabel(issue.source),
      Linha: issue.line || "",
      Código: issue.code,
      Mensagem: issue.message,
      Esperado: issue.expected,
      Encontrado: issue.found,
      Detalhes: issue.details
    }));

    download(
      "\uFEFF" + Papa.unparse(rows, { delimiter: ";" }),
      "relatorio-validacao-asbuilt.csv",
      "text/csv;charset=utf-8"
    );
  }

  function runAnalysis() {
    state.result = AsBuiltValidator.analyze(
      state.materials,
      state.services,
      getRuntimeConfig(),
      state.catalog
    );
    state.step = 3;
    clearImport();
    updateStep();
    renderResults(state.result);

    const blocking = state.result.summary.critical + state.result.summary.errors;
    showMessage(
      blocking ? "danger" : "success",
      blocking ? "Validação concluída com erros" : "Validação concluída",
      blocking
        ? `${blocking} ocorrência(s) crítica(s) ou de erro foram encontradas.`
        : "Nenhum erro impeditivo foi encontrado nas regras habilitadas."
    );

    elements.resultsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetAll() {
    state.step = 1;
    state.materials = null;
    state.services = null;
    state.result = null;
    clearImport();
    elements.inputPanel.classList.remove("hidden");
    elements.tablePanel.classList.remove("hidden");
    elements.resultsPanel.classList.add("hidden");
    elements.comparisonSummary.innerHTML = "";
    updateStep();
    showMessage("info", "Aguardando importação", "Importe primeiro a base de materiais / UP por Barramento.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function catalogFromWorkbook(workbook) {
    const preferred = workbook.SheetNames.includes("Planilha1") ? "Planilha1" : workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[preferred], { defval: "", raw: false });

    return rows.map((row, index) => ({
      codigoSap: row["CÓDIGO SAP"] || row["Código SAP"] || row["Codigo SAP"] || "",
      up: row.UP || "",
      descricao: row["TEXTO BREVE"] || row["Texto Breve"] || "",
      descricaoCompleta: row["TEXTO COMPLETO (NOVO"] || row["TEXTO COMPLETO"] || "",
      unidade: row.UNIDADE || row.Unidade || "",
      familia: row["TIPO/FAMILIA"] || row.Familia || "",
      caderno: row.CADERNO || row.Caderno || "",
      grupo: row.GRUPO || "",
      linhaExcel: index + 2
    })).filter(item => item.codigoSap || item.up);
  }

  async function loadCatalogFile(file) {
    try {
      const extension = file.name.split(".").pop().toLowerCase();
      let workbook;

      if (extension === "csv") {
        const rows = DataTable.parseCsv(await file.text());
        const sheet = XLSX.utils.json_to_sheet(rows);
        workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, sheet, "Planilha1");
      } else {
        workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      }

      const catalog = catalogFromWorkbook(workbook);
      if (!catalog.length) throw new Error("Nenhum serviço foi identificado no arquivo.");

      state.catalog = catalog;
      updateCatalogStatus();
      showMessage("success", "Caderno atualizado", `${catalog.length} itens carregados do arquivo ${file.name}.`);
    } catch (error) {
      showMessage("danger", "Falha ao carregar o caderno", error.message);
    }
  }

  elements.importButton.addEventListener("click", importCurrentData);
  elements.nextStep.addEventListener("click", saveStep);
  elements.resetButton.addEventListener("click", resetAll);
  elements.dataFile.addEventListener("change", event => {
    const file = event.target.files[0];
    elements.dataFileStatus.textContent = file ? file.name : "Nenhum arquivo selecionado";
  });
  elements.catalogFile.addEventListener("change", event => {
    const file = event.target.files[0];
    if (file) loadCatalogFile(file);
  });

  updateCatalogStatus();
  updateStep();
})();
