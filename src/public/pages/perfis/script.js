const formPerfil = document.getElementById("formPerfil");
const tabelaUsuarios = document.getElementById("tabelaUsuarios");
const contadorUsuarios = document.getElementById("contadorUsuarios");

function escapar(valor) {
  const elemento = document.createElement("div");
  elemento.textContent = valor ?? "";
  return elemento.innerHTML;
}

async function carregarUsuarios() {
  const response = await fetch("/api/usuarios", { credentials: "include" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Erro ao carregar usuários.");

  contadorUsuarios.textContent = `${data.length} usuários`;
  tabelaUsuarios.innerHTML = data.map(usuario => `
    <tr>
      <td>${escapar(usuario.nome)}</td>
      <td><span class="badge">${escapar(usuario.tipo_usuario)}</span></td>
      <td><strong>${escapar(usuario.regional)}</strong></td>
      <td>${new Date(usuario.criado_em).toLocaleDateString("pt-BR")}</td>
    </tr>
  `).join("") || '<tr><td colspan="4">Nenhum usuário cadastrado.</td></tr>';
}

formPerfil.addEventListener("submit", async event => {
  event.preventDefault();
  const payload = {
    nome: document.getElementById("nome").value,
    senha: document.getElementById("senha").value,
    tipo_usuario: document.getElementById("tipoUsuario").value,
    regional: document.getElementById("regional").value
  };

  try {
    const response = await fetch("/api/usuarios", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Erro ao criar perfil.");
    formPerfil.reset();
    msgSucesso(data.message);
    await carregarUsuarios();
  } catch (error) {
    msgErro(error.message);
  }
});

carregarUsuarios().catch(error => msgErro(error.message));
