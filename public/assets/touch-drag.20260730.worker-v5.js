(() => {
  "use strict";

  const container = document.getElementById("scroll-container");
  if (!container) return;

  const isTouchViewport = window.matchMedia(
    "(hover: none), (pointer: coarse), (max-width: 900px)",
  );

  let active = false;
  let startY = 0;
  let startScrollY = 0;
  let lastY = 0;
  let lastTime = 0;
  let velocity = 0;
  let inertiaFrame = 0;

  const getScrollY = () =>
    window.scrollY ||
    document.scrollingElement?.scrollTop ||
    document.documentElement.scrollTop ||
    0;

  const stopInertia = () => {
    if (inertiaFrame) {
      window.cancelAnimationFrame(inertiaFrame);
      inertiaFrame = 0;
    }
  };

  const getScrollBounds = () => {
    const top = getScrollY() + container.getBoundingClientRect().top;
    const bottom = Math.max(
      top,
      top + container.offsetHeight - window.innerHeight,
    );
    return { top, bottom };
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const onTouchStart = (event) => {
    if (!isTouchViewport.matches || event.touches.length !== 1) return;

    stopInertia();
    active = true;
    startY = event.touches[0].clientY;
    lastY = startY;
    startScrollY = getScrollY();
    lastTime = performance.now();
    velocity = 0;
    document.documentElement.classList.add("is-touch-dragging");
    container.dataset.touchDirection = "down-advances";
  };

  const onTouchMove = (event) => {
    if (!active || event.touches.length !== 1) return;

    event.preventDefault();

    const now = performance.now();
    const currentY = event.touches[0].clientY;
    const deltaY = currentY - startY;
    const elapsed = Math.max(1, now - lastTime);
    velocity = (currentY - lastY) / elapsed;
    lastY = currentY;
    lastTime = now;

    const { top, bottom } = getScrollBounds();
    const targetScroll = clamp(startScrollY + deltaY, top, bottom);
    window.scrollTo(0, targetScroll);
  };

  const finishTouch = () => {
    if (!active) return;

    active = false;
    document.documentElement.classList.remove("is-touch-dragging");

    const { top, bottom } = getScrollBounds();
    let speed = velocity * 18;

    const coast = () => {
      speed *= 0.88;
      if (Math.abs(speed) < 0.35) {
        inertiaFrame = 0;
        return;
      }

      const current = getScrollY();
      const next = clamp(current + speed, top, bottom);
      window.scrollTo(0, next);

      if (next === top || next === bottom) {
        inertiaFrame = 0;
        return;
      }

      inertiaFrame = window.requestAnimationFrame(coast);
    };

    if (Math.abs(speed) >= 0.35) {
      inertiaFrame = window.requestAnimationFrame(coast);
    }
  };

  container.addEventListener("touchstart", onTouchStart, { passive: true });
  container.addEventListener("touchmove", onTouchMove, { passive: false });
  container.addEventListener("touchend", finishTouch, { passive: true });
  container.addEventListener("touchcancel", finishTouch, { passive: true });

  window.addEventListener("pagehide", stopInertia);
})();