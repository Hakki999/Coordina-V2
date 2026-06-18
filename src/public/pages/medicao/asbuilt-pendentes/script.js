let pendentes = [];
const escapar = valor => String(valor ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
async function api(url, options = {}) {
  const response = await fetch(url, { credentials: "include", ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Falha na operação.");
  return data;
}
function dataBr(valor) { return valor ? new Date(`${String(valor).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "-"; }
function renderizar() {
  const busca = document.getElementById("busca").value.toLocaleLowerCase("pt-BR");
  const lista = pendentes.filter(item => !busca || [item.projeto, item.cidade, item.localizacao, item.observacao].some(valor => String(valor || "").toLocaleLowerCase("pt-BR").includes(busca)));
  document.getElementById("contador").textContent = `${lista.length} projeto(s)`;
  document.getElementById("tabela").innerHTML = lista.length ? lista.map(item => `<tr>
    <td><strong>${escapar(item.projeto)}</strong></td><td>${dataBr(item.data_conclusao)}</td>
    <td><span class="age ${Number(item.tempo_finalizado_dias) > 30 ? "late" : ""}">${item.tempo_finalizado_dias} dia(s)</span></td>
    <td>${escapar(item.cidade || "-")}</td><td>${escapar(item.localizacao || "-")}</td><td>${item.precisa_ir_campo ? "Sim" : "Não"}</td>
    <td>${escapar(item.observacao || "-")}</td><td>${item.pdf_nome ? `<a href="/api/asbuilt-pendentes/${item.id}/pdf">Abrir PDF</a>` : "-"}</td>
    <td>${escapar(item.criado_por_nome || "-")}</td><td class="actions"><a class="transfer" href="/controle-asbuilt?projeto=${encodeURIComponent(item.projeto)}">Adicionar ao controle</a><button class="delete" data-id="${item.id}">Excluir</button></td></tr>`).join("")
    : '<tr><td colspan="10" class="empty">Nenhum projeto pendente.</td></tr>';
}
async function carregar() { try { pendentes = await api("/api/asbuilt-pendentes"); renderizar(); } catch (error) { msgErro(error.message); } }
async function enviarPdf(id, arquivo) {
  const response = await fetch(`/api/asbuilt-pendentes/${id}/pdf`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/pdf", "X-File-Name": encodeURIComponent(arquivo.name) }, body: arquivo });
  const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Erro ao anexar PDF.");
}
document.getElementById("btnNovo").addEventListener("click", () => { document.getElementById("modal").hidden = false; document.getElementById("projeto").focus(); });
document.getElementById("btnCancelar").addEventListener("click", () => { document.getElementById("modal").hidden = true; });
document.getElementById("busca").addEventListener("input", renderizar);
document.getElementById("formProjeto").addEventListener("submit", async event => {
  event.preventDefault(); const formulario = event.currentTarget; const arquivo = document.getElementById("pdf").files[0]; const precisa = document.getElementById("precisaCampo").checked;
  if (precisa && !arquivo) return msgAviso("Inclua o PDF do projeto que precisa de ida a campo.");
  try {
    const novo = await api("/api/asbuilt-pendentes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      projeto: document.getElementById("projeto").value, data_conclusao: document.getElementById("dataConclusao").value,
      cidade: document.getElementById("cidade").value, localizacao: document.getElementById("localizacao").value,
      precisa_ir_campo: precisa, observacao: document.getElementById("observacao").value
    }) });
    if (arquivo) await enviarPdf(novo.id, arquivo);
    formulario.reset(); document.getElementById("modal").hidden = true; await carregar(); msgSucesso("Projeto adicionado.");
  } catch (error) { msgErro(error.message); }
});
document.getElementById("tabela").addEventListener("click", async event => {
  if (!event.target.dataset.id || !confirm("Excluir este projeto pendente?")) return;
  try { await api(`/api/asbuilt-pendentes/${event.target.dataset.id}`, { method: "DELETE" }); await carregar(); } catch (error) { msgErro(error.message); }
});
carregar();
