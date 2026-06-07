const formSenha = document.getElementById("formSenha");

formSenha.addEventListener("submit", async event => {
  event.preventDefault();
  const response = await fetch("/api/minha-senha", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      senha_atual: document.getElementById("senhaAtual").value,
      nova_senha: document.getElementById("novaSenha").value
    })
  });
  const data = await response.json();

  if (!response.ok) {
    msgErro(data.error || "Erro ao alterar senha.");
    return;
  }

  formSenha.reset();
  msgSucesso(data.message);
});
