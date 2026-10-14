# Plantilla web con portal de administración

Sitio de una sola página (inicio, productos/servicios, nosotros, ubícanos, contacto) que se edita **sin tocar código** desde `portal_admin.html` y se publica en GitHub + Vercel.

## 1. Instalar para un cliente nuevo
1. Copia esta carpeta y súbela a un **repositorio nuevo** de GitHub.
2. En Vercel: *Add New → Project* y elige ese repositorio.
3. En *Settings → Environment Variables* agrega:
   - `GITHUB_TOKEN`: token fine-grained del repo con permiso **Contents: Read and write**
   - `GITHUB_REPO`: `usuario/nombre-del-repo`
   - `GITHUB_BRANCH`: `main` (opcional)
4. *Redeploy*.

## 2. Primer uso
1. En la web, presiona **5 veces seguidas el logo** del encabezado (o entra a `/portal_admin.html`).
2. Usuario `admin`, clave inicial `123123`: **cámbiala de inmediato** con el botón 🔑.
3. Configura, en este orden:
   - 💬 **WhatsApp**: número con código de país.
   - 🌐 **Sitio, menú y SEO**: nombre, título, descripción, dirección web del sitio (la de Vercel o su dominio), imagen para compartir e icono.
   - 🖼️ **Logo** y 🎨 **Colores**.
   - Inicio, servicios, nosotros, 📍 ubícanos, contacto y footer.
4. Pulsa **Publicar**. En 1-2 minutos se ve en la web (Ctrl+F5).

## 3. Notas
- Las fotos aceptan hasta 5 MB; se optimizan y se guardan en `assets/uploads/`.
- Al quitar una foto, el archivo queda en GitHub aunque ya no se use.
- Este repositorio **no incluye** `api/_auth.json` (contraseña): se crea al cambiar la clave desde el portal.
- Probar en local: doble clic en `iniciar_servidor.bat` → http://localhost:8000 (en local, usuario `admin` y clave `123123`; los cambios se descargan, no se publican).
