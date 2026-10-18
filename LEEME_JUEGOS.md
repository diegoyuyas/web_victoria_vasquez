# Módulo Juegos · Ruleta de la Suerte

Sección opcional para la web: el cliente ingresa un código, gira la ruleta y, si gana, el dueño lo ve y lo entrega desde el portal. El módulo es **idéntico para todos los negocios**; no contiene textos ni imágenes de ninguno.

## Archivos
`api/ruleta.js` · `api/publish.js` · `lib/redis.js` · `lib/ruleta.js` · `juegos.js` · `juegos.css` · `portal_juegos.html` · `main.js`

Además, en cada negocio: añade en su `portal_admin.html`, justo después del botón "Footer", esta línea:
```html
<button onclick="location.href='portal_juegos.html'" id="b-juegos">🎰 Juegos (Ruleta)</button>
```
(La plantilla general ya la trae. Es opcional: `/portal_juegos.html` funciona igual.)

## Variables en Vercel (Settings → Environment Variables)
| Variable | Valor |
|---|---|
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | los de tu base Upstash (puede ser la misma para varios negocios) |
| `JUEGOS_NS` | código **único por negocio**: minúsculas, números y guiones (ej. `clinica-lima`). No lo repitas ni lo cambies después |
| `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH` | los mismos que usa el portal admin para publicar |

Tras añadir o cambiar variables, haz **Redeploy**.

## Puesta en marcha
1. Abre `/api/ruleta?action=ping`: debe responder `ok`.
2. Entra a `/portal_juegos.html` con la clave del portal del negocio (usuario `admin`).
3. **Sectores**: configura textos y de 6 a 20 sectores; la suma debe dar 100 %. Guarda.
4. **Códigos**: genera los códigos y cópialos para enviarlos al cliente (hay enlace de WhatsApp).
5. En el panel de inicio activa **"Ruleta activa"** y **"Mostrar la sección Juegos en la web"** (tarda 1-2 min en verse; recarga con Ctrl+F5).

## Uso diario
- **Ganadores**: verifica un código, marca como entregado, borra datos personales o exporta CSV.
- **Probar**: simula de 1 000 a 100 000 giros para comprobar las probabilidades.
- Para ocultar la sección, apaga "Mostrar la sección Juegos en la web". Para pausar los giros, apaga "Ruleta activa".

## Cosas a tener en cuenta
- Cada código se usa una sola vez; el servidor decide el resultado (no se puede manipular desde el navegador).
- Los datos personales (nombres y DNI) **solo se guardan si la persona gana** y se borran solos a los 90 días de entregado el premio (o antes, a mano).
- Tras 5 intentos fallidos (código o clave) hay un bloqueo de 15 minutos; hay un límite de 40 solicitudes por minuto por IP.
- Revisa los límites vigentes de tu plan en Upstash y Vercel; la base compartida reparte su cuota entre todos los negocios.
- Una promoción con premios por azar y datos personales puede tener requisitos legales en tu país: revísalos.
