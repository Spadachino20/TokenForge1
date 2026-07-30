let usageChart = null;
let currentCurrency = 'usd';

// Chart.js draws to canvas and cannot read CSS variables, so the palette is
// mirrored here. Keep in step with css/base.css.
const CHART_INK_MUTED = '#93969f';
const CHART_INK_FAINT = '#7a7d87';
const CHART_GRID = 'rgba(255,255,255,0.06)';

const ICON = {
  purchase: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18"/></svg>',
  usage: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
  key: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="12" r="3.2"/><path d="M11.2 12H21M18 12v3M15 12v2"/></svg>',
  folder: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h3.6l2 2.4H19a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  card: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18"/></svg>'
};

const EMPTY = {
  keys: `<div class="db-empty">${ICON.key}No API keys yet. Create one to get started.</div>`,
  projects: `<div class="db-empty">${ICON.folder}No projects yet. Create one to track usage separately.</div>`,
  billing: `<div class="db-empty">${ICON.card}No transactions yet.</div>`
};

async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = 'login.html'; throw new Error('No token'); }
    options.headers = { ...options.headers, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    const res = await fetch(`${API_URL}${url}`, options);
    if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
        throw new Error('Unauthorized');
    }
    return res;
}

// ── MODAL SYSTEM ──────────────────────────────────────────────
function showModal({ title, message, inputPlaceholder = null, confirmText = 'Confirm', confirmDanger = false, onConfirm }) {
  const existing = document.getElementById('tf-modal');
  if (existing) existing.remove();
  const hasInput = inputPlaceholder !== null;
  const modal = document.createElement('div');
  modal.id = 'tf-modal';
  modal.className = 'tf-modal-backdrop';
  modal.innerHTML = `
    <div class="tf-modal" role="dialog" aria-modal="true" aria-labelledby="tf-modal-title">
      <h3 id="tf-modal-title">${title}</h3>
      <div class="tf-modal-body">
        <p>${message}</p>
        ${hasInput ? `<input id="tf-modal-input" class="tf-modal-input" type="text" placeholder="${inputPlaceholder}"/>` : ''}
      </div>
      <div class="tf-modal-actions">
        <button id="tf-modal-cancel" class="tf-modal-btn">Cancel</button>
        <button id="tf-modal-confirm" class="tf-modal-btn ${confirmDanger ? 'danger' : 'confirm'}">${confirmText}</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const input = document.getElementById('tf-modal-input');
  if (input) { input.focus(); input.addEventListener('keydown', e => { if (e.key === 'Enter') handleConfirm(); }); }
  else { document.getElementById('tf-modal-confirm').focus(); }
  function handleConfirm() { const val = input ? input.value.trim() : null; close(); onConfirm(val); }
  function close() { document.removeEventListener('keydown', onKeydown); modal.remove(); }
  function onKeydown(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKeydown);
  document.getElementById('tf-modal-confirm').addEventListener('click', handleConfirm);
  document.getElementById('tf-modal-cancel').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
}

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (!token) { window.location.href = 'login.html'; return; }
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  document.getElementById('userEmail').textContent = user.email || '';

  document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
  });

  document.querySelectorAll('.db-sidebar a').forEach(link => {
    link.addEventListener('click', (e) => { e.preventDefault(); switchSection(e.currentTarget.dataset.section); });
  });

  document.querySelectorAll('.db-filter[data-period]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.db-filter[data-period]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (btn.dataset.period === 'date') {
        showModal({
          title: 'Pick a Date', message: 'Enter date (YYYY-MM-DD)',
          inputPlaceholder: new Date().toISOString().split('T')[0], confirmText: 'Load',
          onConfirm: (val) => { if (val) loadChart('date', val); }
        });
      } else { loadChart(btn.dataset.period); }
    });
  });

  document.getElementById('addCreditsBtn').addEventListener('click', () => {
    document.getElementById('rechargeConfirm').style.display = 'block';
    document.getElementById('rechargeConfirmAmount').textContent = `$${document.getElementById('rechargeAmountInput').value || '10'}`;
  });

  document.getElementById('continueRechargeBtn').addEventListener('click', () => {
    const amount = parseInt(document.getElementById('rechargeAmountInput').value, 10);
    const safeAmount = Number.isNaN(amount) || amount < 1 ? 10 : amount;
    document.getElementById('rechargeConfirm').style.display = 'block';
    document.getElementById('rechargeConfirmAmount').textContent = `$${safeAmount}`;
  });

  document.getElementById('confirmRechargeBtn').addEventListener('click', () => {
    const amount = parseInt(document.getElementById('rechargeAmountInput').value, 10);
    const safeAmount = Number.isNaN(amount) || amount < 1 ? 10 : amount;
    if (typeof pagarConCrypto === 'function') {
      pagarConCrypto(safeAmount);
    }
  });

  document.getElementById('cancelRechargeBtn').addEventListener('click', () => {
    document.getElementById('rechargeConfirm').style.display = 'none';
  });

  document.getElementById('createKeyBtn').addEventListener('click', () => {
    showModal({
      title: 'New API Key', message: 'Give your key a name to identify it.', inputPlaceholder: 'Production', confirmText: 'Create Key',
      onConfirm: (val) => { if (val) createKey(val); }
    });
  });

  const createProjectBtn = document.getElementById('createProjectBtn');
  if (createProjectBtn) {
    createProjectBtn.addEventListener('click', () => {
      showModal({
        title: 'New Project', message: 'Enter a name for your project', inputPlaceholder: 'My Project', confirmText: 'Next',
        onConfirm: (name) => {
          if (!name) return;
          showModal({
            title: 'Project Budget', message: 'Set a TFC budget limit (leave 0 for unlimited)', inputPlaceholder: '0', confirmText: 'Create',
            onConfirm: async (budgetStr) => {
              const budget = parseFloat(budgetStr);
              if (isNaN(budget) || budget < 0) return;
              try {
                const res = await fetchWithAuth('/projects', { method: 'POST', body: JSON.stringify({ name, monthly_budget_tfc: budget }) });
                if (!res.ok) throw new Error('Create failed');
                loadProjects();
              } catch (err) { alert('Unable to create project'); }
            }
          });
        }
      });
    });
  }

  loadAll();
});

function switchSection(section) {
  document.querySelectorAll('.db-sidebar a').forEach(a => a.classList.toggle('active', a.dataset.section === section));
  document.querySelectorAll('.db-section').forEach(s => s.classList.remove('active'));
  document.getElementById(`section-${section}`).classList.add('active');
  if (section === 'keys') loadKeys();
  if (section === 'billing') loadBilling();
  if (section === 'projects') loadProjects();
}

function loadAll() { loadBalance(); loadChart('today'); }

function setCurrency(c) {
  currentCurrency = c;
  document.getElementById('currencyUsd').classList.toggle('active', c === 'usd');
  document.getElementById('currencyTfc').classList.toggle('active', c === 'tfc');
  const activePeriod = document.querySelector('.db-filter[data-period].active');
  loadChart(activePeriod ? activePeriod.dataset.period : 'today');
}

// ── BALANCE ───────────────────────────────────────────────────
async function loadBalance() {
  try {
    const res = await fetchWithAuth('/billing/balance');
    const data = await res.json();
    const bal = parseFloat(data.balance_tfc) || 0;
    document.getElementById('balanceTfc').textContent = `${bal.toFixed(4)} TFC`;
    document.getElementById('balanceUsd').textContent = `$${bal.toFixed(2)} USD`;
    const pct = bal > 0 ? Math.min(100, (bal / (bal + 1)) * 100) : 0;
    document.getElementById('balanceBar').style.width = `${pct}%`;
    document.getElementById('balancePct').textContent = bal > 0 ? `${bal.toFixed(2)} TFC remaining` : 'No balance';
  } catch (err) { console.error('Balance error:', err); }
}

// ── CHART ─────────────────────────────────────────────────────
async function loadChart(period, date = null) {
  try {
    const url = `/usage/summary?period=${period}${date ? '&date=' + date : ''}&currency=${currentCurrency}`;
    const res = await fetchWithAuth(url);
    const data = await res.json();
    const canvas = document.getElementById('usageChart');
    const empty = document.getElementById('chartEmpty');

    if (!data.labels || data.labels.length === 0) {
      canvas.style.display = 'none';
      if (empty) empty.style.display = 'block';
      return;
    }
    canvas.style.display = 'block';
    if (empty) empty.style.display = 'none';
    if (usageChart) usageChart.destroy();

    usageChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: data.datasets.map(ds => ({ label: ds.model, data: ds.data, borderColor: ds.color, backgroundColor: 'transparent', tension: 0.4, pointRadius: 3 }))
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: CHART_INK_MUTED, font: { size: 11 }, boxWidth: 10, boxHeight: 10, usePointStyle: true } },
          tooltip: { callbacks: { label: (ctx) => {
            const val = ctx.parsed.y;
            return currentCurrency === 'usd' ? ` ${ctx.dataset.label}: $${val.toFixed(6)}` : ` ${ctx.dataset.label}: ${val.toFixed(6)} TFC`;
          }}}
        },
        scales: {
          x: { ticks: { color: CHART_INK_FAINT }, grid: { color: CHART_GRID }, border: { color: CHART_GRID } },
          y: { ticks: { color: CHART_INK_FAINT, callback: (val) => currentCurrency === 'usd' ? `$${val}` : `${val} TFC` }, grid: { color: CHART_GRID }, border: { color: CHART_GRID } }
        }
      }
    });
  } catch (err) {
    document.getElementById('usageChart').style.display = 'none';
    const empty = document.getElementById('chartEmpty');
    if (empty) empty.style.display = 'block';
  }
}

// ── API KEYS ──────────────────────────────────────────────────
async function loadKeys() {
  try {
    const res = await fetchWithAuth('/auth/keys');
    const data = await res.json();
    const container = document.getElementById('keysList');
    const activeKeys = (data.keys || []).filter(k => k.is_active);

    if (activeKeys.length === 0) {
      container.innerHTML = EMPTY.keys;
      return;
    }

    container.innerHTML = activeKeys.map(key => `
      <div class="db-key-row" id="key-row-${key.id}">
        <div>
          <div class="db-key-name">${key.name}</div>
          <div class="db-key-meta">
            Created ${new Date(key.created_at).toLocaleDateString()} ·
            ${key.last_used_at ? 'Last used ' + new Date(key.last_used_at).toLocaleDateString() : 'Never used'} ·
            ${key.project_id ? `<span class="tag-project">${key.project_name || 'Project'}</span>` : '<span class="tag-master">Master Key</span>'}
          </div>
        </div>
        <div class="db-key-actions">
          <span class="db-badge active">Active</span>
          <button class="db-btn" onclick="editKey('${key.id}','${key.name}')">Edit</button>
          <button class="db-btn danger" onclick="deleteKey('${key.id}','${key.name}')">Delete</button>
        </div>
      </div>
    `).join('');
  } catch (err) { console.error('Keys error:', err); }
}

async function createKey(name) {
  try {
    const projRes = await fetchWithAuth('/projects');
    const projData = await projRes.json();
    const projects = projData.projects || [];

    const doCreate = async (project_id) => {
      const res = await fetchWithAuth('/auth/keys', { method: 'POST', body: JSON.stringify({ name, project_id }) });
      const data = await res.json();
      if (data.key) {
        showModal({
          title: 'Save Your API Key',
          message: `Copy it now — won't be shown again:<br><br><code>${data.key.value}</code><br><br>${project_id ? 'Assigned to project' : 'Master Key — works on all projects'}`,
          confirmText: 'Done', onConfirm: () => loadKeys()
        });
      }
    };

    if (projects.length === 0) { doCreate(null); return; }
    const projectOptions = projects.map((p, i) => `<span class="tag-master">${i+1}. ${p.name}</span>`).join('<br>');

    showModal({
      title: 'Assign to Project (optional)',
      message: `Type the project number to assign, or leave blank for Master Key:<br><br>${projectOptions}`,
      inputPlaceholder: 'Leave blank for Master Key', confirmText: 'Create Key',
      onConfirm: (val) => {
        let project_id = null;
        if (val && val.trim() !== '') {
          const idx = parseInt(val.trim()) - 1;
          if (!isNaN(idx) && projects[idx]) project_id = projects[idx].id;
        }
        doCreate(project_id);
      }
    });
  } catch (err) { alert('Failed to create key'); }
}

