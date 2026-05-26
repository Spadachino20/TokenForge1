# Instrucciones para Claude — Modo Waitlist (TokenForge)

## Contexto
El proyecto está deployado en Railway. La URL es: `https://tokenforge1-production.up.railway.app`

El objetivo es convertir la landing actual en una **waitlist real**:
1. El botón "Start Building" debe llevar al formulario de waitlist (email), NO a signup.
2. Al poner el email, mostrar "You're on the waitlist" en vez de redirigir al dashboard.
3. Signup/login siguen existiendo pero NO están linkeados desde la landing principal.

## Archivos a editar en Railway (editor web)

### 1. `public/index.html` — Cambiar CTA principal

**Buscar esto (línea ~28):**
```html
<a href="/signup.html" class="btn btn-primary btn-lg">Start Building →</a>
```

**Reemplazar por:**
```html
<a href="#waitlist" class="btn btn-primary btn-lg">Start Building →</a>
```

**Buscar esto (línea ~12):**
```html
<a href="/signup.html" class="btn btn-nav">Get Access</a>
```

**Reemplazar por:**
```html
<a href="#waitlist" class="btn btn-nav">Join Waitlist</a>
```

### 2. `public/js/main.js` — Cambiar comportamiento del formulario waitlist

**Reemplazar TODO el archivo por:**
```javascript
// Main JavaScript for TokenForge

document.addEventListener('DOMContentLoaded', () => {
    // Waitlist form
    const waitlistForm = document.getElementById('waitlistForm');
    const waitlistMsg = document.getElementById('waitlistMsg');
    
    if (waitlistForm) {
        waitlistForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('waitlistEmail').value;
            const submitBtn = waitlistForm.querySelector('button[type="submit"]');
            
            // Disable button while submitting
            submitBtn.disabled = true;
            submitBtn.textContent = 'Joining...';

            try {
                const response = await fetch('/auth/waitlist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                if (response.ok) {
                    // Show waitlist confirmation
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
```

### 3. `public/signup.html` — Opcional: agregar mensaje de "waitlist mode"

**Agregar antes del `<form>` (después del `<p>Get started with TokenForge</p>`):**
```html
<div class="notice-box" style="background: rgba(0, 212, 255, 0.1); border: 1px solid rgba(0, 212, 255, 0.3); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; text-align: center;">
    <p style="margin: 0; color: #00d4ff; font-size: 0.9rem;">⚠️ TokenForge is currently in waitlist mode. New registrations are limited.</p>
</div>
```

### 4. `public/login.html` — Opcional: mismo mensaje

**Mismo bloque que arriba**, agregar antes del form.

---

## Cómo editar en Railway

1. Ve a https://railway.app y logueate
2. Entra al proyecto "tokenforge1-production"
3. Ve a la pestaña **"Deployments"**
4. Click en el deployment activo (el último verde)
5. Arriba a la derecha hay un botón **"View Logs"** — al lado hay **"Shell"**
6. **NO uses Shell para editar**. En su lugar:
   - Ve a la pestaña **"Settings"** del servicio
   - O busca **"Variables"** para ver env vars
   - Para editar código: Railway NO tiene editor de archivos directo en la UI
   
   **Alternativa:** Tienes que hacer deploy de los cambios. Las opciones son:
   
   ### Opción A: Git (recomendada)
   - Commitea los cambios en tu repo local
   - Push a GitHub: `git add . && git commit -m "waitlist mode" && git push origin main`
   - Railway auto-deployea en ~1 minuto
   
   ### Opción B: Railway CLI (si funciona)
   ```bash
   railway login
   railway link
   railway up
   ```
   
   ### Opción C: Variables de entorno para modo waitlist
   Si solo quieres desactivar signup temporalmente sin tocar código:
   - Ve a Variables en Railway
   - Agrega: `WAITLIST_MODE=true`
   - Reinicia el servicio
   - Luego en el backend lees esa variable y bloqueas `/auth/register`

---

## Resumen de cambios para Claude

| Archivo | Cambio |
|---------|--------|
| `index.html` | "Start Building" → scroll a `#waitlist` en vez de `/signup.html` |
| `index.html` | Nav "Get Access" → "Join Waitlist" |
| `main.js` | Al submit waitlist: mostrar mensaje de confirmación, ocultar form |
| `signup.html` | Agregar banner de "waitlist mode" (opcional) |
| `login.html` | Agregar banner de "waitlist mode" (opcional) |

## Nota importante
El backend (`src/routes/waitlist.js`) ya funciona. Guarda emails en la tabla `waitlist`. No necesita cambios.

El backend de auth (`src/routes/auth.js`) también funciona. Si quieres bloquear registros nuevos temporalmente, agrega esto al inicio de `router.post('/register', ...)`:

```javascript
if (process.env.WAITLIST_MODE === 'true') {
  return res.status(403).json({ error: 'Registration is currently limited. Join the waitlist to get early access.' });
}
```
