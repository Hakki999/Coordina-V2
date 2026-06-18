let baseAdmin = { perfis: [], permissoes: [], regionais: [] };
let usuarios = [];
let usuarioAtualAdmin = null;

const e = valor => String(valor ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

function temPermissao(chave) {
  return usuarioAtualAdmin?.permissoes?.includes(chave);
}

async function requisicao(url, options = {}) {
  const response = await fetch(url, { credentials: "include", ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a operação.");
  return data;
}

function optionsPerfis(selecionado = "") {
  return baseAdmin.perfis.map(item =>
    `<option value="${e(item.chave)}"${item.chave === selecionado ? " selected" : ""}>${e(item.nome)}</option>`
  ).join("");
}

function optionsRegionais(selecionado = "") {
  return baseAdmin.regionais.map(item =>
    `<option value="${e(item.codigo)}"${item.codigo === selecionado ? " selected" : ""}>${e(item.codigo)} - ${e(item.nome)}</option>`
  ).join("");
}

function atualizarResumo() {
  document.getElementById("totalUsuarios").textContent = usuarios.length;
  document.getElementById("totalPerfis").textContent = baseAdmin.perfis.length;
  document.getElementById("totalRegionais").textContent = baseAdmin.regionais.length;
}

function configurarAbas() {
  const botoes = [...document.querySelectorAll("[data-tab]")];
  botoes.forEach(botao => { botao.hidden = !temPermissao(botao.dataset.permission); });
  const primeiro = botoes.find(botao => !botao.hidden);
  if (primeiro) ativarAba(primeiro.dataset.tab);
}

function ativarAba(nome) {
  document.querySelectorAll("[data-tab]").forEach(botao => botao.classList.toggle("active", botao.dataset.tab === nome));
  document.querySelectorAll("[data-panel]").forEach(painel => { painel.hidden = painel.dataset.panel !== nome; });
}

async function carregarBase() {
  baseAdmin = await requisicao("/api/admin/acessos");
  document.getElementById("tipoUsuario").innerHTML = optionsPerfis();
  document.getElementById("regional").innerHTML = optionsRegionais();
  renderizarPerfis();
  renderizarRegionais();
  atualizarResumo();
}

async function carregarUsuarios() {
  if (!temPermissao("admin.usuarios")) return;
  usuarios = await requisicao("/api/usuarios");
  document.getElementById("contadorUsuarios").textContent = `${usuarios.length} usuários`;
  document.getElementById("tabelaUsuarios").innerHTML = usuarios.map(usuario => `
    <tr data-usuario-id="${usuario.id}">
      <td><strong>${e(usuario.nome)}</strong><small>${e(usuario.perfil_nome)} · ${e(usuario.regional_nome)}</small></td>
      <td><select class="user-profile">${optionsPerfis(usuario.tipo_usuario)}</select></td>
      <td><select class="user-regional">${optionsRegionais(usuario.regional)}</select></td>
      <td class="row-actions">
        <button type="button" class="btn-save-user">Salvar</button>
        <button type="button" class="btn-danger btn-delete-user">Excluir</button>
      </td>
    </tr>
  `).join("") || '<tr><td colspan="4">Nenhum usuário cadastrado.</td></tr>';
  atualizarResumo();
}

function permissoesAgrupadas(perfil) {
  const grupos = new Map();
  baseAdmin.permissoes.forEach(permissao => {
    if (!grupos.has(permissao.grupo)) grupos.set(permissao.grupo, []);
    grupos.get(permissao.grupo).push(permissao);
  });
  return [...grupos].map(([grupo, permissoes]) => `
    <fieldset><legend>${e(grupo)}</legend>
      ${permissoes.map(permissao => `
        <label class="permission-item">
          <input type="checkbox" value="${e(permissao.chave)}"${perfil.permissoes.includes(permissao.chave) ? " checked" : ""}>
          <span><strong>${e(permissao.nome)}</strong><small>${e(permissao.descricao)}</small></span>
        </label>
      `).join("")}
    </fieldset>
  `).join("");
}

function renderizarPerfis() {
  document.getElementById("listaPerfis").innerHTML = baseAdmin.perfis.map(perfil => `
    <article class="card profile-card" data-perfil-id="${perfil.id}">
      <div class="profile-head">
        <div><span class="profile-key">${e(perfil.chave)}</span><input class="profile-name" value="${e(perfil.nome)}" maxlength="100"></div>
        <span class="count-badge">${perfil.total_usuarios} usuário(s)</span>
      </div>
      <input class="profile-description" value="${e(perfil.descricao || "")}" maxlength="255" placeholder="Descrição do perfil">
      <div class="permissions-grid">${permissoesAgrupadas(perfil)}</div>
      <div class="card-actions">
        <button type="button" class="btn-save-profile">Salvar permissões</button>
        ${perfil.sistema ? '<span class="system-badge">Perfil padrão</span>' : '<button type="button" class="btn-danger btn-delete-profile">Excluir perfil</button>'}
      </div>
    </article>
  `).join("");
}

function renderizarRegionais() {
  document.getElementById("listaRegionais").innerHTML = baseAdmin.regionais.map(regional => {
    const emUso = Number(regional.total_usuarios) + Number(regional.total_configuracoes)
      + Number(regional.total_solicitacoes) + Number(regional.total_asbuilt) > 0;
    return `
      <article class="card regional-card" data-regional-id="${regional.id}">
        <div><span>${e(regional.codigo)}</span><h3>${e(regional.nome)}</h3></div>
        <div class="regional-metrics">
          <span><strong>${regional.total_usuarios}</strong> usuários</span>
          <span><strong>${regional.total_configuracoes}</strong> configurações</span>
          <span><strong>${regional.total_solicitacoes}</strong> solicitações</span>
          <span><strong>${regional.total_asbuilt}</strong> As-Built</span>
        </div>
        <button type="button" class="btn-danger btn-delete-regional"${emUso ? " disabled" : ""}>
          ${emUso ? "Regional em uso" : "Excluir regional"}
        </button>
      </article>
    `;
  }).join("");
}

document.querySelectorAll("[data-tab]").forEach(botao => botao.addEventListener("click", () => ativarAba(botao.dataset.tab)));

document.getElementById("formUsuario").addEventListener("submit", async event => {
  event.preventDefault();
  const formulario = event.currentTarget;
  try {
    const data = await requisicao("/api/usuarios", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: document.getElementById("nome").value,
        senha: document.getElementById("senha").value,
        tipo_usuario: document.getElementById("tipoUsuario").value,
        regional: document.getElementById("regional").value
      })
    });
    formulario.reset();
    msgSucesso(data.message);
    await carregarUsuarios();
    await carregarBase();
  } catch (error) { msgErro(error.message); }
});