function editKey(keyId, currentName) {
  showModal({
    title: 'Rename API Key', message: `Current name: <strong>${currentName}</strong>`,
    inputPlaceholder: currentName, confirmText: 'Save',
    onConfirm: (val) => { if (val && val !== currentName) renameKey(keyId, val); }
  });
}

async function renameKey(keyId, name) {
  try {
    await fetchWithAuth(`/auth/keys/${keyId}`, { method: 'PATCH', body: JSON.stringify({ action: 'rename', name }) });
    loadKeys();
  } catch (err) { alert('Failed to rename key'); }
}

function deleteKey(keyId, keyName) {
  showModal({
    title: 'Delete API Key', message: `Are you sure you want to delete <strong>${keyName}</strong>? Any apps using this key will stop working.`,
    confirmText: 'Delete', confirmDanger: true,
    onConfirm: async () => {
      try {
        await fetchWithAuth(`/auth/keys/${keyId}`, { method: 'PATCH', body: JSON.stringify({ action: 'revoke' }) });
        const row = document.getElementById(`key-row-${keyId}`);
        if (row) row.remove();
        const container = document.getElementById('keysList');
        if (!container.querySelector('.db-key-row')) container.innerHTML = EMPTY.keys;
      } catch (err) { alert('Failed to delete key'); }
    }
  });
}

