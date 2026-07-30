# PROMPT MAESTRO — LANDING MÓVIL DESORDEN

Actúa como **director creativo digital, diseñador de interacción, especialista sénior en frontend móvil, scrollytelling con Canvas/WebGL, optimización de vídeo para web y despliegues estáticos en Cloudflare Workers**.

Debes inspeccionar el proyecto existente, las imágenes y los vídeos de referencia que adjunto, y construir una **landing page móvil premium, funcional y lista para revisión** para **DESORDEN**.

No generes únicamente una propuesta visual, un mockup o una explicación. Debes producir la implementación real completa, con archivos finales, código operativo, pruebas y un informe de cambios.

---

## 1. OBJETIVO GENERAL

Construye una experiencia vertical de cinco secciones para **www.desorden.cat**, diseñada prioritariamente para teléfonos móviles y basada en:

- fondo negro absoluto;
- tipografía condensada **Anton**;
- color corporativo naranja/amarillo **#EBB221**;
- fotografía y vídeo en claroscuro;
- textos grandes y contundentes;
- una barra técnica lateral izquierda;
- navegación y animaciones controladas por scroll;
- transiciones 3D sobrias y cinematográficas;
- carga rápida, interacción táctil natural y estabilidad en Android e iPhone.

La experiencia debe sentirse como una pieza audiovisual interactiva, no como una plantilla web convencional.

---

## 2. PROYECTO EXISTENTE: INSPECCIÓN OBLIGATORIA

Trabaja sobre el repositorio:

```text
https://github.com/desorden-ai/DESORDEN
```

Rama base actual:

```text
DESORDEN
```

Antes de modificar nada:

1. Inspecciona toda la estructura del repositorio.
2. Revisa especialmente:
   - `public/index.html`
   - `public/assets/`
   - `public/frames/v1/`
   - `tests/v4-smoke.mjs`
   - `package.json`
   - `wrangler.jsonc`
   - `public/_headers`, si existe.
3. Identifica qué componentes actuales son reutilizables y cuáles deben sustituirse.
4. No elimines ningún recurso existente sin demostrar que es redundante.
5. No publiques ni despliegues automáticamente.
6. Trabaja en una rama nueva o entrega un parche limpio para revisión.

La configuración actual de Cloudflare sirve archivos estáticos desde:

```text
./public/
```

La solución final debe seguir siendo compatible con esa arquitectura y con la ruta:

```text
www.desorden.cat/*
```

No conviertas el proyecto en una aplicación compleja con backend innecesario.

---

## 3. RECURSO PRINCIPAL YA EXISTENTE: SECUENCIA OPTIMIZADA PARA SCROLL

La primera página **ya dispone de una secuencia optimizada para desplazamiento**. No debes crear otra, reemplazarla, recomprimirla ni convertirla en un vídeo convencional.

Los fotogramas existentes están en:

```text
public/frames/v1/
```

Nomenclatura:

```text
frame_0001.webp
...
frame_0097.webp
```

Características que debes preservar:

- 97 fotogramas;
- formato WebP;
- proporción vertical 1080 × 1920;
- reproducción controlada por scroll y gesto táctil;
- renderizado mediante `<canvas>`;
- avance y retroceso reversibles;
- sincronización directa entre progreso de scroll y fotograma.

### Regla crítica

**Esta secuencia es el material definitivo de la sección 01.**

No uses la grabación de pantalla como vídeo de fondo. La grabación de pantalla adjunta sirve únicamente como referencia de comportamiento e interacción.

### Controlador de carga requerido

No bloquees la experiencia esperando a descargar los 97 fotogramas.

Implementa o recupera una arquitectura equivalente a la lógica robusta ya existente en `public/assets/app.20260730.worker-v4.js`:

- precarga inicial de 6 a 8 fotogramas esenciales;
- primera imagen con prioridad alta;
- carga progresiva del resto en segundo plano;
- concurrencia limitada;
- `createImageBitmap()` cuando esté disponible;
- caché de decodificación limitada para móvil;
- cancelación o descarte de decodificaciones obsoletas;
- `requestAnimationFrame()` para el renderizado;
- límite de `devicePixelRatio` a 2;
- reintento controlado ante errores;
- fallback visual si Canvas no puede iniciarse;
- desbloqueo de la interfaz tras cargar los recursos esenciales, no tras cargar la secuencia completa.

