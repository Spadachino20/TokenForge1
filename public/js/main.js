document.addEventListener('DOMContentLoaded', () => {
    // Mostrar cuenta si hay sesión activa
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    const navLinks = document.getElementById('navLinks');

    if (token && user && navLinks) {
        const userData = JSON.parse(user);
        navLinks.innerHTML = `
            <span style="color:#888;font-size:0.85rem">${userData.email}</span>
            <a href="/dashboard.html" class="btn btn-nav" style="margin-right:0.5rem">Dashboard</a>
            <a href="#" id="logoutBtn" style="color:#888;font-size:0.85rem;margin-left:1rem">Log Out</a>
        `;
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.reload();
        });
    }

    // Navbar scroll effect
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) navbar.classList.add('scrolled');
        else navbar.classList.remove('scrolled');
    });

    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({ behavior: 'smooth' });
        });
    });

    // Waitlist form (Simulated)
    const waitlistForm = document.getElementById('waitlistForm');
    const waitlistMsg = document.getElementById('waitlistMsg');
    if (waitlistForm) {
        waitlistForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = waitlistForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Loading...';

            // Simulate API
            await new Promise(resolve => setTimeout(resolve, 1000));

            waitlistForm.style.display = 'none';
            waitlistMsg.innerHTML = `<p style="color:var(--success)">You're on the list. We'll notify you when access opens.</p>`;
        });
    }

    // Intersection Observer for animations
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('visible');
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.feature-card').forEach((card, index) => {
        card.style.transitionDelay = `${index * 0.1}s`;
        observer.observe(card);
    });

    // Cursor glow
    document.addEventListener('mousemove', e => {
        document.body.style.setProperty('--x', `${e.clientX}px`);
        document.body.style.setProperty('--y', `${e.clientY}px`);
    });

    // Word swap effect
    const wordSpan = document.getElementById('modelSwap');
    const words = ["Every AI Model", "Every AI Voice", "Every AI Image"];
    let i = 0;
    if (wordSpan) {
        setInterval(() => {
            wordSpan.style.opacity = 0;
            setTimeout(() => {
                i = (i + 1) % words.length;
                wordSpan.textContent = words[i];
                wordSpan.style.opacity = 1;
            }, 500);
        }, 3000);
    }
});