// ── PROJECTS ──────────────────────────────────────────────────
async function loadProjects() {
  try {
    const res = await fetchWithAuth('/projects');
    const data = await res.json();
    const container = document.getElementById('projectsList');

    if (!data.projects || data.projects.length === 0) {
      container.innerHTML = EMPTY.projects;
      return;
    }

    container.innerHTML = data.projects.map(p => {
      const used = parseFloat(p.used_tfc) || 0;
      const budget = parseFloat(p.monthly_budget_tfc) || 0;
      const unlimited = budget === 0;
      const usedPct = unlimited ? 100 : Math.min(100, (used / budget) * 100);
      const remainingPct = unlimited ? 100 : 100 - usedPct;
      const barClass = unlimited ? 'unlimited' : remainingPct > 70 ? 'ok' : remainingPct > 20 ? 'warn' : 'crit';

      return `
        <div class="db-key-row" id="project-${p.id}">
          <div style="flex:1;min-width:0">
            <div class="db-key-name">${p.name}</div>
            <div class="db-key-meta">${used.toFixed(4)} TFC used ${unlimited ? '· <span class="tag-project">Unlimited</span>' : '· of ' + budget.toFixed(2) + ' TFC'}</div>
            <div class="db-proj-bar">
              <div class="db-proj-bar-fill ${barClass}" style="width:${unlimited ? 100 : usedPct}%"></div>
            </div>
          </div>
          <div class="db-key-actions">
            <span class="db-badge ${p.is_active ? 'active' : 'inactive'}">${p.is_active ? 'Active' : 'Inactive'}</span>
            <button class="db-btn" onclick="editProject('${p.id}','${p.name}',${budget})">Edit</button>
            <button class="db-btn danger" onclick="deleteProject('${p.id}','${p.name}')">Delete</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) { console.error('Projects error:', err); }
}

async function editProject(id, currentName, currentBudget) {
  showModal({
    title: 'Edit Project Name', message: `Current name: <strong>${currentName}</strong>`,
    inputPlaceholder: currentName, confirmText: 'Next',
    onConfirm: (newNameVal) => {
      const newName = (newNameVal && newNameVal.trim()) || currentName;
      showModal({
        title: 'Edit Project Budget', message: `Current budget: ${currentBudget.toFixed(2)} TFC (0 = unlimited)`,
        inputPlaceholder: currentBudget.toFixed(2), confirmText: 'Save',
        onConfirm: async (budgetVal) => {
          const newBudget = parseFloat(budgetVal);
          if (isNaN(newBudget) || newBudget < 0) { alert('Budget must be 0 or positive'); return; }
          try {
            const response = await fetchWithAuth(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify({ name: newName, monthly_budget_tfc: newBudget }) });
            if (!response.ok) throw new Error('Patch failed');
            loadProjects();
          } catch (err) { alert('Failed to update project'); }
        }
      });
    }
  });
}

async function deleteProject(id, name) {
  showModal({
    title: 'Delete Project', message: `Are you sure you want to delete <strong>${name}</strong>?`,
    confirmText: 'Delete', confirmDanger: true,
    onConfirm: async () => {
      try { await fetchWithAuth(`/projects/${id}`, { method: 'DELETE' }); loadProjects(); }
      catch (e) { alert('Failed to delete project'); }
    }
  });
}

// ── BILLING ───────────────────────────────────────────────────
async function loadBilling() {
  try {
    const res = await fetchWithAuth('/billing/balance');
    const data = await res.json();
    const container = document.getElementById('billingList');

    if (document.getElementById('balanceTfc')) {
        document.getElementById('balanceTfc').innerText = parseFloat(data.balance_tfc || 0).toFixed(2) + ' TFC';
    }

    if (!data.transactions || data.transactions.length === 0) {
      container.innerHTML = EMPTY.billing;
      return;
    }

    container.innerHTML = data.transactions.map(tx => `
      <div class="db-tx-row">
        <div>
          <div class="db-tx-title">${tx.type === 'purchase' ? ICON.purchase + 'Purchase' : ICON.usage + 'Usage'}</div>
          <div class="db-tx-desc">${tx.description || ''} · ${new Date(tx.created_at).toLocaleDateString()}</div>
        </div>
        <div class="db-tx-amount ${tx.amount_tfc < 0 ? 'negative' : ''}">
          ${tx.amount_tfc > 0 ? '+' : ''}${parseFloat(tx.amount_tfc).toFixed(4)} TFC
        </div>
      </div>
    `).join('');
  } catch (err) { console.error('Billing error:', err); }
}

