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

  const updatePresentation = () => {
    const frameNumber = Math.max(
      1,
      Math.min(TOTAL_FRAMES, Number(canvas.dataset.currentFrame || 1)),
    );
    const index = frameNumber - 1;
    const progress = index / (TOTAL_FRAMES - 1);
    const scale = 0.92 - 0.12 * progress;
    const translateX = -25 + 25 * progress;
    const opacity = Math.min(1, progress * 1.5);

    scaleContainer.style.transform = `scale(${scale})`;
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
