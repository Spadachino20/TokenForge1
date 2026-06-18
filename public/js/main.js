document.addEventListener('DOMContentLoaded', () => {
    // Reveal Observer
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('visible');
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.fade-in').forEach((el, index) => {
        el.style.transitionDelay = `${index * 0.1}s`;
        observer.observe(el);
    });

    // Session logic (Minimal)
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (token && user) {
        // Update nav for authenticated users if needed
    }
});
