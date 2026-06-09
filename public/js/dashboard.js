// Dashboard JavaScript for TokenForge

const API_URL = '';
let usageChart = null;
let currentCurrency = 'usd';

// ── MODAL SYSTEM ──────────────────────────────────────────────
function showModal({ title, message, inputPlaceholder = null, confirmText = 'Confirm', confirmDanger = false, onConfirm }) {
  const existing = document.getElementById('tf-modal');
  if (existing) existing.remove();

  const hasInput = inputPlaceholder !== null;

  const modal = document.createElement('div');
  modal.id = 'tf-modal';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:9999;
    display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);
  `;

  modal.innerHTML = `
    <div style="
      background:#0d0d0d;
      border:1px solid #1F2937;
      border-radius:14px;
      padding:2rem;
      width:100%;max-width:420px;
      margin:1rem;
      box-shadow:0 0 40px rgba(0,212,255,0.08);
    ">
      <h3 style="font-size:1rem;font-weight:700;margin-bottom:0.5rem;color:#fff">${title}</h3>
      <p style="font-size:0.85rem;color:#888;margin-bottom:${hasInput ? '1rem' : '1.5rem'}">${message}</p>
      ${hasInput ? `<input id="tf-modal-input" type="text" placeholder="${inputPlaceholder}" style="
        width:100%;background:#000;border:1px solid #1F2937;border-radius:8px;
        padding:0.65rem 0.9rem;color:#fff;font-size:0.9rem;font-family:inherit;
        outline:none;margin-bottom:1.5rem;
      "/>` : ''}
      <div style="display:flex;gap:0.75rem;justify-content:flex-end">
        <button id="tf-modal-cancel" style="
          padding:0.5rem 1.1rem;border-radius:8px;border:1px solid #1F2937;
          background:transparent;color:#888;font-size:0.85rem;cursor:pointer;font-family:inherit;
        ">Cancel</button>
        <button id="tf-modal-confirm" style="
          padding:0.5rem 1.1rem;border-radius:8px;border:none;font-weight:700;
          font-size:0.85rem;cursor:pointer;font-family:inherit;
          background:${confirmDanger ? '#ef4444' : '#00d4ff'};
          color:${confirmDanger ? '#fff' : '#000'};
        ">${confirmText}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const input = document.getElementById('tf-modal-input');
  if (input) {
    input.focus();
    input.addEventListener('keydown', e => { if (e.key === 'Enter') handleConfirm(); });
  }

  function handleConfirm() {
    const val = input ? input.value.trim() : null;
    modal.remove();
    onConfirm(val);
  }

  document.getElementById('tf-modal-confirm').addEventListener('click', handleConfirm);
  document.getElementById('tf-modal-cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showCreateKeyModal(projects) {
  const existing = document.getElementById('tf-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'tf-modal';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:9999;
    display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);
  `;

  const options = projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

  modal.innerHTML = `
    <div style="
      background:#0d0d0d;
      border:1px solid #1F2937;
      border-radius:14px;
      padding:2rem;
      width:100%;max-width:420px;
      margin:1rem;
      box-shadow:0 0 40px rgba(0,212,255,0.08);
    ">
      <h3 style="font-size:1rem;font-weight:700;margin-bottom:0.5rem;color:#fff">Create New API Key</h3>
      <p style="font-size:0.85rem;color:#888;margin-bottom:1rem">Choose a name and optionally assign it to a project. Leave project empty for a <strong style="color:#f59e0b">Master Key</strong> (works with all projects).</p>
      <label style="display:block;font-size:0.8rem;color:#888;margin-bottom:0.3rem">Key Name</label>
      <input id="tf-key-name" type="text" placeholder="Production" style="
        width:100%;background:#000;border:1px solid #1F2937;border-radius:8px;
        padding:0.65rem 0.9rem;color:#fff;font-size:0.9rem;font-family:inherit;
        outline:none;margin-bottom:1rem;
      "/>
      <label style="display:block;font-size:0.8rem;color:#888;margin-bottom:0.3rem">Project (optional)</label>
      <select id="tf-key-project" style="
        width:100%;background:#000;border:1px solid #1F2937;border-radius:8px;
        padding:0.65rem 0.9rem;color:#fff;font-size:0.9rem;font-family:inherit;
        outline:none;margin-bottom:1.5rem;
      ">
        <option value="">Master Key — works with all projects</option>
        ${options}
      </select>
      <div style="display:flex;gap:0.75rem;justify-content:flex-end">
        <button id="tf-modal-cancel" style="
          padding:0.5rem 1.1rem;border-radius:8px;border:1px solid #1F2937;
          background:transparent;color:#888;font-size:0.85rem;cursor:pointer;font-family:inherit;
        ">Cancel</button>
        <button id="tf-modal-confirm" style="
          padding:0.5rem 1.1rem;border-radius:8px;border:none;font-weight:700;
          font-size:0.85rem;cursor:pointer;font-family:inherit;
          background:#00d4ff;color:#000;
        ">Create Key</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('tf-key-name').focus();

  function handleConfirm() {
    const name = document.getElementById('tf-key-name').value.trim();
    const projectId = document.getElementById('tf-key-project').value || null;
    if (!name) return;
    modal.remove();
    createKey(name, projectId);
  }

  document.getElementById('tf-modal-confirm').addEventListener('click', handleConfirm);
  document.getElementById('tf-modal-cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.getElementById('tf-key-name').addEventListener('keydown', e => { if (e.key === 'Enter') handleConfirm(); });
}

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (!token) { window.location.href = '/login.html'; return; }

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  document.getElementById('userEmail').textContent = user.email || '';

  document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  });

  document.querySelectorAll('.db-sidebar a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      switchSection(e.currentTarget.dataset.section);
    });
  });

  // Chart period filters
  document.querySelectorAll('.db-filter[data-period]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.db-filter[data-period]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (btn.dataset.period === 'date') {
        showModal({
          title: 'Pick a Date',
          message: 'Enter date (YYYY-MM-DD)',
          inputPlaceholder: new Date().toISOString().split('T')[0],
          confirmText: 'Load',
          onConfirm: (val) => { if (val) loadChart('date', val); }
        });
      } else {
        loadChart(btn.dataset.period);
      }
    });
  });

  document.getElementById('addCreditsBtn').addEventListener('click', () => {
    showModal({
      title: 'Add Credits',
      message: 'Enter amount in USD (min $10, max $500)',
      inputPlaceholder: '10',
      confirmText: 'Buy Credits',
      onConfirm: (val) => {
        if (!val) return;
        const num = parseInt(val);
        if (isNaN(num) || num < 10 || num > 500) {
          showModal({ title: 'Invalid Amount', message: 'Amount must be between $10 and $500.', confirmText: 'OK', onConfirm: () => {} });
          return;
        }
        buyCredits(num);
      }
    });
  });

  document.getElementById('createKeyBtn').addEventListener('click', () => {
    showModal({
      title: 'New API Key',
      message: 'Give your key a name to identify it.',
      inputPlaceholder: 'Production',
      confirmText: 'Create Key',
      onConfirm: (val) => {
        if (!val) return;
        createKey(val);
      }
    });
  });

  loadAll();
});

