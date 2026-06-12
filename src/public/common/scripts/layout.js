const permissoesMenu = {
  admin: ["home", "solicitarMateriais", "solicitacoes", "configuracoes", "perfis", "teste"],
  almoxarifado: ["home", "solicitarMateriais", "solicitacoes", "configuracoes", "teste"],
  programacao: ["home", "solicitarMateriais", "solicitacoes", "teste"],
  sem_perfil: ["home", "teste"]
};

const itensMenu = [
  { id: "home", href: "/home", icone: "⌂", texto: "Home" },
  { id: "solicitarMateriais", href: "/solicitar-materiais", icone: "□", texto: "Solicitar materiais" },
  { id: "solicitacoes", href: "/solicitacoes", icone: "≡", texto: "Solicitações" },
  { id: "configuracoes", href: "/configuracoes", icone: "⚙", texto: "Configurações" },
  { id: "perfis", href: "/perfis", icone: "+", texto: "Perfis de acesso" },
  { id: "teste", href: "/teste", icone: "👁️‍🗨️", texto: "Teste As-Built" }
];

function aplicarTema(tema) {
  document.documentElement.dataset.theme = tema;
  localStorage.setItem("theme", tema);
  const botao = document.getElementById("btnTema");
  if (botao) {
    const escuro = tema === "dark";
    botao.classList.toggle("is-dark", escuro);
    botao.setAttribute("aria-checked", String(escuro));
    botao.querySelector(".theme-label").textContent = escuro ? "Escuro" : "Claro";
  }
}

function renderizarSidebar() {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;
  const itemAtivo = sidebar.dataset.active;
  const links = itensMenu.map(item => `
    <a href="${item.href}" class="nav-link${item.id === itemAtivo ? " active" : ""}" id="${item.id}" hidden>
      <span class="nav-icon">${item.icone}</span><span>${item.texto}</span>
    </a>
  `).join("");

  sidebar.innerHTML = `
    <div class="sidebar-header">
      <div class="sidebar-logo">CM</div>
      <div><h2>Controle</h2><span id="regionalUsuario">Materiais</span></div>
    </div>
    <nav class="sidebar-nav">${links}</nav>
    <div class="sidebar-footer">
      <button id="btnTema" class="theme-switch" type="button" role="switch" aria-checked="false">
        <span class="theme-icon" aria-hidden="true">☼</span>
        <span class="theme-label">Claro</span>
        <span class="switch-track"><span class="switch-thumb"></span></span>
      </button>
      <button id="btnLogout" class="logout-button" type="button">Sair</button>
    </div>
  `;
}

function ajustarMenu(tipoUsuario) {
  const permitidos = permissoesMenu[tipoUsuario] || permissoesMenu.sem_perfil;
  document.querySelectorAll(".nav-link").forEach(link => {
    link.hidden = !permitidos.includes(link.id);
  });
}

async function carregarUsuarioLogado() {
  try {
    const response = await fetch("/perfil", { credentials: "include" });
    if (!response.ok) {
      window.location.href = "/";
      return;
    }
    const { usuario } = await response.json();
    window.usuarioAtual = usuario;
    const perfil = usuario.tipo_usuario || "sem_perfil";
    const avatar = document.querySelector(".user-avatar");
    const nome = document.getElementById("nomeUsuario");
    const perfilElement = document.getElementById("perfilUsuario");
    const regional = document.getElementById("regionalUsuario");

    if (avatar) avatar.textContent = usuario.nome.trim().split(/\s+/).map(parte => parte[0]).join("").toUpperCase();
    if (nome) nome.textContent = usuario.nome;
    if (perfilElement) perfilElement.textContent = `${perfil} · ${usuario.regional}`;
    if (regional) regional.textContent = `Regional ${usuario.regional}`;
    ajustarMenu(perfil);
    document.dispatchEvent(new CustomEvent("usuario-carregado", { detail: usuario }));
  } catch {
    window.location.href = "/";
  }
}

renderizarSidebar();
aplicarTema(localStorage.getItem("theme") === "dark" ? "dark" : "light");

document.getElementById("btnTema")?.addEventListener("click", () => {
  aplicarTema(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

document.getElementById("btnLogout")?.addEventListener("click", async () => {
  try {
    await fetch("/logout", { method: "POST", credentials: "include" });
  } finally {
    window.location.href = "/";
  }
});

carregarUsuarioLogado();
