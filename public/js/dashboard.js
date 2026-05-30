// Dashboard JavaScript for TokenForge

const API_URL = '';
let usageChart = null;

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (!token) { window.location.href = '/login.html'; return; }

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  document.getElementById('userEmail').textContent = user.email || '';

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  });

  // Sidebar navigation
  document.querySelectorAll('.db-sidebar a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = e.currentTarget.dataset.section;
      switchSection(section);
    });
  });

  // Chart filters
  document.querySelectorAll('.db-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.db-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadChart(btn.dataset.period);
    });
  });

  // Add credits
  document.getElementById('addCreditsBtn').addEventListener('click', () => {
    const amount = prompt('Enter amount in USD (min $10, max $500):', '10');
    if (!amount) return;
    const num = parseInt(amount);
    if (num < 10 || num > 500) { alert('Amount must be between $10 and $500'); return; }
    buyCredits(num);
  });

  // Create key
  document.getElementById('createKeyBtn').addEventListener('click', () => {
    const name = prompt('API Key name:', 'Production');
    if (!name) return;
    createKey(name);
  });

  loadAll();
});

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

    // Bar — needs initial balance to calculate %
    // For now show full bar if > 0
    const pct = bal > 0 ? Math.min(100, (bal / (bal + 1)) * 100) : 0;
    document.getElementById('balanceBar').style.width = `${pct}%`;
    document.getElementById('balancePct').textContent = bal > 0 ? `${bal.toFixed(2)} TFC remaining` : 'No balance';
  } catch (err) {
    console.error('Balance error:', err);
  }
}

async function loadChart(period) {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL}/usage/summary?period=${period}`, {
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
        datasets: data.datasets.map((ds, i) => ({
          label: ds.model,
          data: ds.data,
          borderColor: ['#00d4ff','#22c55e','#f59e0b','#a855f7','#ef4444'][i % 5],
          backgroundColor: 'transparent',
          tension: 0.4,
          pointRadius: 3,
        }))
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: '#888', font: { size: 11 } } }
        },
        scales: {
          x: { ticks: { color: '#555' }, grid: { color: '#111' } },
          y: { ticks: { color: '#555' }, grid: { color: '#111' } }
        }
      }
    });
  } catch (err) {
    document.getElementById('usageChart').style.display = 'none';
    document.getElementById('chartEmpty').style.display = 'block';
  }
}

async function loadKeys() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL}/auth/keys`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const container = document.getElementById('keysList');

    if (!data.keys || data.keys.length === 0) {
      container.innerHTML = '<div class="db-empty">No API keys yet. Create one to get started.</div>';
      return;
    }

    container.innerHTML = data.keys.map(key => `
      <div class="db-key-row">
        <div>
          <div class="db-key-name">${key.name}</div>
          <div class="db-key-meta">
            Created ${new Date(key.created_at).toLocaleDateString()} · 
            ${key.last_used_at ? 'Last used ' + new Date(key.last_used_at).toLocaleDateString() : 'Never used'}
          </div>
        </div>
        <div class="db-key-actions">
          <span class="db-badge ${key.is_active ? 'active' : 'inactive'}">
            ${key.is_active ? 'Active' : 'Revoked'}
          </span>
          <button class="db-btn" onclick="editKey('${key.id}','${key.name}')">Edit</button>
          <button class="db-btn danger" onclick="revokeKey('${key.id}')">Revoke</button>
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
    const res = await fetch(`${API_URL}/auth/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (data.key) {
      alert(`Your new API key:\n\n${data.key.value}\n\n⚠️ Save this now — it won't be shown again.`);
      loadKeys();
    }
  } catch (err) {
    alert('Failed to create key');
  }
}

async function revokeKey(keyId) {
  if (!confirm('Revoke this key? This cannot be undone.')) return;
  const token = localStorage.getItem('token');
  try {
    await fetch(`${API_URL}/auth/keys/${keyId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    loadKeys();
  } catch (err) {
    alert('Failed to revoke key');
  }
}

function editKey(keyId, currentName) {
  const newName = prompt('New name:', currentName);
  if (!newName || newName === currentName) return;
  renameKey(keyId, newName);
}

async function renameKey(keyId, name) {
  const token = localStorage.getItem('token');
  try {
    await fetch(`${API_URL}/auth/keys/${keyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name })
    });
    loadKeys();
  } catch (err) {
    alert('Failed to rename key');
  }
}

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
      const pct = budget > 0 ? Math.min(100, (used / budget) * 100) : 0;
      const barClass = pct >= 90 ? 'crit' : pct >= 70 ? 'warn' : 'ok';
      return `
        <div class="db-key-row">
          <div style="flex:1">
            <div class="db-key-name">${p.name}</div>
            <div class="db-key-meta">${used.toFixed(4)} / ${budget.toFixed(2)} TFC used</div>
            <div class="db-proj-bar">
              <div class="db-proj-bar-fill ${barClass}" style="width:${pct}%"></div>
            </div>
          </div>
          <div class="db-key-actions">
            <span class="db-badge ${p.is_active ? 'active' : 'inactive'}">${p.is_active ? 'Active' : 'Inactive'}</span>
            <button class="db-btn" onclick="editProjectBudget('${p.id}','${p.name}',${budget})">Edit Budget</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Projects error:', err);
  }
}

function editProjectBudget(id, name, current) {
  const newBudget = prompt(`New budget for "${name}" (TFC):`, current);
  if (!newBudget) return;
  updateProjectBudget(id, parseFloat(newBudget));
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