// ── NAVIGATION ────────────────────────────────────────────────
function switchSection(section) {
  document.querySelectorAll('.db-sidebar a').forEach(a => {
    a.classList.toggle('active', a.dataset.section === section);
  });
  document.querySelectorAll('.db-section').forEach(s => s.classList.remove('active'));
  document.getElementById(`section-${section}`).classList.add('active');

  if (section === 'keys') loadKeys();
  if (section === 'billing') loadBilling();
  if (section === 'projects') loadProjects();
}

function loadAll() {
  loadBalance();
  loadChart('today');
}

// ── CURRENCY TOGGLE ───────────────────────────────────────────
function setCurrency(c) {
  currentCurrency = c;
  document.getElementById('currencyUsd').classList.toggle('active', c === 'usd');
  document.getElementById('currencyTfc').classList.toggle('active', c === 'tfc');
  const activePeriod = document.querySelector('.db-filter[data-period].active');
  loadChart(activePeriod ? activePeriod.dataset.period : 'today');
}

// ── BALANCE ───────────────────────────────────────────────────
async function loadBalance() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL}/billing/balance`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const bal = parseFloat(data.balance_tfc) || 0;
    document.getElementById('balanceTfc').textContent = `${bal.toFixed(4)} TFC`;
    document.getElementById('balanceUsd').textContent = `$${bal.toFixed(2)} USD`;
    const pct = bal > 0 ? Math.min(100, (bal / (bal + 1)) * 100) : 0;
    document.getElementById('balanceBar').style.width = `${pct}%`;
    document.getElementById('balancePct').textContent = bal > 0 ? `${bal.toFixed(2)} TFC remaining` : 'No balance';
  } catch (err) {
    console.error('Balance error:', err);
  }
}

// ── CHART ─────────────────────────────────────────────────────
async function loadChart(period, date = null) {
  const token = localStorage.getItem('token');
  try {
    const url = `${API_URL}/usage/summary?period=${period}${date ? '&date=' + date : ''}&currency=${currentCurrency}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const canvas = document.getElementById('usageChart');
    const empty = document.getElementById('chartEmpty');

    if (!data.labels || data.labels.length === 0) {
      canvas.style.display = 'none';
      empty.style.display = 'block';
      return;
    }

    canvas.style.display = 'block';
    empty.style.display = 'none';
    if (usageChart) usageChart.destroy();

    usageChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: data.datasets.map(ds => ({
          label: ds.model,
          data: ds.data,
          borderColor: ds.color,
          backgroundColor: 'transparent',
          tension: 0.4,
          pointRadius: 3,
        }))
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: '#888', font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val = ctx.parsed.y;
                return currentCurrency === 'usd'
                  ? ` ${ctx.dataset.label}: $${val.toFixed(6)}`
                  : ` ${ctx.dataset.label}: ${val.toFixed(6)} TFC`;
              }
            }
          }
        },
        scales: {
          x: { ticks: { color: '#555' }, grid: { color: '#111' } },
          y: {
            ticks: {
              color: '#555',
              callback: (val) => currentCurrency === 'usd' ? `$${val}` : `${val} TFC`
            },
            grid: { color: '#111' }
          }
        }
      }
    });
  } catch (err) {
    document.getElementById('usageChart').style.display = 'none';
    document.getElementById('chartEmpty').style.display = 'block';
  }
}

