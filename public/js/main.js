const API_URL = '';
const CRYPTO_CHECKOUT_URL = 'https://primary-production-f8470.up.railway.app/webhook/crear-factura';

async function pagarConCrypto(monto) {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
        window.location.href = '/login.html';
        return;
    }

    let user;
    try {
        user = JSON.parse(storedUser);
    } catch (err) {
        console.error('Invalid user object in storage', err);
        window.location.href = '/login.html';
        return;
    }

    if (!user?.id || !user?.email) {
        alert('Usuario no válido. Por favor inicia sesión de nuevo.');
        window.location.href = '/login.html';
        return;
    }

    try {
        const res = await fetch(CRYPTO_CHECKOUT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ monto, userId: user.id, email: user.email })
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const redirectUrl = await res.text();
        if (!redirectUrl) {
            throw new Error('No redirect URL returned from payment service');
        }

        window.location.href = redirectUrl;
    } catch (err) {
        console.error('Crypto payment init failed:', err);
        alert('No se pudo iniciar el pago con crypto. Intenta nuevamente más tarde.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Mostrar cuenta si hay sesión activa
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    const navLinks = document.getElementById('navLinks');

    if (!navLinks) {
        return;
    }

    const defaultNav = `
        <a href="/pricing.html">Pricing</a>
        <a href="/docs.html">Docs</a>
        <a href="/login.html">Sign In</a>
        <a href="/signup.html">Sign Up</a>
    `;

    if (!token || !user) {
        navLinks.innerHTML = defaultNav;
        return;
    }

    let userData;
    try {
        userData = JSON.parse(user);
    } catch (err) {
        console.error('Invalid user object in storage', err);
        navLinks.innerHTML = defaultNav;
        return;
    }

    if (userData?.email) {
        navLinks.innerHTML = `
            <a href="/pricing.html">Pricing</a>
            <a href="/docs.html">Docs</a>
            <span style="color:#888;font-size:0.85rem">${userData.email}</span>
            <a href="/dashboard.html">Dashboard</a>
            <a href="#" id="logoutBtn" style="color:#888;font-size:0.85rem;margin-left:1rem">Log Out</a>
        `;
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.reload();
            });
        }
    } else {
        navLinks.innerHTML = defaultNav;
    }

    // Waitlist form
    const waitlistForm = document.getElementById('waitlistForm');
    const waitlistMsg = document.getElementById('waitlistMsg');
    if (waitlistForm) {
        waitlistForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('waitlistEmail').value;
            const submitBtn = waitlistForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Joining...';
            try {
                const response = await fetch('/waitlist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                if (response.ok) {
                    waitlistForm.style.display = 'none';
                    waitlistMsg.innerHTML = `
                        <div style="text-align: center; padding: 2rem 0;">
                            <div style="font-size: 3rem; margin-bottom: 1rem;">🎉</div>
                            <h3 style="color: #00d4ff; margin-bottom: 0.5rem;">You're on the waitlist!</h3>
                            <p style="color: #94a3b8;">We'll email you at <strong>${email}</strong> when access is available.</p>
                        </div>
                    `;
                } else {
                    const data = await response.json();
                    waitlistMsg.textContent = data.error || 'Something went wrong. Please try again.';
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Notify Me';
                }
            } catch (err) {
                waitlistMsg.textContent = 'Network error. Please try again.';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Notify Me';
            }
        });
    }

    // Scroll animation para feature cards
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, i) => {
            if (entry.isIntersecting) {
                setTimeout(() => entry.target.classList.add('visible'), i * 100);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.feature-card').forEach(card => observer.observe(card));
});