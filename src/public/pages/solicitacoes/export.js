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

function exportarDados(tipo, botao) {
  const titulo = botao.querySelector("strong");
  const textoOriginal = titulo.textContent;
  botao.disabled = true;
  titulo.textContent = "Preparando Excel...";

  const iframe = document.createElement("iframe");
  iframe.hidden = true;
  iframe.src = `/api/solicitacoes-exportar?tipo=${encodeURIComponent(tipo)}`;
  document.body.appendChild(iframe);

  setTimeout(() => {
    botao.disabled = false;
    titulo.textContent = textoOriginal;
    iframe.remove();
    fecharExportacao();
    msgSucesso("Exportação iniciada.");
  }, 1500);
}

btnAbrirExportacao.addEventListener("click", abrirExportacao);
btnFecharExportacao.addEventListener("click", fecharExportacao);
modalExportacao.addEventListener("click", event => {
  if (event.target === modalExportacao) fecharExportacao();
});

document.querySelectorAll(".opcao-exportacao").forEach(botao => {
  botao.addEventListener("click", () => exportarDados(botao.dataset.tipo, botao));
});
