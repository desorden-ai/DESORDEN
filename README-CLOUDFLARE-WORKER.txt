DESORDEN SCROLLYTELLING — CLOUDFLARE WORKER + GITHUB — V3
=========================================================

Este paquete está preparado específicamente para el Worker:

muddy-silence-70da.desorden-help-76b.workers.dev

ESTRUCTURA
----------
- wrangler.jsonc
- package.json
- public/
  - index.html
  - _headers
  - assets/
  - frames/v1/ (97 fotogramas WebP)

PUBLICACIÓN DESDE GITHUB
------------------------
1. Descomprime este ZIP.
2. Sube EL CONTENIDO descomprimido a la raíz del repositorio.
   No subas únicamente el archivo ZIP.
3. En Cloudflare abre:
   Workers & Pages > muddy-silence-70da > Settings > Builds.
4. Configura:
   - Production branch: main
   - Root directory: vacío
   - Build command: vacío
   - Deploy command: npx wrangler deploy
5. Guarda la configuración y ejecuta un nuevo despliegue.

COMPROBACIÓN
------------
Cuando el despliegue termine, estas rutas deben abrir correctamente:

/health.json
/frames/v1/frame_0001.webp
/frames/v1/frame_0097.webp

Si /health.json muestra "worker-v3-progressive" pero un fotograma no abre, la
carpeta public/frames no se ha incluido en el repositorio o el despliegue no
ha terminado correctamente.

MEJORAS DE ESTA VERSIÓN
-----------------------
- Static Assets configurados explícitamente mediante wrangler.jsonc.
- La entrada solo espera los 8 primeros fotogramas esenciales.
- Los 89 fotogramas restantes se descargan progresivamente en segundo plano.
- Cualquier fotograma solicitado antes de tiempo se prioriza automáticamente.
- Solo se conservan 6 fotogramas decodificados en móvil y 8 en escritorio.
- La decodificación está limitada a 2 operaciones simultáneas.
- Tiempo máximo de espera y error visible con el nombre del archivo.
- Rutas absolutas para evitar errores de subcarpetas.
- Los recursos inexistentes devuelven 404 real en vez de index.html.
- JavaScript y CSS usan nombres nuevos para evitar que la caché anual conserve
  la versión anterior.

DOMINIO
-------
La aplicación actual debe conservar:

- www.desorden.cat como dominio personalizado del Worker muddy-silence-70da.
- desorden.cat con redirección permanente 301 a https://www.desorden.cat/.

No asocies estos mismos hostnames simultáneamente a otro Worker o proyecto
Pages. El despliegue de este paquete actualiza el Worker existente; no necesita
crear un segundo proyecto.

Documentación oficial:
https://developers.cloudflare.com/workers/static-assets/
https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
