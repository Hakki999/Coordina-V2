function escaparHTML(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function imprimirListaMateriais(solicitacao) {
  if (!solicitacao) {
    alert("Nenhuma solicitação selecionada para imprimir.");
    return;
  }

  const materiais = Array.isArray(solicitacao.materiais)
    ? solicitacao.materiais
    : [];

  const linhasMateriais = materiais.length > 0
    ? materiais.map((material, index) => {
        const codigo =
          material.codigo_material ||
          material.codigo ||
          "-";

        const descricao =
          material.descricao ||
          material.descricao_material ||
          "-";

        const quantidade =
          material.quantidade_sol ||
          material.quantidade ||
          material.qtd ||
          "-";

        const unidade =
          material.unidade ||
          "";

        return `
          <tr>
            <td>${index + 1}</td>
            <td>${escaparHTML(codigo)}</td>
            <td>${escaparHTML(descricao)}</td>
            <td>${escaparHTML(quantidade)}</td>
            <td>${escaparHTML(unidade)}</td>
          </tr>
        `;
      }).join("")
    : `
      <tr>
        <td colspan="5" class="empty">
          Nenhum material encontrado.
        </td>
      </tr>
    `;

  const htmlImpressao = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <title>Lista de Materiais - Solicitação #${escaparHTML(solicitacao.id)}</title>

      <style>
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          padding: 28px;
          font-family: Arial, Helvetica, sans-serif;
          color: #0f172a;
          background: #ffffff;
        }

        .cabecalho {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          padding-bottom: 18px;
          margin-bottom: 20px;
          border-bottom: 2px solid #0f172a;
        }

        .cabecalho h1 {
          margin: 0 0 6px;
          font-size: 24px;
        }

        .cabecalho p {
          margin: 0;
          color: #475569;
          font-size: 14px;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 22px;
        }

        .info-item {
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 10px;
        }

        .info-item span {
          display: block;
          margin-bottom: 4px;
          font-size: 11px;
          color: #64748b;
          font-weight: bold;
          text-transform: uppercase;
        }

        .info-item strong {
          display: block;
          font-size: 14px;
          color: #0f172a;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }

        th,
        td {
          border: 1px solid #cbd5e1;
          padding: 9px 10px;
          font-size: 13px;
          text-align: left;
        }

        th {
          background: #f1f5f9;
          color: #0f172a;
          font-weight: bold;
        }

        td:nth-child(1),
        td:nth-child(4),
        td:nth-child(5),
        th:nth-child(1),
        th:nth-child(4),
        th:nth-child(5) {
          text-align: center;
        }

        .empty {
          text-align: center;
          color: #64748b;
          height: 70px;
        }

        .rodape {
          margin-top: 34px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
        }

        .assinatura {
          padding-top: 34px;
          border-top: 1px solid #0f172a;
          text-align: center;
          font-size: 13px;
          color: #334155;
        }

        @media print {
          body {
            padding: 18px;
          }

          button {
            display: none;
          }

          .info-grid {
            grid-template-columns: repeat(4, 1fr);
          }

          th {
            background: #f1f5f9 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      </style>
    </head>

    <body>

      <section class="cabecalho">
        <div>
          <h1>Lista de Materiais</h1>
          <p>Controle de Materiais - Solicitação #${escaparHTML(solicitacao.id)}</p>
        </div>

        <div>
          <p><strong>Data de impressão:</strong> ${new Date().toLocaleDateString("pt-BR")}</p>
        </div>
      </section>

      <section class="info-grid">
        <div class="info-item">
          <span>Projeto</span>
          <strong>${escaparHTML(solicitacao.projeto || "-")}</strong>
        </div>

        <div class="info-item">
          <span>Cidade</span>
          <strong>${escaparHTML(solicitacao.cidade || "-")}</strong>
        </div>

        <div class="info-item">
          <span>Equipe</span>
          <strong>${escaparHTML(solicitacao.equipe || "-")}</strong>
        </div>

        <div class="info-item">
          <span>Status</span>
          <strong>${escaparHTML(formatarStatus(solicitacao.status))}</strong>
        </div>

        <div class="info-item">
          <span>Tensão</span>
          <strong>${escaparHTML(solicitacao.tensao_rede ? solicitacao.tensao_rede + " kV" : "-")}</strong>
        </div>

        <div class="info-item">
          <span>Execução</span>
          <strong>${escaparHTML(formatarData(solicitacao.data_exe))}</strong>
        </div>

        <div class="info-item">
          <span>Tipo</span>
          <strong>${escaparHTML(solicitacao.tipo_servico || "-")}</strong>
        </div>

        <div class="info-item">
          <span>Criado em</span>
          <strong>${escaparHTML(formatarData(solicitacao.criado_em))}</strong>
        </div>
      </section>

      <table>
        <thead>
          <tr>
            <th>Nº</th>
            <th>Código</th>
            <th>Descrição</th>
            <th>Quantidade</th>
            <th>Unidade</th>
          </tr>
        </thead>

        <tbody>
          ${linhasMateriais}
        </tbody>
      </table>

      <section class="rodape">
        <div class="assinatura">
          Responsável pela separação
        </div>

        <div class="assinatura">
          Responsável pelo recebimento
        </div>
      </section>

    </body>
    </html>
  `;

  let iframe = document.getElementById("iframeImpressaoMateriais");

if (iframe) {
  iframe.remove();
}

iframe = document.createElement("iframe");
iframe.id = "iframeImpressaoMateriais";

iframe.style.position = "fixed";
iframe.style.right = "0";
iframe.style.bottom = "0";
iframe.style.width = "0";
iframe.style.height = "0";
iframe.style.border = "0";
iframe.style.opacity = "0";

document.body.appendChild(iframe);

const doc = iframe.contentWindow.document;

doc.open();
doc.write(htmlImpressao);
doc.close();

iframe.onload = () => {
  iframe.contentWindow.focus();
  iframe.contentWindow.print();

  setTimeout(() => {
    iframe.remove();
  }, 1000);
};
}