// ── API KEYS ──────────────────────────────────────────────────
async function loadKeys() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL}/auth/keys`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const container = document.getElementById('keysList');

    const activeKeys = (data.keys || []).filter(k => k.is_active);

    if (activeKeys.length === 0) {
      container.innerHTML = '<div class="db-empty">No API keys yet. Create one to get started.</div>';
      return;
    }

    container.innerHTML = activeKeys.map(key => `
      <div class="db-key-row" id="key-row-${key.id}">
        <div>
         <div class="db-key-meta">
            Created ${new Date(key.created_at).toLocaleDateString()} ·
            ${key.last_used_at ? 'Last used ' + new Date(key.last_used_at).toLocaleDateString() : 'Never used'} ·
            ${key.project_id ? `<span style="color:#00d4ff">📁 ${key.project_name || 'Project'}</span>` : '<span style="color:#888">🔑 Master Key</span>'}
          </div>
        </div>
        <div class="db-key-actions">
          <span class="db-badge active">Active</span>
          <button class="db-btn" onclick="editKey('${key.id}','${key.name}')">Edit</button>
          <button class="db-btn danger" onclick="deleteKey('${key.id}','${key.name}')">Delete</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Keys error:', err);
  }
}

async function createKey(name) {
  const token = localStorage.getItem('token');
  try {
    const projRes = await fetch('/projects', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const projData = await projRes.json();
    const projects = projData.projects || [];

    const doCreate = async (project_id) => {
      const res = await fetch('/auth/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name, project_id })
      });
      const data = await res.json();
      if (data.key) {
        showModal({
          title: '⚠️ Save Your API Key',
          message: `Copy it now — won't be shown again:<br><br><code style="background:#000;padding:0.4rem 0.6rem;border-radius:6px;font-size:0.8rem;color:#00d4ff;word-break:break-all">${data.key.value}</code><br><br>${project_id ? '📁 Assigned to project' : '🔑 Master Key — works on all projects'}`,
          confirmText: 'Done',
          onConfirm: () => loadKeys()
        });
      }
    };

    if (projects.length === 0) {
      doCreate(null);
      return;
    }

    const projectOptions = projects.map((p, i) => 
      `<span style="color:#888">${i+1}. 📁 ${p.name}</span>`
    ).join('<br>');

    showModal({
      title: 'Assign to Project (optional)',
      message: `Type the project number to assign, or leave blank for Master Key:<br><br>${projectOptions}`,
      inputPlaceholder: 'Leave blank for Master Key',
      confirmText: 'Create Key',
      onConfirm: (val) => {
        let project_id = null;
        if (val && val.trim() !== '') {
          const idx = parseInt(val.trim()) - 1;
          if (!isNaN(idx) && projects[idx]) {
            project_id = projects[idx].id;
          }
        }
        doCreate(project_id);
      }
    });
  } catch (err) {
    alert('Failed to create key');
  }
}
function editKey(keyId, currentName) {
  showModal({
    title: 'Rename API Key',
    message: `Current name: <strong style="color:#fff">${currentName}</strong>`,
    inputPlaceholder: currentName,
    confirmText: 'Save',
    onConfirm: (val) => {
      if (!val || val === currentName) return;
      renameKey(keyId, val);
    }
  });
}

