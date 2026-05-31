function criarContainerMensagens() {
  let container = document.querySelector(".message-container");

  if (!container) {
    container = document.createElement("div");
    container.className = "message-container";
    document.body.appendChild(container);
  }

  return container;
}

function mostrarMensagem({
  tipo = "info",
  titulo = "Aviso",
  texto = "",
  duracao = 3500
}) {
  const container = criarContainerMensagens();

  const icones = {
    success: "✓",
    error: "!",
    warning: "⚠",
    info: "i"
  };

  const mensagem = document.createElement("div");
  mensagem.className = `message ${tipo}`;

  mensagem.innerHTML = `
    <div class="message-icon">${icones[tipo] || icones.info}</div>

    <div class="message-content">
      <div class="message-title">${titulo}</div>
      <div class="message-text">${texto}</div>
    </div>

    <button class="message-close" type="button">×</button>
    <div class="message-progress"></div>
  `;

  const progress = mensagem.querySelector(".message-progress");
  progress.style.animationDuration = `${duracao}ms`;

  const btnFechar = mensagem.querySelector(".message-close");

  function fecharMensagem() {
    mensagem.classList.add("closing");

    setTimeout(() => {
      mensagem.remove();
    }, 220);
  }

  btnFechar.addEventListener("click", fecharMensagem);

  container.appendChild(mensagem);

  if (duracao > 0) {
    setTimeout(fecharMensagem, duracao);
  }

  return mensagem;
}

function msgSucesso(texto, titulo = "Sucesso") {
  return mostrarMensagem({
    tipo: "success",
    titulo,
    texto
  });
}

function msgErro(texto, titulo = "Erro") {
  return mostrarMensagem({
    tipo: "error",
    titulo,
    texto,
    duracao: 4500
  });
}

function msgAviso(texto, titulo = "Atenção") {
  return mostrarMensagem({
    tipo: "warning",
    titulo,
    texto
  });
}

function msgInfo(texto, titulo = "Informação") {
  return mostrarMensagem({
    tipo: "info",
    titulo,
    texto
  });
}