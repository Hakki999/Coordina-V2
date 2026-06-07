function escaparHTMLImpressao(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function imprimirListaMateriais(solicitacao) {
  if (!solicitacao) {
    msgErro("Nenhuma solicitação selecionada para imprimir.");
    return;
  }

  const e = escaparHTMLImpressao;
  const materiais = Array.isArray(solicitacao.materiais) ? solicitacao.materiais : [];
  const agora = new Date();
  const dataHora = agora.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const linhas = materiais.map((material, index) => `
    <tr>
      <td class="numero">${index + 1}</td>
      <td>${e(material.codigo_material || material.codigo || "-")}</td>
      <td>${e(material.descricao || material.descricao_material || "-")}</td>
      <td class="quantidade">${e(material.quantidade_sol ?? material.quantidade ?? "-")}</td>
      <td class="quantidade">${e(material.quantidade_lib ?? 0)}</td>
      <td class="quantidade">${e(material.quantidade_dev ?? 0)}</td>
      <td class="quantidade">${e(material.unidade || "-")}</td>
    </tr>
  `).join("") || '<tr><td colspan="7" class="vazio">Nenhum material encontrado.</td></tr>';

  const documento = `<!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <title>Solicitação #${e(solicitacao.id)}</title>
    <link rel="stylesheet" href="/pages/solicitacoes/print.css">
    <style>
      @page { size: A4 portrait; margin: 12mm; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #fff; color: #172033; font-family: Arial, Helvetica, sans-serif; }
      body { font-size: 10.5px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .folha { min-height: 273mm; display: flex; flex-direction: column; }
      .cabecalho { display: grid; grid-template-columns: 1fr auto; gap: 18px; align-items: center; padding-bottom: 10px; border-bottom: 3px solid #2563eb; }
      .marca { display: flex; align-items: center; gap: 10px; }
      .logo { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 8px; background: #2563eb; color: #fff; font-size: 15px; font-weight: 900; }
      h1 { margin: 0 0 3px; font-size: 20px; color: #0f172a; }
      .subtitulo { color: #64748b; font-size: 10px; }
      .pedido { min-width: 116px; padding: 8px 12px; border: 1px solid #bfdbfe; border-radius: 8px; text-align: center; background: #eff6ff; }
      .pedido span { display: block; margin-bottom: 2px; color: #64748b; font-size: 8px; font-weight: 700; text-transform: uppercase; }
      .pedido strong { color: #1d4ed8; font-size: 18px; }
      .metadados { margin: 7px 0 10px; display: flex; justify-content: space-between; color: #64748b; font-size: 9px; }
      .info { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 10px; }
      .campo { min-height: 44px; padding: 6px 8px; border: 1px solid #dbe2ea; border-radius: 6px; background: #f8fafc; }
      .campo span, .observacao span { display: block; margin-bottom: 3px; color: #64748b; font-size: 7.5px; font-weight: 800; letter-spacing: .35px; text-transform: uppercase; }
      .campo strong { color: #172033; font-size: 10px; }
      .secao-titulo { margin: 2px 0 6px; display: flex; justify-content: space-between; align-items: end; }
      .secao-titulo h2 { margin: 0; color: #0f172a; font-size: 12px; }
      .secao-titulo span { color: #64748b; font-size: 9px; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      thead { display: table-header-group; }
      th { padding: 6px 5px; border: 1px solid #cbd5e1; background: #1e3a8a; color: #fff; font-size: 8px; letter-spacing: .25px; text-transform: uppercase; }
      td { padding: 5px; border: 1px solid #dbe2ea; color: #334155; vertical-align: middle; word-break: break-word; }
      tbody tr:nth-child(even) td { background: #f8fafc; }
      tr { break-inside: avoid; page-break-inside: avoid; }
      th:nth-child(1) { width: 28px; } th:nth-child(2) { width: 72px; } th:nth-child(4), th:nth-child(5), th:nth-child(6) { width: 62px; } th:nth-child(7) { width: 52px; }
      .numero, .quantidade { text-align: center; }
      .vazio { height: 50px; text-align: center; color: #64748b; }
      .observacao { margin-top: 9px; min-height: 42px; padding: 7px 8px; border: 1px solid #dbe2ea; border-radius: 6px; background: #f8fafc; break-inside: avoid; }
      .observacao p { margin: 0; color: #334155; line-height: 1.35; }
      .rodape { margin-top: auto; padding-top: 22px; break-inside: avoid; page-break-inside: avoid; }
      .assinaturas { display: grid; grid-template-columns: 1fr 1fr; gap: 38px; }
      .assinatura { padding-top: 7px; border-top: 1px solid #334155; text-align: center; color: #64748b; font-size: 8px; }
      .assinatura strong { display: block; margin-bottom: 2px; color: #172033; font-size: 9px; }
      .final { margin-top: 10px; padding-top: 5px; display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 7px; }
    </style>
  </head>
  <body>
    <main class="folha">
      <header class="cabecalho">
        <div class="marca"><div class="logo">CM</div><div><h1>Requisição de materiais</h1><div class="subtitulo">Controle de separação, liberação e devolução</div></div></div>
        <div class="pedido"><span>Solicitação</span><strong>#${e(solicitacao.id)}</strong></div>
      </header>
      <div class="metadados"><span>Regional ${e(solicitacao.regional || "-")}</span><span>Emitido em ${e(dataHora)}</span></div>
      <section class="info">
        <div class="campo"><span>Projeto</span><strong>${e(solicitacao.projeto || "-")}</strong></div>
        <div class="campo"><span>Cidade</span><strong>${e(solicitacao.cidade || "-")}</strong></div>
        <div class="campo"><span>Equipe</span><strong>${e(solicitacao.equipe || "-")}</strong></div>
        <div class="campo"><span>Status</span><strong>${e(formatarStatus(solicitacao.status))}</strong></div>
        <div class="campo"><span>Tensão</span><strong>${e(solicitacao.tensao_rede ? `${solicitacao.tensao_rede} kV` : "-")}</strong></div>
        <div class="campo"><span>Execução</span><strong>${e(formatarData(solicitacao.data_exe))}</strong></div>
        <div class="campo"><span>Tipo de serviço</span><strong>${e(solicitacao.tipo_servico || "-")}</strong></div>
        <div class="campo"><span>Total de materiais</span><strong>${materiais.length}</strong></div>
      </section>
      <div class="secao-titulo"><h2>Materiais solicitados</h2><span>Conferir quantidades no recebimento</span></div>
      <table>
        <thead><tr><th>Nº</th><th>Código</th><th>Descrição</th><th>Solic.</th><th>Liber.</th><th>Devol.</th><th>Un.</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>
      <section class="observacao"><span>Observação</span><p>${e(solicitacao.observacao || "Sem observações.")}</p></section>
      <footer class="rodape">
        <div class="assinaturas">
          <div class="assinatura"><strong>Responsável pela separação</strong>Nome / assinatura / data</div>
          <div class="assinatura"><strong>Responsável pelo recebimento</strong>Nome / assinatura / data</div>
        </div>
        <div class="final"><span>Controle de Materiais • Solicitação #${e(solicitacao.id)}</span><span>Documento gerado automaticamente</span></div>
      </footer>
    </main>
  </body>
  </html>`;

  const janela = window.open("", "_blank", "width=1000,height=800");
  if (!janela) {
    msgErro("Permita pop-ups para abrir a impressão.");
    return;
  }
  janela.document.open();
  janela.document.write(documento);
  janela.document.close();
  setTimeout(() => {
    janela.focus();
    janela.print();
  }, 700);
}