async function renameKey(keyId, name) {
  const token = localStorage.getItem('token');
  try {
    await fetch(`${API_URL}/auth/keys/${keyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action: 'rename', name })
    });
    loadKeys();
  } catch (err) {
    alert('Failed to rename key');
  }
}

function deleteKey(keyId, keyName) {
  showModal({
    title: 'Delete API Key',
    message: `Are you sure you want to delete <strong style="color:#fff">${keyName}</strong>? Any apps using this key will stop working.`,
    confirmText: 'Delete',
    confirmDanger: true,
    onConfirm: async () => {
      const token = localStorage.getItem('token');
      try {
        await fetch(`${API_URL}/auth/keys/${keyId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ action: 'revoke' })
        });
        const row = document.getElementById(`key-row-${keyId}`);
        if (row) row.remove();
        const container = document.getElementById('keysList');
        if (!container.querySelector('.db-key-row')) {
          container.innerHTML = '<div class="db-empty">No API keys yet. Create one to get started.</div>';
        }
      } catch (err) {
        alert('Failed to delete key');
      }
    }
  });
}

// ── PROJECTS ──────────────────────────────────────────────────

// *** CUSTOM PROJECTS FUNCTIONS ***
// IDs referenced in dashboard.html (or added):
//   - projectsList  : container for list of projects
//   - createProjectBtn: button in nav to open create modal
//   - createProjectModal: modal container to create project
//   - createProjectForm: form inside modal with inputs name & budget
// *** End ***

async function loadProjects() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL}/projects`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const container = document.getElementById('projectsList');

    if (!data.projects || data.projects.length === 0) {
      container.innerHTML = '<div class="db-empty">No projects yet. Create one to track usage separately.</div>';
      return;
    }

    container.innerHTML = data.projects.map(p => {
      const used = parseFloat(p.used_tfc) || 0;
      const budget = parseFloat(p.monthly_budget_tfc) || 0;
      const usedPct = budget > 0 ? (used / budget) * 100 : 0;
      // Calculate remaining percentage to determine bar color
      const remainingPct = budget > 0 ? 100 - usedPct : 0;
      const barClass = remainingPct > 30 ? 'ok' : remainingPct > 10 ? 'warn' : 'crit';

      return `
        <div class="db-key-row" id="project-${p.id}">
          <div style="flex:1">
            <div class="db-key-name">${p.name}</div>
            <div class="db-key-meta">${used.toFixed(4)} / ${budget.toFixed(2)} TFC used</div>
            <div class="db-proj-bar">
              <div class="db-proj-bar-fill ${barClass}" style="width:${usedPct.toFixed(1)}%"></div>
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
  } catch (err) {
    console.error('Projects error:', err);
  }
}

