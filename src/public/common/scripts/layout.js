const itensMenu = [
  { id: "home", fixo: true, href: "/home", icone: "🏠", texto: "Início", permissao: "home.visualizar" },

  { id: "solicitarMateriais", grupo: "Almoxarifado", href: "/solicitar-materiais", icone: "➕", texto: "Solicitar materiais", permissao: "logistica.solicitar" },
  { id: "solicitacoes", grupo: "Almoxarifado", href: "/solicitacoes", icone: "📋", texto: "Solicitações", permissao: "logistica.solicitacoes.visualizar" },
  { id: "estoqueFisico", grupo: "Almoxarifado", href: "/estoque-fisico", icone: "📦", texto: "Estoque físico", permissao: "almoxarifado.estoque" },
  { id: "dashboardAlmoxarifado", grupo: "Almoxarifado", href: "/dashboard-almoxarifado", icone: "📊", texto: "Dashboard", permissao: "almoxarifado.dashboard" },
  { id: "configuracoes", grupo: "Almoxarifado", href: "/configuracoes", icone: "⚙️", texto: "Configurações de UP", permissao: "logistica.configuracoes" },

  { id: "controleAsbuilt", grupo: "Medição", href: "/controle-asbuilt", icone: "🧾", texto: "Controle As-Built", permissoes: ["medicao.controle_asbuilt.visualizar", "medicao.controle_asbuilt.editar"] },
  { id: "asbuiltPendentes", grupo: "Medição", href: "/asbuilt-pendentes", icone: "⏳", texto: "Projetos sem As-Built", permissao: "medicao.asbuilt_pendentes" },
  { id: "dashboardAsbuilt", grupo: "Medição", href: "/dashboard-asbuilt", icone: "📈", texto: "Dashboard As-Built", permissao: "medicao.asbuilt_dashboard" },
  { id: "getSgo", grupo: "Medição", href: "/get-sgo", icone: "🔎", texto: "Consulta SGO", permissao: "medicao.sgo" },
  { id: "teste", grupo: "Medição", href: "/teste", icone: "🧪", texto: "Teste As-Built", permissao: "medicao.asbuilt" },

  { id: "biExecucao", grupo: "BI GPM", href: "/bi-gpm/execucao", icone: "🏗️", texto: "Obras e manutenção", permissao: "bi.gpm.visualizar" },
  { id: "biStc", grupo: "BI GPM", href: "/bi-gpm/stc", icone: "⚡", texto: "STC", permissao: "bi.gpm.visualizar" },

  {
    id: "perfis",
    grupo: "Administração",
    href: "/perfis",
    icone: "🔐",
    texto: "Controle de acesso",
    permissoes: ["admin.usuarios", "admin.perfis", "admin.regionais"]
  }
];

const fetchOriginal = window.fetch.bind(window);
window.fetch = async (...args) => {
  const response = await fetchOriginal(...args);
  if (response.status === 401) window.location.replace("/");
  return response;
};

function aplicarTema(tema) {
  document.documentElement.dataset.theme = tema;
  localStorage.setItem("theme", tema);
  const botao = document.getElementById("btnTema");
  if (!botao) return;
  const escuro = tema === "dark";
  botao.classList.toggle("is-dark", escuro);
  botao.setAttribute("aria-checked", String(escuro));
  botao.querySelector(".theme-label").textContent = escuro ? "Escuro" : "Claro";
}

