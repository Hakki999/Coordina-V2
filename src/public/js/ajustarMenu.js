const permissoesMenu = {
  admin: [
    "home",
    "solicitarMateriais",
    "solicitacoes",
    "configuracoes",
    "novoUsuario"
  ],

  almoxarifado: [
    "home",
    "solicitarMateriais",
    "solicitacoes",
    "configuracoes"
  ],

  programacao: [
    "home",
    "solicitarMateriais",
    "solicitacoes"
  ],

  sem_perfil: [
    "home"
  ]
};

function ajustarMenu(tipoUsuario) {

    console.log(tipoUsuario);
    
  const navLinks = document.querySelectorAll(".nav-link");
  const btnLogout = document.getElementById("btnLogout");

  const perfil = tipoUsuario || "sem_perfil";
  const allowedLinks = permissoesMenu[perfil] || permissoesMenu.sem_perfil;

  navLinks.forEach((link) => {
    const linkId = link.id;

    if (allowedLinks.includes(linkId)) {
      link.style.display = "flex";
    } else {
      link.style.display = "none";
    }
  });

  if (btnLogout) {
    btnLogout.style.display = perfil ? "flex" : "none";
  }
}

localStorage.getItem("userRole") && ajustarMenu(localStorage.getItem("userRole"));