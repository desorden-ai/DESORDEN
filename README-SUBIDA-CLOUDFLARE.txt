DESORDEN SCROLLYTELLING — PAQUETE PARA CLOUDFLARE PAGES
========================================================

Este ZIP contiene una web estática completa. No necesita instalar paquetes,
ejecutar comandos, utilizar una base de datos ni conectarse a un CDN externo.

CONTENIDO PRINCIPAL
-------------------
- index.html
- _headers
- assets/
  - CSS de la página
  - JavaScript de la experiencia
  - GSAP y ScrollTrigger incluidos localmente
- frames/
  - v1/
    - 97 fotogramas WebP a 1080 x 1920

SUBIDA MEDIANTE EL PANEL DE CLOUDFLARE
--------------------------------------
1. Abre Cloudflare y entra en "Workers & Pages".
2. Pulsa "Create application" o "Crear aplicación".
3. Selecciona "Get started" y después "Drag and drop your files".
4. Escribe el nombre del nuevo proyecto.
5. Arrastra este archivo ZIP completo al área de subida.
6. Pulsa "Deploy site".

Para actualizar posteriormente el proyecto:
1. Abre el proyecto de Pages.
2. Selecciona "Create a new deployment".
3. Vuelve a subir el ZIP completo.
4. Elige producción o vista previa y confirma el despliegue.

IMPORTANTE
----------
- El ZIP debe conservar index.html en la raíz, no dentro de otra carpeta.
- El método de arrastrar un ZIP solo está disponible en proyectos creados como
  "Direct Upload". Un proyecto conectado originalmente a Git no acepta este
  método desde el panel.
- No elimines ni renombres las carpetas assets o frames.
- Todos los archivos individuales están por debajo del límite de 25 MiB de
  Cloudflare Pages.

Documentación oficial:
https://developers.cloudflare.com/pages/get-started/direct-upload/
