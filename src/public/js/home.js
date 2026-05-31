const btnLogout = document.getElementById("btnLogout");
const nomeUsuario = document.getElementById("nomeUsuario");
const perfilUsuario = document.getElementById("perfilUsuario");
const userAvatar = document.querySelector(".user-avatar");

function pegarIniciais(nome) {
  if (!nome) return "U";

  return nome
    .trim()
    .split(/\s+/)
    .map(parte => parte[0])
    .join("")
    .toUpperCase();
}

async function carregarUsuarioLogado() {
  try {
    const response = await fetch("/perfil", {
      method: "GET",
      credentials: "include"
    });

    if (response.status === 401) {
      window.location.href = "/login.html";
      return;
    }

    const data = await response.json();
    console.warn(data);
    
    if (data.usuario) {
      userAvatar.textContent = pegarIniciais(data.usuario.nome);
      nomeUsuario.textContent = data.usuario.nome || "Usuário";
      perfilUsuario.textContent = data.usuario.tipo_usuario || data.usuario.perfil || "Sistema interno";

      localStorage.setItem("userRole", data.usuario.tipo_usuario || data.usuario.perfil || "programacao");
      localStorage.setItem("userId", data.usuario.id_usuario);
      
    }

  } catch (error) {
    console.error("Erro ao carregar usuário:", error);
  }
}

if (btnLogout) {
  btnLogout.addEventListener("click", async () => {
    try {
      await fetch("/logout", {
        method: "POST",
        credentials: "include"
      });

      msgSucesso("Logout realizado com sucesso!");

      setTimeout(() => {
        window.location.href = "/login.html";
      }, 700);

    } catch (error) {
      console.error("Erro ao sair:", error);
      msgErro("Erro ao sair do sistema.");
    }
  });
}

carregarUsuarioLogado();