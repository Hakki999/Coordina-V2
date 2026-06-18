const modalExportacao = document.getElementById("modalExportacao");
const btnAbrirExportacao = document.getElementById("btnAbrirExportacao");
const btnFecharExportacao = document.getElementById("btnFecharExportacao");

function abrirExportacao() {
  modalExportacao.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function fecharExportacao() {
  modalExportacao.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

async function exportarDados(tipo, botao) {
  const titulo = botao.querySelector("strong");
  const textoOriginal = titulo.textContent;
  botao.disabled = true;
  titulo.textContent = "Preparando Excel...";

  try {
    const response = await fetch(`/api/solicitacoes-exportar?tipo=${encodeURIComponent(tipo)}`, {
      credentials: "include"
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Erro ao exportar dados.");
    }

    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition") || "";
    const nome = disposition.match(/filename="([^"]+)"/)?.[1] || `controle-materiais-${tipo}.xlsx`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = nome;
    link.click();
    URL.revokeObjectURL(link.href);
    fecharExportacao();
    msgSucesso("Exportação concluída.");
  } catch (error) {
    msgErro(error.message);
  } finally {
    botao.disabled = false;
    titulo.textContent = textoOriginal;
  }
}

btnAbrirExportacao.addEventListener("click", abrirExportacao);
btnFecharExportacao.addEventListener("click", fecharExportacao);
modalExportacao.addEventListener("click", event => {
  if (event.target === modalExportacao) fecharExportacao();
});

document.querySelectorAll(".opcao-exportacao").forEach(botao => {
  botao.addEventListener("click", () => exportarDados(botao.dataset.tipo, botao));
});
