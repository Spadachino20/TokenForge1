document.addEventListener('DOMContentLoaded', () => {
 const waitlistForm = document.getElementById('waitlistForm');
 if (waitlistForm) {
 waitlistForm.addEventListener('submit', async (e) => {
 e.preventDefault();
 const email = document.getElementById('waitlistEmail').value;
 const msgEl = document.getElementById('waitlistMsg');
 const btn = waitlistForm.querySelector('button');
 btn.disabled = true;
 btn.textContent = 'Sending...';
 try {
 const response = await fetch('/waitlist', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ email })
 });
 const data = await response.json();
 if (response.ok) {
 msgEl.textContent = "✅ You're on the list! We'll reach out soon.";
 msgEl.style.color = '#22c55e';
 waitlistForm.reset();
 } else {
 msgEl.textContent = data.error || 'Something went wrong.';
 msgEl.style.color = '#ef4444';
 }
 } catch (err) {
 msgEl.textContent = 'Network error. Please try again.';
 msgEl.style.color = '#ef4444';
 } finally {
 btn.disabled = false;
 btn.textContent = 'Notify Me';
 }
 });
 }
});

