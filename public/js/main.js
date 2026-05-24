// Main JavaScript for TokenForge

document.addEventListener('DOMContentLoaded', () => {
    // Waitlist form
    const waitlistForm = document.getElementById('waitlist-form');
    if (waitlistForm) {
        waitlistForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('waitlist-email').value;
            const messageEl = document.getElementById('waitlist-message');

            try {
                const response = await fetch('/auth/waitlist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                const data = await response.json();

                if (response.ok) {
                    messageEl.textContent = 'Thanks for joining! We\'ll be in touch soon.';
                    messageEl.className = 'message success';
                    waitlistForm.reset();
                } else {
                    messageEl.textContent = data.error || 'Something went wrong. Please try again.';
                    messageEl.className = 'message error';
                }
            } catch (err) {
                messageEl.textContent = 'Network error. Please try again.';
                messageEl.className = 'message error';
            }
        });
    }
});