No dependas de `raw.githubusercontent.com` como fallback de producción. Los fotogramas deben servirse desde el propio dominio.

El usuario no debe volver a sufrir una pantalla de porcentaje que se quede congelada.

---

## 4. REFERENCIAS ADJUNTAS

Interpreta las referencias por su contenido, no por el orden en que aparezcan adjuntas.

### Referencia A — Hero

Pantalla negra con el rostro masculino lateral y el titular:

```text
SI NO TE VEN
NO TE ELIGEN
```

Debes adaptarlo al catalán definitivo:

```text
SI NO ET VEUEN
NO ET TRIEN
```

### Referencia B — Qui soc

Pantalla con silueta masculina lateral, contraluz naranja y el titular:

```text
QUI SOC
```

### Referencia C — En el radar

Pantalla con tarjetas negras, contorno naranja luminoso y referencias a interacciones públicas.

### Referencia D — Contacte

Formulario oscuro con bordes naranjas y titular:

```text
PARLEM DEL TEU PROJECTE
```

### Referencias E y F — Evidencias de interacción

Capturas de una publicación y de una reacción pública. Deben servir como respaldo visual verificable dentro de la sección “En el radar”.

No presentes una interacción como colaboración, contratación, recomendación o relación comercial si la evidencia no demuestra exactamente eso.

---

## 5. RECURSOS DE VÍDEO ADJUNTOS

### Vídeo 1 — Grabación de pantalla

```text
Screenrecording_20260730_161546.mp4
```

Uso permitido:

- referencia de interacción;
- referencia del ritmo de desplazamiento;
- referencia de la respuesta táctil.

Uso prohibido:

- no debe publicarse;
- no debe usarse como fondo;
- no debe aparecer la interfaz del navegador;
- no debe sustituir la secuencia WebP existente.

### Vídeo 2 — Fondo de silueta

```text
video_fondo_web_loop_1080x1920-1.webm
```

Este sí es un recurso final y debe integrarse en la sección **QUI SOC** como loop de fondo:

```html
<video autoplay muted loop playsinline preload="metadata">
```

Requisitos:

- sin audio;
- reproducción inline;
- bucle continuo limpio;
- sin controles visibles;
- póster de fallback;
- gradiente oscuro para garantizar legibilidad;
- pausa cuando la sección esté lejos del viewport mediante `IntersectionObserver`;
- no descargarlo con prioridad durante la carga crítica del hero.

---

## 6. ESTRUCTURA DEFINITIVA DE LA LANDING

La navegación debe mostrar siempre una progresión coherente de **01 / 05** a **05 / 05**.

### 01 / 05 — HERO INTERACTIVO

Contenido:

```text
SI NO ET VEUEN
NO ET TRIEN
```

Comportamiento:

1. La sección ocupa una fase inicial de scrollytelling suficientemente larga para recorrer los 97 fotogramas de forma fluida.
2. La secuencia se mantiene sticky mientras se reproduce.
3. El primer gesto vertical empieza a avanzar la secuencia existente.
4. El usuario puede retroceder y recuperar fotogramas anteriores.
5. El texto aparece progresivamente y se integra por capas con el perfil.
6. El texto debe ser HTML real, no estar incrustado en una imagen.
7. Al completar la secuencia, la página continúa naturalmente hacia la siguiente sección.

No bloquees globalmente el desplazamiento con `touch-action: none` en `html` o `body`.

La interacción debe funcionar con scroll nativo, touch, rueda y trackpad.

### 02 / 05 — QUI SOC

Texto definitivo:

```text
QUI SOC

David Milla, creador i director de DESORDEN.

Direcció visual, vídeo, fotografia, dron, IA i web.

Un únic interlocutor durant tot el procés.
```

Composición:

- vídeo de silueta situado principalmente a la derecha;
- texto a la izquierda o en una zona libre de la silueta;
- halo naranja en movimiento;
- contraste alto;
- lectura clara en pantallas estrechas;
- aparición mediante desplazamiento de capas y opacidad, sin efectos genéricos de plantilla.

Incluye una zona secundaria de **Formacions i acreditacions** únicamente con datos y logotipos que estén aportados o confirmados. No inventes certificaciones.

