document.addEventListener('DOMContentLoaded', () => {
    // Session handling
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    const navLinks = document.getElementById('navLinks');

    if (token && user && navLinks) {
        const userData = JSON.parse(user);
        navLinks.innerHTML = `
            <span style="color:#888;font-size:0.85rem">${userData.email}</span>
            <a href="/dashboard.html" class="btn btn-nav">Dashboard</a>
            <a href="#" id="logoutBtn" style="color:#888;font-size:0.85rem">Log Out</a>
        `;
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.reload();
        });
    }

    // Scroll reveal
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('visible');
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach((el, index) => {
        el.style.transitionDelay = `${index * 0.1}s`;
        observer.observe(el);
    });

    // Navbar effect
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) navbar.classList.add('scrolled');
        else navbar.classList.remove('scrolled');
    });
});
