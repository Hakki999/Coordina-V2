const formLogin = document.getElementById("formLogin");

formLogin.addEventListener("submit", async function (event) {
  event.preventDefault();

  const nome = document.getElementById("nome").value.trim();
  const senha = document.getElementById("senha").value.trim();

  if (nome === "" || senha === "") {
    msgAviso("Preencha todos os campos!");
    return;
  }

  try {
    const response = await fetch("/login", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        nome,
        senha
      })
    });

    const data = await response.json();

    if (!response.ok) {
      msgErro(data.error || "Erro ao fazer login");
      return;
    }

    msgSucesso("Login realizado com sucesso!");

    setTimeout(() => {
      window.location.href = "/home.html";
    }, 1000);

  } catch (error) {
    console.error("Erro no login:", error);
    msgErro("Erro ao conectar com o servidor.");
  }
});