document.getElementById("formNovoPerfil").addEventListener("submit", async event => {
  event.preventDefault();
  const formulario = event.currentTarget;
  try {
    const data = await requisicao("/api/admin/perfis", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: document.getElementById("perfilNome").value,
        chave: document.getElementById("perfilChave").value,
        descricao: document.getElementById("perfilDescricao").value,
        permissoes: []
      })
    });
    formulario.reset();
    msgSucesso(data.message);
    await carregarBase();
  } catch (error) { msgErro(error.message); }
});

document.getElementById("formRegional").addEventListener("submit", async event => {
  event.preventDefault();
  const formulario = event.currentTarget;
  try {
    const data = await requisicao("/api/admin/regionais", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codigo: document.getElementById("regionalCodigo").value,
        nome: document.getElementById("regionalNome").value
      })
    });
    formulario.reset();
    msgSucesso(data.message);
    await carregarBase();
  } catch (error) { msgErro(error.message); }
});

document.addEventListener("click", async event => {
  try {
    const linhaUsuario = event.target.closest("[data-usuario-id]");
    if (event.target.matches(".btn-save-user")) {
      const data = await requisicao(`/api/usuarios/${linhaUsuario.dataset.usuarioId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo_usuario: linhaUsuario.querySelector(".user-profile").value,
          regional: linhaUsuario.querySelector(".user-regional").value
        })
      });
      msgSucesso(data.message);
      await carregarUsuarios();
    }
    if (event.target.matches(".btn-delete-user") && confirm("Excluir este usuário?")) {
      const data = await requisicao(`/api/usuarios/${linhaUsuario.dataset.usuarioId}`, { method: "DELETE" });
      msgSucesso(data.message);
      await carregarUsuarios();
      await carregarBase();
    }

    const cardPerfil = event.target.closest("[data-perfil-id]");
    if (event.target.matches(".btn-save-profile")) {
      const data = await requisicao(`/api/admin/perfis/${cardPerfil.dataset.perfilId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: cardPerfil.querySelector(".profile-name").value,
          descricao: cardPerfil.querySelector(".profile-description").value,
          permissoes: [...cardPerfil.querySelectorAll('input[type="checkbox"]:checked')].map(input => input.value)
        })
      });
      msgSucesso(data.message);
      await carregarBase();
    }
    if (event.target.matches(".btn-delete-profile") && confirm("Excluir este perfil?")) {
      const data = await requisicao(`/api/admin/perfis/${cardPerfil.dataset.perfilId}`, { method: "DELETE" });
      msgSucesso(data.message);
      await carregarBase();
    }

    const cardRegional = event.target.closest("[data-regional-id]");
    if (event.target.matches(".btn-delete-regional") && confirm("Excluir esta regional?")) {
      const data = await requisicao(`/api/admin/regionais/${cardRegional.dataset.regionalId}`, { method: "DELETE" });
      msgSucesso(data.message);
      await carregarBase();
    }
  } catch (error) { msgErro(error.message); }
});

document.addEventListener("usuario-carregado", async event => {
  usuarioAtualAdmin = event.detail;
  configurarAbas();
  try {
    await carregarBase();
    await carregarUsuarios();
  } catch (error) {
    msgErro(error.message);
  }
});
