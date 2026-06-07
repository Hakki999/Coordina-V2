const formLogin = document.getElementById("formLogin");
const toggleSenha = document.getElementById("toggleSenha");
const campoSenha = document.getElementById("senha");
const btnTemaLogin = document.getElementById("btnTemaLogin");

function aplicarTemaLogin(tema) {
  const escuro = tema === "dark";
  document.documentElement.dataset.theme = tema;
  localStorage.setItem("theme", tema);
  btnTemaLogin.classList.toggle("is-dark", escuro);
  btnTemaLogin.setAttribute("aria-checked", String(escuro));
  btnTemaLogin.querySelector(".theme-label").textContent = escuro ? "Escuro" : "Claro";
}

aplicarTemaLogin(localStorage.getItem("theme") === "dark" ? "dark" : "light");

btnTemaLogin.addEventListener("click", () => {
  const tema = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  aplicarTemaLogin(tema);
});

toggleSenha.addEventListener("click", () => {
  const mostrar = campoSenha.type === "password";
  campoSenha.type = mostrar ? "text" : "password";
  toggleSenha.textContent = mostrar ? "Ocultar" : "Mostrar";
});

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
      window.location.href = "/home";
    }, 1000);

  } catch (error) {
    console.error("Erro no login:", error);
    msgErro("Erro ao conectar com o servidor.");
  }
});
