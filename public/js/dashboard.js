// Dashboard JavaScript for TokenForge

const API_URL = '';
let currentSection = 'overview';

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('user-email').textContent = user.email || '';

    // Load balance
    loadBalance();

    // Navigation
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = e.target.dataset.section;
            showSection(section);
        });
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    });

    // Buy TFC
    document.getElementById('buy-tfc-btn').addEventListener('click', async () => {
        const amount = prompt('How many TFC credits? (min $10, max $500)', '10');
        if (!amount) return;

        try {
            const response = await fetch(`${API_URL}/billing/checkout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ amount: parseInt(amount) })
            });

            const data = await response.json();
            if (data.url) {
                window.location.href = data.url;
            }
        } catch (err) {
            alert('Failed to create checkout session');
        }
    });

    // Create API key
    document.getElementById('create-key-btn').addEventListener('click', async () => {
        const name = prompt('Key name:', 'Production Key');
        if (!name) return;

        try {
            const response = await fetch(`${API_URL}/auth/keys`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name })
            });

            const data = await response.json();
            if (data.key) {
                alert(`Your API key: ${data.key.value}\n\nSave this - it won't be shown again!`);
                loadKeys();
            }
        } catch (err) {
            alert('Failed to create API key');
        }
    });
});

function showSection(section) {
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
        link.classList.toggle('active', link.dataset.section === section);
    });

    document.querySelectorAll('main > section').forEach(sec => {
        sec.style.display = 'none';
    });

    document.getElementById(`${section}-section`).style.display = 'block';
    currentSection = section;

    if (section === 'keys') loadKeys();
    if (section === 'usage') loadUsage();
    if (section === 'billing') loadBilling();
}

async function loadBalance() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/billing/balance`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        document.getElementById('balance').textContent = `${data.balance_tfc.toFixed(2)} TFC`;
    } catch (err) {
        console.error('Failed to load balance:', err);
    }
}

async function loadKeys() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/auth/keys`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        const container = document.getElementById('keys-list');
        container.innerHTML = data.keys.map(key => `
            <div class="api-key-item">
                <div>
                    <strong>${key.name}</strong>
                    <div class="api-key-value">${key.is_active ? 'Active' : 'Revoked'}</div>
                </div>
                <button onclick="revokeKey('${key.id}')" class="btn-secondary" ${!key.is_active ? 'disabled' : ''}>
                    Revoke
                </button>
            </div>
        `).join('');
    } catch (err) {
        console.error('Failed to load keys:', err);
    }
}

async function revokeKey(keyId) {
    if (!confirm('Are you sure? This cannot be undone.')) return;

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

async function loadUsage() {
    // TODO: Implement usage history endpoint
    document.getElementById('usage-list').innerHTML = '<p>Usage history coming soon...</p>';
}

async function loadBilling() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/billing/balance`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        const container = document.getElementById('billing-list');
        container.innerHTML = data.transactions.map(tx => `
            <div class="api-key-item">
                <div>
                    <strong>${tx.type}</strong>
                    <div class="api-key-value">${tx.description || ''}</div>
                </div>
                <div>${tx.amount_tfc > 0 ? '+' : ''}${tx.amount_tfc.toFixed(4)} TFC</div>
            </div>
        `).join('') || '<p>No transactions yet.</p>';
    } catch (err) {
        console.error('Failed to load billing:', err);
    }
}