// Open modal to edit both name and budget
async function editProject(id, currentName, currentBudget) {
  // First ask for a new name (optional)
  const namePrompt = await new Promise(resolve => {
    showModal({
      title: 'Edit Project Name',
      message: `Current name: <strong style="color:#fff">${currentName}</strong>`,
      inputPlaceholder: currentName,
      confirmText: 'Save Name',
      onConfirm: resolve
    });
  });

  const newName = namePrompt?.trim() || currentName;

  // Then ask for a new budget
  const budgetPrompt = await new Promise(resolve => {
    showModal({
      title: 'Edit Project Budget',
      message: `Current budget: ${currentBudget.toFixed(2)} TFC`,
      inputPlaceholder: currentBudget.toFixed(2),
      confirmText: 'Save Budget',
      onConfirm: resolve
    });
  });

  const newBudget = parseFloat(budgetPrompt);
  if (isNaN(newBudget) || newBudget <= 0) {
    alert('Budget must be a positive number');
    return;
  }

  // Validate that the new budget does not exceed available balance
  const token = localStorage.getItem('token');
  try {
    const balRes = await fetch(`${API_URL}/billing/balance`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const balData = await balRes.json();
    const availableBalance = parseFloat(balData.balance_tfc) || 0;
    if (newBudget > availableBalance) {
      showModal({
        title: 'Insufficient Balance',
        message: 'You can only allocate up to your total balance',
        confirmText: 'OK',
        onConfirm: () => {}
      });
      return;
    }
  } catch (e) {
    console.error('Balance check failed:', e);
  }

  // Finally, patch the project with name and budget
  try {
    const response = await fetch(`${API_URL}/projects/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: newName,
        monthly_budget_tfc: newBudget
      })
    });
    if (!response.ok) throw new Error('Patch failed');
    loadProjects(); // Refresh project list
  } catch (err) {
    console.error('Project edit error:', err);
    alert('Failed to update project');
  }
}

async function deleteProject(id, name) {
  showModal({
    title: 'Delete Project',
    message: `Are you sure you want to delete <strong style="color:#fff">${name}</strong>?`,
    confirmText: 'Delete',
    confirmDanger: true,
    onConfirm: async () => {
      const token = localStorage.getItem('token');
      try {
        await fetch(`${API_URL}/projects/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        loadProjects();
      } catch (e) {
        alert('Failed to delete project');
      }
    }
  });
}

// ---- Create project modal handling ----
const createProjectBtn = document.getElementById('createProjectBtn');

if (createProjectBtn) {
  createProjectBtn.addEventListener('click', () => {
    showModal({
      title: 'New Project',
      message: 'Enter a name for your project',
      inputPlaceholder: 'My Project',
      confirmText: 'Next',
      onConfirm: (name) => {
        if (!name) return;
        showModal({
          title: 'Project Budget',
          message: 'Set a TFC budget limit (leave 0 for unlimited)',
          inputPlaceholder: '0',
          confirmText: 'Create',
          onConfirm: async (budgetStr) => {
            const budget = parseFloat(budgetStr);
            if (isNaN(budget) || budget < 0) return;
            const token = localStorage.getItem('token');
            try {
              const res = await fetch('/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name, monthly_budget_tfc: budget })
              });
              if (!res.ok) throw new Error('Create failed');
              loadProjects();
            } catch (err) {
              alert('Unable to create project');
            }
          }
        });
      }
    });
  });
}

// dummy to avoid reference errors
const createProjectModal = null;
const createProjectForm = null;
function clearCreateForm() {}

