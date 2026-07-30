(() => {
  "use strict";

  const TOTAL_FRAMES = 97;
  const canvas = document.getElementById("sequence-canvas");
  const scaleContainer = document.getElementById("scale-container");
  const textMover = document.getElementById("text-mover");
  const cinematicText = document.getElementById("cinematic-text");
  const counter = document.getElementById("tc-counter");

  if (!canvas || !scaleContainer || !textMover || !cinematicText || !counter) {
    return;
  }

  const clamp01 = (value) => Math.min(1, Math.max(0, value));

  const smoothstep = (edge0, edge1, value) => {
    const range = Math.max(0.0001, edge1 - edge0);
    const x = clamp01((value - edge0) / range);
    return x * x * (3 - 2 * x);
  };

  const updatePresentation = () => {
    const frameNumber = Math.max(
      1,
      Math.min(TOTAL_FRAMES, Number(canvas.dataset.currentFrame || 1)),
    );
    const index = frameNumber - 1;
    const progress = index / (TOTAL_FRAMES - 1);

    /* El canvas permanece a escala real. El movimiento aparente procede
       exclusivamente de los fotogramas y no de un segundo escalado CSS. */
    scaleContainer.style.transform = "none";

    /* La frase empieza a desplazarse cuando la venda ya ha iniciado su caída.
       La curva smoothstep evita la entrada lineal y mecánica de la versión V6. */
    const movement = smoothstep(0.2, 0.84, progress);
    const translateX = -16 + 16 * movement;
    const opacity = smoothstep(0.24, 0.5, progress);

    textMover.style.transform = `translate3d(${translateX}vw, 0, 0)`;
    cinematicText.style.opacity = String(opacity);
    counter.textContent = String(frameNumber).padStart(3, "0");
  };

  const observer = new MutationObserver(updatePresentation);
  observer.observe(canvas, {
    attributes: true,
    attributeFilter: ["data-current-frame"],
  });

  updatePresentation();
})();