function renderizarSidebar() {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;
  const itemAtivo = sidebar.dataset.active;
  const grupoAtivo = itensMenu.find(item => item.id === itemAtivo)?.grupo;
  const grupoSalvo = localStorage.getItem("menu-group-open");
  const grupos = [...new Set(itensMenu.filter(item => item.grupo).map(item => item.grupo))];
  const fixos = itensMenu.filter(item => item.fixo).map(item => `
    <a href="${item.href}" class="nav-link nav-link-fixed${item.id === itemAtivo ? " active" : ""}" id="${item.id}" hidden>
      <span class="nav-icon">${item.icone}</span><span>${item.texto}</span>
    </a>
  `).join("");

  const secoes = grupos.map(grupo => {
    const aberto = grupo === grupoAtivo || grupo === grupoSalvo;
    const links = itensMenu.filter(item => item.grupo === grupo).map(item => `
      <a href="${item.href}" class="nav-link${item.id === itemAtivo ? " active" : ""}" id="${item.id}" hidden>
        <span class="nav-icon">${item.icone}</span><span>${item.texto}</span>
      </a>
    `).join("");
    return `
      <section class="nav-section${aberto ? " is-open" : ""}" data-menu-group="${grupo}" hidden>
        <button class="nav-group-toggle" type="button" aria-expanded="${aberto}">
          <span>${grupo}</span><span class="nav-chevron">›</span>
        </button>
        <div class="nav-group-links">${links}</div>
      </section>
    `;
  }).join("");

  sidebar.innerHTML = `
    <div class="sidebar-header">
      <div class="sidebar-logo">CO</div>
      <div><h2>Coordina</h2><span id="regionalUsuario">Gestão integrada</span></div>
    </div>
    <nav class="sidebar-nav"><div class="nav-fixed">${fixos}</div>${secoes}</nav>
    <div class="sidebar-footer">
      <button id="btnTema" class="theme-switch" type="button" role="switch" aria-checked="false">
        <span class="theme-icon" aria-hidden="true">◐</span>
        <span class="theme-label">Claro</span>
        <span class="switch-track"><span class="switch-thumb"></span></span>
      </button>
      <button id="btnLogout" class="logout-button" type="button">Sair</button>
    </div>
  `;

  sidebar.querySelectorAll(".nav-group-toggle").forEach(botao => {
    botao.addEventListener("click", () => {
      const secao = botao.closest(".nav-section");
      const abrir = !secao.classList.contains("is-open");
      sidebar.querySelectorAll(".nav-section").forEach(item => {
        item.classList.remove("is-open");
        item.querySelector(".nav-group-toggle")?.setAttribute("aria-expanded", "false");
      });
      if (abrir) {
        secao.classList.add("is-open");
        botao.setAttribute("aria-expanded", "true");
        localStorage.setItem("menu-group-open", secao.dataset.menuGroup);
      } else {
        localStorage.removeItem("menu-group-open");
      }
    });
  });
}

function ajustarMenu(permissoesUsuario) {
  const permissoes = new Set(permissoesUsuario || []);
  itensMenu.forEach(item => {
    const permitido = item.permissao
      ? permissoes.has(item.permissao)
      : item.permissoes?.some(permissao => permissoes.has(permissao));
    const link = document.getElementById(item.id);
    if (link) link.hidden = !permitido;
  });

  document.querySelectorAll(".nav-section").forEach(secao => {
    secao.hidden = !secao.querySelector(".nav-link:not([hidden])");
  });
}

async function carregarUsuarioLogado() {
  try {
    const response = await fetch("/perfil", { credentials: "include" });
    if (!response.ok) return window.location.replace("/");
    const { usuario } = await response.json();
    window.usuarioAtual = usuario;
    const avatar = document.querySelector(".user-avatar");
    const nome = document.getElementById("nomeUsuario");
    const perfilElement = document.getElementById("perfilUsuario");
    const regional = document.getElementById("regionalUsuario");

    if (avatar) avatar.textContent = usuario.nome.trim().split(/\s+/).map(parte => parte[0]).join("").toUpperCase();
    if (nome) nome.textContent = usuario.nome;
    if (perfilElement) perfilElement.textContent = `${usuario.perfil_nome || usuario.tipo_usuario} · ${usuario.regional}`;
    if (regional) regional.textContent = `Regional ${usuario.regional}`;
    ajustarMenu(usuario.permissoes);
    document.dispatchEvent(new CustomEvent("usuario-carregado", { detail: usuario }));
  } catch {
    window.location.replace("/");
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
    window.location.replace("/");
  }
});

carregarUsuarioLogado();
