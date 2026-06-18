let latestResults = [];

const elements = {
    currentStatus: document.querySelector('#currentStatus'),
    lastFinished: document.querySelector('#lastFinished'),
    updatedCount: document.querySelector('#updatedCount'),
    nextRun: document.querySelector('#nextRun'),
    scheduleEnabled: document.querySelector('#scheduleEnabled'),
    scheduleTimes: document.querySelector('#scheduleTimes'),
    queryResults: document.querySelector('#queryResults'),
    syncLogs: document.querySelector('#syncLogs'),
    toast: document.querySelector('#toast')
};

function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('pt-BR');
}

function showToast(message, type = 'success') {
    elements.toast.textContent = message;
    elements.toast.className = `visible ${type}`;
    setTimeout(() => { elements.toast.className = ''; }, 3500);
}

async function api(url, options = {}) {
    const response = await fetch(url, {
        credentials: 'include',
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'authorization': 'Basic SjQwODIxNDQ5OjEwOTFabl8kKnBgIy1TQVA',
            ...(options.headers || {})
        }
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || payload.message || 'Falha na requisição');
    return payload;
}

function cell(text, className = '') {
    const td = document.createElement('td');
    td.textContent = text ?? '-';
    if (className) td.className = className;
    return td;
}

function renderResults(results) {
    latestResults = results;
    elements.queryResults.replaceChildren();

    if (!results.length) {
        const row = document.createElement('tr');
        const empty = cell('Nenhum resultado retornado.', 'empty');
        empty.colSpan = 5;
        row.appendChild(empty);
        elements.queryResults.appendChild(row);
        return;
    }

    results.forEach(result => {
        const row = document.createElement('tr');
        const summary = result.status === 'erro'
            ? result.error
            : JSON.stringify(result.data).slice(0, 300);
        row.append(
            cell(result.id),
            cell(result.endpoint),
            cell(result.status, `status ${result.status}`),
            cell(summary),
            cell(formatDate(result.timestamp))
        );
        elements.queryResults.appendChild(row);
    });
}

function renderLogs(logs) {
    elements.syncLogs.replaceChildren();
    if (!logs.length) {
        const row = document.createElement('tr');
        const empty = cell('Sem logs disponíveis.', 'empty');
        empty.colSpan = 4;
        row.appendChild(empty);
        elements.syncLogs.appendChild(row);
        return;
    }

    logs.forEach(log => {
        const row = document.createElement('tr');
        row.append(
            cell(formatDate(log.created_at)),
            cell(log.level, `status ${log.level}`),
            cell(log.project_key),
            cell(log.message)
        );
        elements.syncLogs.appendChild(row);
    });
}

async function loadStatus(showMessage = false) {
    try {
        const status = await api('/api/sgo/status');
        const lastRun = status.lastRun;
        elements.currentStatus.textContent = status.inProgress
            ? 'Em andamento'
            : lastRun?.status || 'Sem execução';
        elements.lastFinished.textContent = formatDate(lastRun?.finished_at);
        elements.updatedCount.textContent = String((lastRun?.updated_projects || 0) + (lastRun?.inserted_projects || 0));
        elements.nextRun.textContent = formatDate(status.nextRun);
        elements.scheduleEnabled.checked = Boolean(status.settings?.enabled);
        elements.scheduleTimes.value = (status.settings?.times || []).join(', ');
        renderLogs(status.logs || []);
        if (showMessage) showToast('Status atualizado.');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

document.querySelector('#runQuery').addEventListener('click', async event => {
    const button = event.currentTarget;
    const ids = document.querySelector('#queryIds').value.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
    if (!ids.length) return showToast('Informe ao menos um identificador.', 'error');

    button.disabled = true;
    button.textContent = 'Consultando...';
    try {
        const payload = await api('/api/sgo/query', {
            method: 'POST',
            body: JSON.stringify({ type: document.querySelector('#queryType').value, ids })
        });
        renderResults(payload.results || []);
        showToast(`Consulta concluída: ${payload.results?.length || 0} resposta(s).`);
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        button.disabled = false;
        button.textContent = 'Executar consulta';
    }
});

document.querySelector('#manualSync').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
        const ids = document.querySelector('#queryIds').value.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
        await api('/api/sgo/sync', { method: 'POST', body: JSON.stringify({ ids }) });
        showToast('Atualização iniciada. Os logs serão atualizados automaticamente.');
        await loadStatus();
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        button.disabled = false;
    }
});

document.querySelector('#saveSchedule').addEventListener('click', async () => {
    try {
        const times = elements.scheduleTimes.value.split(',').map(value => value.trim()).filter(Boolean);
        await api('/api/sgo/settings', {
            method: 'PUT',
            body: JSON.stringify({ enabled: elements.scheduleEnabled.checked, times })
        });
        showToast('Agenda salva.');
        await loadStatus();
    } catch (error) {
        showToast(error.message, 'error');
    }
});

document.querySelector('#refreshStatus').addEventListener('click', () => loadStatus(true));
document.querySelector('#downloadResults').addEventListener('click', () => {
    if (!latestResults.length) return showToast('Não há resultados para exportar.', 'error');
    const blob = new Blob([JSON.stringify(latestResults, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sgo_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
});

loadStatus();
setInterval(loadStatus, 10000);
