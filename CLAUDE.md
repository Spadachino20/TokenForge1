## Instrucciones de comportamiento

### Personalidad y tono
- Responde siempre en español
- Sé directo y conciso — no expliques lo que ya es obvio
- Cuando hay un error, identifica la causa raíz antes de proponer solución
- No repitas información que ya está en el contexto
- Usa un tono profesional pero cercano, como un senior developer explicándole a alguien inteligente

### Forma de razonar
- Antes de escribir código, lee los archivos relevantes
- Nunca asumas — verifica primero con Read o Search
- Si vas a editar un archivo, muestra qué vas a cambiar y por qué antes de hacerlo
- Cuando algo crashea, busca el error exacto antes de proponer fixes
- Propón soluciones paso a paso, un problema a la vez
- Si detectas que una solución puede romper algo más, avísalo antes

### Forma de escribir código
- Mantén el estilo del código existente (no cambies indentación ni convenciones)
- No agregues dependencias nuevas sin avisar
- Nunca hardcodees valores que deberían ser variables de entorno
- Siempre maneja errores con try/catch en operaciones async
- Cuando edites un archivo, edita solo lo necesario — no reescribas todo

### Prioridades del proyecto
- La página no debe crashear nunca — si un fix puede romper algo, haz el fix más conservador
- El saldo del usuario debe ser siempre consistente — operaciones de TFC son críticas
- La seguridad primero — nunca expongas API keys ni datos sensibles
- Antes de hacer deploy (git push), confirma que no hay errores de sintaxis obvios

### Qué evitar
- No uses Docker — el proyecto corre en Railway directamente
- No sugieras npm run dev si el comando correcto es node src/app.js
- No reescribas archivos enteros cuando solo hay que cambiar 2 líneas
- No uses prompt() ni confirm() del browser — usa modales personalizados
- No mezcles el CSS de dashboard.css con style.css — son archivos separados

# CLAUDE.md — TokenForge

## Comandos principales
- **Instalar dependencias:** `npm ci`
- **Ejecutar en desarrollo:** `node src/app.js`
- **Correr migraciones:** automático al iniciar el servidor
- **Deploy:** `git push origin main` (Railway auto‑deploya)

## Qué es TokenForge
Agregador de LLMs con una sola API key formato `tf_sk_...`. El usuario compra TFC credits y llama a OpenAI, Anthropic y Google con un solo endpoint compatible con el SDK de OpenAI.
Solo cambia `base_url` y `api_key`, todo lo demás igual.

## Stack
- Backend: Node.js + Express en Railway
- DB: Supabase PostgreSQL (pooler IPv4 puerto 6543)
- Pagos: Stripe (checkout sessions + webhooks)
- Emails: Resend (pendiente verificar dominio `tokenforge.ai`)
- Frontend: HTML/CSS/JS vanilla sin framework
- GitHub: <https://github.com/Spadachino20/TokenForge1>
- URL producción: <https://tokenforge1-production.up.railway.app>

## Arquitectura
```
src/
  app.js            # entry point, monta rutas y corre migraciones
  routes/
    api.js          # proxy principal, routing y streaming a proveedores
    auth.js         # login, registro, API keys con PATCH editar/revocar/reset
    billing.js      # Stripe checkout y webhooks
    waitlist.js     # guarda emails en tabla waitlist
    projects.js     # proyectos (backend listo, frontend pendiente)
  services/
    balanceService.js # reserva y descuenta TFC atómicamente
    email.js          # Resend: alertas 20%, 10%, confirmación compra
    providers/
      openai.js
      anthropic.js
      gemini.js
  config/
    db.js          # conexión PostgreSQL con forzado IPv4
    migrate.js     # 10 migraciones automáticas
public/
  index.html          # landing + waitlist
  dashboard.html      # dashboard privado
  css/
    style.css         # landing y auth
    dashboard.css     # dashboard (archivo separado)
  js/
    main.js   # waitlist form + navbar con detección de sesión
    auth.js   # login y signup
    dashboard.js # toda la lógica del dashboard
```

## Tablas Supabase
`users, api_keys, projects, usage_logs, transactions, stripe_events, model_pricing, waitlist, notifications`

## Decisiones de negocio
- 1 TFC = 1 USD
- Markup 20% sobre costo real de proveedores
- Compra mínima $10, sin suscripciones, pay‑as‑you‑go
- Alertas email al 20% y 10% de saldo (una sola vez cada una)
- Alertas opcionales por proyecto al 20% de su presupuesto
- Ganancia real por $10 comprado: ~$1.08 después de Stripe fee

## Modelos soportados
**OpenAI:** gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo, o1, o1-mini
**Anthropic:** claude-3-5-sonnet-20241022, claude-3-opus-20240229, claude-3-haiku-20240307, claude-3-5-haiku-20241022
**Google:** gemini-1.5-pro, gemini-1.5-flash, gemini-2.0-flash

## Lo que YA funciona
- Waitlist guardando emails en Supabase
- Login/signup/logout con JWT
- Navbar detecta sesión: email + Dashboard + Log Out
- Dashboard sidebar navegable: Overview, API Keys, Projects, Billing
- Crear API keys con modal personalizado (key visible solo una vez)
- Editar nombre, revocar y reset de API keys
- Balance card en TFC y USD
- Gráfico de líneas por modelo con colores por provider
  - naranja=Anthropic, verde=OpenAI, azul=Gemini
- Toggle USD/TFC en el gráfico + filtro de fecha personalizada
- GET /usage/summary funcionando
- CSP fix en Helmet para Chart.js CDN
- Modales personalizados sin prompt/confirm del browser
- Delete key elimina fila visualmente sin recargar
- Stripe checkout implementado mínimo $10
- Proxy con routing a 3 proveedores + streaming
- Migraciones automáticas al iniciar

## Pendiente prioritario
1. Frontend Projects: crear proyecto con nombre y presupuesto TFC,
   barra de uso, editar presupuesto, alertas opcionales por proyecto
2. Verificar dominio tokenforge.ai en Resend
3. Testear Stripe webhook en producción
4. Página Pricing pública en landing
5. Página Docs con ejemplos de código

## Variables de entorno Railway
`DATABASE_URL, JWT_SECRET, NODE_ENV, PORT, STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID, OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY, RESEND_API_KEY, FRONTEND_URL, REDIS_URL`

## Reglas importantes
- Responde siempre en español
- Nunca hardcodees API keys
- Siempre verificar saldo antes de hacer request a proveedores
- El markup del 20% ya está en `model_pricing` en Supabase
- Los archivos CSS del dashboard y landing son SEPARADOS