### 03 / 05 — QUÈ FAIG

Contenido principal:

```text
QUÈ FAIG

VÍDEO
FOTOGRAFIA
DRON
IA VISUAL
WEB
```

Cada servicio puede introducirse mediante el sistema tipográfico tridimensional descrito más adelante.

La sección debe explicar que DESORDEN combina dirección visual, producción audiovisual, dron, inteligencia artificial y desarrollo web desde un único interlocutor.

Mantén el texto breve. No añadas párrafos comerciales genéricos.

### 04 / 05 — EN EL RADAR

Construye tarjetas de interacción pública basadas exclusivamente en evidencias reales aportadas.

Diseño:

- fondo negro;
- tarjetas con borde fino #EBB221;
- resplandor controlado;
- perspectiva 3D muy ligera;
- fotografía circular o elíptica;
- flecha de acceso;
- expansión o apertura al tocar;
- captura de evidencia accesible dentro de un modal o panel.

Reglas:

- no uses checks azules gráficos para simular verificación;
- no inventes métricas;
- no inventes respuestas directas;
- no describas una reacción como colaboración;
- cada afirmación debe poder relacionarse con una captura o enlace real;
- usa formulaciones prudentes como “interacció pública”, “reacció a una peça” o “menció pública” cuando sea lo demostrable.

Ejemplo de tono:

```text
LEIRE MARTÍNEZ
Reacció pública a una peça audiovisual.
VEURE INTERACCIÓ →
```

### 05 / 05 — CONTACTE

Titular:

```text
PARLEM DEL TEU PROJECTE
```

Subtítulo:

```text
Fem visible allò que tens al cap.
```

Campos:

- Nom;
- Contacte;
- Objectiu.

Acciones:

- botón principal `PARLEM`;
- WhatsApp;
- correu electrònic.

Requisitos:

- etiquetas reales visibles o accesibles;
- validación clara;
- estados `focus`, `error`, `sending` y `success`;
- textarea con expansión controlada;
- mensaje de confirmación dentro de la página;
- botones con área táctil mínima de 44 px;
- enlaces reales configurables mediante constantes fáciles de editar;
- no inventes números de teléfono ni direcciones de correo si no están confirmados en el proyecto.

---

## 7. TRANSICIÓN TIPOGRÁFICA 3D

Debes implementar una transición de letras conectadas con apariencia de cubos o prismas tridimensionales.

Concepto exacto:

- la letra actual ocupa la cara frontal del cubo;
- la letra siguiente está adaptada a la cara superior;
- ambos estados están físicamente conectados;
- al avanzar el scroll, el conjunto rota aproximadamente 90 grados;
- la cara superior pasa al frente;
- la nueva letra sustituye a la anterior;
- el conjunto puede avanzar ligeramente hacia la cámara;
- fondo completamente negro;
- letras en #EBB221;
- sin decoraciones adicionales;
- iluminación mínima para mostrar volumen;
- movimiento reversible al hacer scroll hacia atrás.

Uso recomendado:

- transición entre las secciones 01 y 02;
- presentación secuencial de los servicios de la sección 03.

Implementación:

- usa CSS 3D o Canvas/WebGL según proporcione mejor estabilidad;
- evita librerías pesadas;
- no cargues Three.js desde un CDN;
- si utilizas una dependencia, debe quedar incluida localmente y justificada;
- limita la animación a `transform` y `opacity` cuando sea posible;
- usa aceleración GPU;
- no animes propiedades que provoquen relayout continuo;
- crea una versión simplificada con `prefers-reduced-motion`.

La transición debe ser visualmente intensa pero breve. No debe repetirse en todas las interacciones ni convertir la web en una demostración de efectos.

---

## 8. SISTEMA VISUAL

### Colores

```css
--color-black: #000000;
--color-orange: #EBB221;
--color-white: #FFFFFF;
--color-gray: rgba(255, 255, 255, 0.62);
--color-line: rgba(255, 255, 255, 0.24);
```

No cambies el naranja corporativo por otro tono sin autorización.

### Tipografía

- Titulares: Anton.
- Interfaz y texto secundario: sistema sans-serif limpia.
- Evita cargar más familias tipográficas.
- Carga Anton de forma eficiente y define fallback.

### Fondo