if (false && createProjectForm) createProjectForm.addEventListener('submit', async e => {
  e.preventDefault();
  const name = e.target.name.value.trim();
  const budget = parseInt(e.target.budget.value, 10);
  if (!name || isNaN(budget) || budget <= 0) return;

  // Validate budget against available balance before creating
  const token = localStorage.getItem('token');
  try {
    const balRes = await fetch(`${API_URL}/billing/balance`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const balData = await balRes.json();
    const availableBalance = parseFloat(balData.balance_tfc) || 0;
    if (budget > availableBalance) {
      showModal({
        title: 'Insufficient Balance',
        message: 'You can only allocate up to your total balance',
        confirmText: 'OK',
        onConfirm: () => {}
      });
      return;
    }
  } catch (e) {
    console.error('Balance check failed:', e);
  }

  try {
    const res = await fetch(`${API_URL}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name, monthly_budget_tfc: budget })
    });
    if (!res.ok) throw new Error('Create failed');
    createProjectModal.style.display = 'none';
    loadProjects();
  } catch (err) {
    alert('Unable to create project');
  }
});

// Close modal helper
const closeModal = () => { if (createProjectModal) createProjectModal.style.display = 'none'; };
[(createProjectModal?.querySelector('.close') ?? document.createElement('div')).addEventListener]??(()=>{});
async function loadProjects() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL}/projects`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const container = document.getElementById('projectsList');

    if (!data.projects || data.projects.length === 0) {
      container.innerHTML = '<div class="db-empty">No projects yet. Create one to track usage separately.</div>';
      return;
    }

container.innerHTML = data.projects.map(p => {
  const used = parseFloat(p.used_tfc) || 0;
  const budget = parseFloat(p.monthly_budget_tfc) || 0;
  const unlimited = budget === 0;
  const usedPct = unlimited ? 100 : Math.min(100, (used / budget) * 100);
  const remainingPct = unlimited ? 100 : 100 - usedPct;
  const barColor = unlimited ? '#00d4ff'
    : remainingPct > 70 ? '#22c55e'
    : remainingPct > 20 ? '#f59e0b'
    : '#ef4444';

  return `
    <div class="db-key-row" id="project-${p.id}">
      <div style="flex:1">
        <div class="db-key-name">${p.name}</div>
        <div class="db-key-meta">${used.toFixed(4)} TFC used ${unlimited ? '· <span style="color:#00d4ff">Unlimited</span>' : '· of ' + budget.toFixed(2) + ' TFC'}</div>
        <div class="db-proj-bar">
          <div style="height:100%;width:${unlimited ? 100 : usedPct}%;background:${barColor};border-radius:100px;transition:width 0.5s"></div>
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
  } catch (err) {
    console.error('Projects error:', err);
  }
}

function editProjectBudget(id, name, current) {
  showModal({
    title: 'Edit Budget',
    message: `Set monthly budget for <strong style="color:#fff">${name}</strong> (TFC)`,
    inputPlaceholder: current,
    confirmText: 'Save',
    onConfirm: (val) => {
      if (!val) return;
      updateProjectBudget(id, parseFloat(val));
    }
  });
}

async function updateProjectBudget(id, budget) {
  const token = localStorage.getItem('token');
  try {
    await fetch(`${API_URL}/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ monthly_budget_tfc: budget })
    });
    loadProjects();
  } catch (err) {
    alert('Failed to update budget');
  }
}

// ── BILLING ───────────────────────────────────────────────────
async function loadBilling() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL}/billing/balance`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const container = document.getElementById('billingList');

    if (!data.transactions || data.transactions.length === 0) {
      container.innerHTML = '<div class="db-empty">No transactions yet.</div>';
      return;
    }

    container.innerHTML = data.transactions.map(tx => `
      <div class="db-tx-row">
        <div>
          <div style="font-weight:600;font-size:0.9rem">${tx.type === 'purchase' ? '💳 Purchase' : '⚡ Usage'}</div>
          <div class="db-tx-desc">${tx.description || ''} · ${new Date(tx.created_at).toLocaleDateString()}</div>
        </div>
        <div class="db-tx-amount ${tx.amount_tfc < 0 ? 'negative' : ''}">
          ${tx.amount_tfc > 0 ? '+' : ''}${parseFloat(tx.amount_tfc).toFixed(4)} TFC
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Billing error:', err);
  }
}

async function buyCredits(amount) {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL}/billing/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ amount })
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  } catch (err) {
    alert('Failed to create checkout session');
  }
}