document.addEventListener('DOMContentLoaded', () => {
    // Mostrar cuenta si hay sesión activa
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    const navLinks = document.getElementById('navLinks');

    if (token && user && navLinks) {
        const userData = JSON.parse(user);
        navLinks.innerHTML = `
            <span style="color:#888;font-size:0.85rem">${userData.email}</span>
            <a href="#" id="logoutBtn" style="color:#888;font-size:0.85rem;margin-left:1rem">Logout</a>
        `;
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.reload();
        });
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
                    waitlistMsg.className = 'waitlist-note';
                } else {
                    const data = await response.json();
                    waitlistMsg.textContent = data.error || 'Something went wrong. Please try again.';
                    waitlistMsg.className = 'waitlist-note error';
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Notify Me';
                }
            } catch (err) {
                waitlistMsg.textContent = 'Network error. Please try again.';
                waitlistMsg.className = 'waitlist-note error';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Notify Me';
            }
        });
    }
});