- negro real;
- grano cinematográfico muy sutil;
- sin degradados decorativos genéricos;
- el resplandor naranja debe proceder de elementos concretos, no cubrir toda la pantalla.

### Regla de inmutabilidad

No modifiques objetos de las imágenes, no cambies colores de los recursos, no añadas iconos ornamentales ni inventes elementos visuales no solicitados.

---

## 9. BARRA LATERAL TÉCNICA

Implementa una barra vertical fija o sticky en el lateral izquierdo.

Contenido visual:

```text
● VIDEO MODE
│
SCROLL ADAPTIU
│
01
—
05
```

Requisitos:

- ancho máximo aproximado de 38 a 44 px en móvil;
- el contenido puede escribirse verticalmente;
- indicador naranja del progreso de la sección;
- contador dinámico 01/05, 02/05, etc.;
- no debe tapar el contenido principal;
- debe adaptarse a `safe-area-inset-left`;
- debe desaparecer o simplificarse en pantallas extremadamente estrechas;
- no debe consumir una franja excesiva del viewport.

---

## 10. RESPONSIVE MÓVIL

El diseño es **mobile-first y mobile-only como prioridad visual**, pero debe seguir funcionando correctamente cuando se abre en escritorio.

En escritorio:

- centra la experiencia en un viewport vertical;
- fondo exterior negro;
- ancho máximo aproximado de 430 a 480 px;
- no estires el diseño hasta llenar monitores panorámicos.

Prueba como mínimo:

```text
360 × 800
375 × 812
390 × 844
393 × 852
412 × 915
430 × 932
```

Considera:

- barras dinámicas del navegador móvil;
- `100dvh`, `100svh` y fallbacks;
- zonas seguras de iPhone;
- orientación vertical;
- densidades de píxel altas;
- dispositivos Android de gama media;
- ausencia de scroll horizontal.

---

## 11. ARQUITECTURA TÉCNICA

Prioriza una implementación mantenible con:

- HTML5 semántico;
- CSS moderno;
- JavaScript modular sin framework, salvo necesidad demostrada;
- Canvas 2D para la secuencia WebP;
- CSS 3D o WebGL solo para la transición tridimensional;
- `IntersectionObserver` para activar y pausar recursos;
- `requestAnimationFrame` para actualizaciones visuales;
- listeners pasivos cuando no sea necesario cancelar el evento;
- scroll nativo;
- variables CSS centralizadas;
- nombres de archivos versionados o con hash cuando corresponda.

No conviertas la landing a React, Next.js o un framework pesado si no aporta una ventaja concreta.

No uses dependencias externas de CDN para elementos críticos.

---

## 12. RENDIMIENTO Y ESTABILIDAD

Objetivos:

- primera imagen visible lo antes posible;
- interacción disponible tras cargar los recursos esenciales;
- navegación fluida a 60 fps cuando el dispositivo lo permita;
- memoria controlada;
- ninguna espera indefinida;
- ningún bloqueo al 99 % o 100 %;
- ningún salto de layout importante;
- recuperación ante un fotograma que falle;
- degradación funcional si WebGL no está disponible.

Aplica:

- `fetchpriority="high"` solo al primer fotograma o póster crítico;
- carga diferida del vídeo de la sección 02;
- caché larga para `/frames/`, vídeos y assets versionados;
- HTML con revalidación corta;
- `Content-Type` correcto para WebP y WebM;
- `Cache-Control` adecuado en `public/_headers`;
- no dupliques la misma secuencia en memoria;
- limpia `ImageBitmap`, object URLs y observers al dejar de usarlos;
- no uses 97 elementos `<img>` visibles u ocultos en el DOM.

---

## 13. ACCESIBILIDAD

Incluye:

- idioma principal `ca`;
- estructura de encabezados coherente;
- etiquetas de formulario;
- navegación por teclado;
- estados de foco visibles;
- contraste suficiente;
- mensajes de error accesibles;
- texto alternativo adecuado;
- `aria-live` para el estado del formulario;
- versión reducida para `prefers-reduced-motion`;
- contenido esencial legible aunque JavaScript falle.

No sacrifiques accesibilidad básica por estética.

---

## 14. SEO Y METADATOS

Configura como mínimo:

- título y descripción en catalán;
- canonical de `https://www.desorden.cat/`;
- Open Graph;
- Twitter Card;
- `theme-color` negro;
- favicon y manifest si ya existen;
- marcado estructurado de organización o profesional únicamente con datos confirmados;
- textos indexables en HTML.

No incrustes los titulares principales dentro de imágenes.

---

## 15. PRUEBAS OBLIGATORIAS

Mantén y amplía las pruebas existentes.

Verifica:

1. La ruta del primer fotograma responde correctamente.
2. La ruta del último fotograma responde correctamente.
3. Los archivos se sirven como `image/webp`.
4. La experiencia se desbloquea después de los fotogramas esenciales.
5. El resto se precarga en segundo plano.
6. El scroll alcanza el fotograma 97.
7. El scroll inverso vuelve al fotograma 1.
8. Una solicitud de fotograma reciente sustituye una decodificación obsoleta.
9. No hay errores JavaScript en carga, scroll rápido o cambio de tamaño.
10. El vídeo WebM se pausa fuera del viewport.
11. El contador lateral cambia de 01 a 05 correctamente.
12. `prefers-reduced-motion` muestra una alternativa estable.
13. El formulario valida sin enviar datos ficticios.
14. La landing funciona con conexión lenta y caché vacía.
15. No hay desplazamiento horizontal.

Ejecuta:

```bash
npm test
```

Añade las pruebas necesarias sin eliminar las existentes que sigan siendo válidas.

---

## 16. ARCHIVOS ESPERADOS

Adapta los nombres a la estructura real del proyecto, pero entrega como mínimo:

```text
public/index.html
public/assets/styles.[version].css
public/assets/app.[version].js
public/assets/scroll-sequence.[version].js
public/assets/cube-transition.[version].js
public/assets/contact.[version].js
public/_headers
public/404.html
package.json
wrangler.jsonc
tests/
README.md
CHANGELOG.md
```

No dupliques código arbitrariamente. Separa únicamente los módulos que mejoren la estabilidad y el mantenimiento.

No borres:

```text
public/frames/v1/
```

---

## 17. ENTREGA FINAL

Entrega todo lo siguiente:

1. **Diagnóstico inicial** del repositorio actual.
2. **Arquitectura propuesta** y justificación breve.
3. **Listado exacto de archivos creados, modificados y conservados**.
4. **Código completo**, no fragmentos parciales.
5. **Parche o rama preparada para revisión**.
6. **ZIP del proyecto final**, si el entorno lo permite.
7. **Resultados de las pruebas**.
8. **Informe de rendimiento y compatibilidad móvil**.
9. **Instrucciones de despliegue en Cloudflare Workers**, pero sin desplegar.
10. **Lista de datos pendientes**, únicamente cuando no puedan deducirse ni encontrarse en el proyecto.

No afirmes que una comprobación ha pasado si no la has ejecutado.

---

## 18. CRITERIOS DE ACEPTACIÓN

El trabajo se considera terminado únicamente cuando:

- la secuencia existente de 97 fotogramas está integrada en la primera sección;
- la pantalla de carga no puede quedarse bloqueada esperando todos los fotogramas;
- el desplazamiento es reversible y natural;
- las cinco secciones existen y están numeradas correctamente;
- el vídeo de silueta se usa en `QUI SOC`;
- la transición de letras cúbicas responde al scroll;
- el diseño sigue fielmente las referencias;
- la web mantiene negro, #EBB221 y Anton;
- no se inventan interacciones, verificaciones ni acreditaciones;
- el formulario es usable;
- la solución funciona en Cloudflare Workers con `./public/`;
- las pruebas pasan;
- no se ha realizado ningún despliegue sin aprobación.

---

## 19. FORMA DE TRABAJO

Trabaja de forma autónoma y toma decisiones técnicas razonables.

No interrumpas el proceso con preguntas menores.

Pregunta únicamente si falta un dato imprescindible que pueda provocar una publicación incorrecta, por ejemplo:

- teléfono real;
- correo real;
- destino real del formulario;
- acreditación que no pueda verificarse;
- derecho de uso de un recurso concreto.

Cuando falte uno de esos datos, usa una constante claramente marcada como pendiente y continúa construyendo el resto.

Empieza inspeccionando el repositorio y las referencias. Después implementa la landing completa y entrega el resultado preparado para revisión, sin publicar.