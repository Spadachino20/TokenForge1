// Dashboard JavaScript for TokenForge - Corregido
const API_URL = '';
let usageChart = null;
let currentCurrency = 'usd';

// Helper for authenticated requests
async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; throw new Error('No token'); }

    options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    const res = await fetch(`${API_URL}${url}`, options);
    if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login.html';
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
  modal.style.cssText = `position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);`;

  modal.innerHTML = `
    <div style="background:#0d0d0d;border:1px solid #1F2937;border-radius:14px;padding:2rem;width:100%;max-width:420px;margin:1rem;box-shadow:0 0 40px rgba(0,212,255,0.08);">
      <h3 style="font-size:1rem;font-weight:700;margin-bottom:0.5rem;color:#fff">${title}</h3>
      <p style="font-size:0.85rem;color:#888;margin-bottom:${hasInput ? '1rem' : '1.5rem'}">${message}</p>
      ${hasInput ? `<input id="tf-modal-input" type="text" placeholder="${inputPlaceholder}" style="width:100%;background:#000;border:1px solid #1F2937;border-radius:8px;padding:0.65rem 0.9rem;color:#fff;font-size:0.9rem;outline:none;margin-bottom:1.5rem;"/>` : ''}
      <div style="display:flex;gap:0.75rem;justify-content:flex-end">
        <button id="tf-modal-cancel" style="padding:0.5rem 1.1rem;border-radius:8px;border:1px solid #1F2937;background:transparent;color:#888;font-size:0.85rem;cursor:pointer;">Cancel</button>
        <button id="tf-modal-confirm" style="padding:0.5rem 1.1rem;border-radius:8px;border:none;font-weight:700;font-size:0.85rem;cursor:pointer;background:${confirmDanger ? '#ef4444' : '#00d4ff'};color:${confirmDanger ? '#fff' : '#000'};">${confirmText}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const input = document.getElementById('tf-modal-input');
  if (input) { input.focus(); input.addEventListener('keydown', e => { if (e.key === 'Enter') handleConfirm(); }); }

  function handleConfirm() {
    const val = input ? input.value.trim() : null;
    modal.remove();
    onConfirm(val);
  }
  document.getElementById('tf-modal-confirm').addEventListener('click', handleConfirm);
  document.getElementById('tf-modal-cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
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

  document.querySelectorAll('.db-filter[data-period]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.db-filter[data-period]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadChart(btn.dataset.period);
    });
  });

  document.getElementById('addCreditsBtn').addEventListener('click', () => {
    showModal({
      title: 'Add Credits', message: 'Enter amount in USD ($10-500)', inputPlaceholder: '10', confirmText: 'Buy',
      onConfirm: (val) => { if (val) buyCredits(val); }
    });
  });

  document.getElementById('createKeyBtn').addEventListener('click', () => {
    showModal({
      title: 'New API Key', message: 'Key Name', inputPlaceholder: 'Production', confirmText: 'Create',
      onConfirm: (val) => { if (val) createKey(val); }
    });
  });

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

async function loadBalance() {
  try {
    const res = await fetchWithAuth('/billing/balance');
    const data = await res.json();
    const bal = parseFloat(data.balance_tfc) || 0;
    document.getElementById('balanceTfc').textContent = `${bal.toFixed(4)} TFC`;
    document.getElementById('balanceUsd').textContent = `$${bal.toFixed(2)} USD`;
    const pct = bal > 0 ? Math.min(100, (bal / (bal + 1)) * 100) : 0;
    document.getElementById('balanceBar').style.width = `${pct}%`;
  } catch (err) { console.error('Balance error:', err); }
}

async function loadChart(period) {
  try {
    const res = await fetchWithAuth(`/usage/summary?period=${period}&currency=${currentCurrency}`);
    const data = await res.json();
    const canvas = document.getElementById('usageChart');
    if (!data.labels || data.labels.length === 0) { canvas.style.display = 'none'; return; }

    canvas.style.display = 'block';
    if (usageChart) usageChart.destroy();
    usageChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: data.datasets.map(ds => ({ label: ds.model, data: ds.data, borderColor: ds.color, tension: 0.4 }))
      }
    });
  } catch (err) { console.error('Chart error:', err); }
}

async function loadKeys() {
  try {
    const res = await fetchWithAuth('/auth/keys');
    const data = await res.json();
    const container = document.getElementById('keysList');
    container.innerHTML = (data.keys || []).filter(k => k.is_active).map(key => `
      <div class="db-key-row">
        <div>${key.name}</div>
        <button class="db-btn danger" onclick="deleteKey('${key.id}')">Delete</button>
      </div>
    `).join('');
  } catch (err) { console.error('Keys error:', err); }
}

async function loadProjects() {
  try {
    const res = await fetchWithAuth('/projects');
    const data = await res.json();
    const container = document.getElementById('projectsList');
    container.innerHTML = (data.projects || []).map(p => `
      <div class="db-key-row">
        <div>${p.name}</div>
        <button class="db-btn" onclick="deleteProject('${p.id}')">Delete</button>
      </div>
    `).join('');
  } catch (err) { console.error('Projects error:', err); }
}

async function buyCredits(amount) {
  try {
    const res = await fetchWithAuth('/billing/checkout', { method: 'POST', body: JSON.stringify({ amount: parseInt(amount) }) });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  } catch (err) { alert('Failed to checkout'); }
}
