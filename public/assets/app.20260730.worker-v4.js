(() => {
  "use strict";

  window.__DESORDEN_BOOTED__ = true;

  const frameManifest = window.DESORDEN_FRAME_MANIFEST;

  if (
    !frameManifest ||
    !Array.isArray(frameManifest.files) ||
    frameManifest.files.length === 0
  ) {
    const loadingState = document.getElementById("loading-state");
    const errorState = document.getElementById("error-state");
    const errorMessage = document.getElementById("error-message");
    const retryButton = document.getElementById("retry-button");

    if (loadingState && errorState && errorMessage) {
      loadingState.hidden = true;
      errorState.hidden = false;
      errorMessage.textContent =
        "No se ha encontrado el manifiesto de fotogramas.";
      retryButton?.addEventListener("click", () => window.location.reload());
    }
    return;
  }

  const TOTAL_FRAMES = frameManifest.files.length;
  const INITIAL_PRELOAD_COUNT = Math.min(8, TOTAL_FRAMES);
  const INITIAL_FETCH_CONCURRENCY = 4;
  const BACKGROUND_FETCH_CONCURRENCY = 3;
  const FETCH_TIMEOUT_MS = 12000;
  const DECODE_CONCURRENCY = 2;
  const DECODE_CACHE_LIMIT = window.matchMedia("(max-width: 900px)").matches
    ? 6
    : 8;
  const MAX_DEVICE_PIXEL_RATIO = 2;
  const RELEASE_ID = "worker-v4-native-scroll";

  const root = document.documentElement;
  const experience = document.getElementById("scrollytelling");
  const preloader = document.getElementById("preloader");
  const loadingState = document.getElementById("loading-state");
  const loadingPercent = document.getElementById("loading-percent");
  const loadingDetail = document.getElementById("loading-detail");
  const progressTrack = document.getElementById("progress-track");
  const progressBar = document.getElementById("progress-bar");
  const errorState = document.getElementById("error-state");
  const errorMessage = document.getElementById("error-message");
  const retryButton = document.getElementById("retry-button");
  const container = document.getElementById("scroll-container");
  const canvas = document.getElementById("sequence-canvas");

  let loadGeneration = 0;
  let activeFetchControllers = new Set();
  let frameBlobs = new Array(TOTAL_FRAMES);
  let frameFetchPromises = new Map();
  let scrollCleanup = null;
  let decodedFrames = new Map();
  let decodePromises = new Map();
  let decodeQueue = [];
  let activeDecodes = 0;
  let priorityDecodeIndex = null;

  const setProgress = (
    loadedCount,
    totalCount = INITIAL_PRELOAD_COUNT,
  ) => {
    const safeTotal = Math.max(1, totalCount);
    const percent = Math.round((loadedCount / safeTotal) * 100);
    loadingPercent.textContent = `${percent}%`;
    loadingDetail.textContent =
      `${loadedCount} / ${totalCount} recursos esenciales`;
    progressTrack.setAttribute("aria-valuenow", String(percent));
    progressBar.style.width = `${percent}%`;
  };

  const lockScroll = () => {
    root.classList.add("is-loading");
  };

  const unlockScroll = () => {
    root.classList.remove("is-loading");
  };

  const showLoading = () => {
    experience.setAttribute("aria-busy", "true");
    preloader.hidden = false;
    loadingState.hidden = false;
    errorState.hidden = true;
    retryButton.disabled = true;
    setProgress(0);
    lockScroll();
  };

  const showError = (message) => {
    preloader.hidden = false;
    loadingState.hidden = true;
    errorState.hidden = false;
    retryButton.disabled = false;
    errorMessage.textContent =
      message || "No se pudo completar la carga de la secuencia.";
    lockScroll();
  };

  const getFramePath = (index) =>
    `/frames/${frameManifest.version}/${frameManifest.files[index]}`;

  const cancelActiveLoads = () => {
    loadGeneration += 1;
    activeFetchControllers.forEach((controller) => controller.abort());
    activeFetchControllers.clear();
    frameFetchPromises.clear();
    priorityDecodeIndex = null;
    decodeQueue.splice(0).forEach(({ reject }) => {
      reject(new Error("Carga cancelada."));
    });
  };

  const disposeDecodedFrames = () => {
    decodedFrames.forEach((entry) => entry.dispose());
    decodedFrames.clear();
    decodePromises.clear();
  };

  const fetchFrame = async (index, retry, generation) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      FETCH_TIMEOUT_MS,
    );
    activeFetchControllers.add(controller);

    try {
      const response = await fetch(getFramePath(index), {
        cache: retry > 0 ? "reload" : "force-cache",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `${frameManifest.files[index]} devuelve HTTP ${response.status}.`,
        );
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.toLowerCase().startsWith("image/")) {
        throw new Error(
          `${frameManifest.files[index]} no se está publicando como imagen.`,
        );
      }

      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error(`${frameManifest.files[index]} está vacío.`);
      }

      return blob;
    } catch (error) {
      if (error?.name === "AbortError") {
        if (generation !== loadGeneration) {
          throw new Error("Carga cancelada.");
        }
        throw new Error(
          `${frameManifest.files[index]} agotó el tiempo de espera.`,
        );
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
      activeFetchControllers.delete(controller);
    }
  };

  const fetchFrameWithRetry = async (index, generation) => {
    try {
      return await fetchFrame(index, 0, generation);
    } catch (error) {
      if (generation !== loadGeneration) {
        throw new Error("Carga cancelada.");
      }
      return fetchFrame(index, 1, generation);
    }
  };

  const getFrameBlob = (index, generation = loadGeneration) => {
    if (frameBlobs[index]) {
      return Promise.resolve(frameBlobs[index]);
    }

    const existingPromise = frameFetchPromises.get(index);
    if (existingPromise) return existingPromise;

    let promise;
    promise = fetchFrameWithRetry(index, generation)
      .then((blob) => {
        if (generation !== loadGeneration) {
          throw new Error("Carga cancelada.");
        }

        frameBlobs[index] = blob;
        return blob;
      })
      .finally(() => {
        if (frameFetchPromises.get(index) === promise) {
          frameFetchPromises.delete(index);
        }
      });

    frameFetchPromises.set(index, promise);
    return promise;
  };

  const preloadInitialFrames = async () => {
    const generation = loadGeneration;
    let nextIndex = 1;
    let loadedCount = 1;

    await getFrameBlob(0, generation);
    setProgress(loadedCount, INITIAL_PRELOAD_COUNT);

    const worker = async () => {
      while (generation === loadGeneration) {
        const index = nextIndex;
        nextIndex += 1;

        if (index >= INITIAL_PRELOAD_COUNT) return;

        try {
          await getFrameBlob(index, generation);
        } catch {
          if (generation !== loadGeneration) return;
        }

        loadedCount += 1;
        setProgress(loadedCount, INITIAL_PRELOAD_COUNT);
      }
    };

    await Promise.all(
      Array.from(
        {
          length: Math.min(
            INITIAL_FETCH_CONCURRENCY,
            Math.max(0, INITIAL_PRELOAD_COUNT - 1),
          ),
        },
        () => worker(),
      ),
    );

    if (generation !== loadGeneration) {
      throw new Error("Carga cancelada.");
    }
  };

  const preloadRemainingFrames = () => {
    const generation = loadGeneration;
    let nextIndex = INITIAL_PRELOAD_COUNT;
    let failedCount = 0;

    canvas.dataset.backgroundPreload = "loading";

    const worker = async () => {
      while (generation === loadGeneration) {
        const index = nextIndex;
        nextIndex += 1;

        if (index >= TOTAL_FRAMES) return;

        try {
          await getFrameBlob(index, generation);
        } catch {
          if (generation !== loadGeneration) return;
          failedCount += 1;
        }
      }
    };

    Promise.all(
      Array.from(
        {
          length: Math.min(
            BACKGROUND_FETCH_CONCURRENCY,
            Math.max(0, TOTAL_FRAMES - INITIAL_PRELOAD_COUNT),
          ),
        },
        () => worker(),
      ),
    ).then(() => {
      if (generation !== loadGeneration) return;
      canvas.dataset.backgroundPreload =
        failedCount === 0 ? "complete" : "partial";
      canvas.dataset.backgroundFailures = String(failedCount);
    });
  };

  const touchDecodedFrame = (index) => {
    const entry = decodedFrames.get(index);
    if (!entry) return null;

    decodedFrames.delete(index);
    decodedFrames.set(index, entry);
    return entry;
  };

  const pruneDecodedFrames = (preserve = new Set()) => {
    while (decodedFrames.size > DECODE_CACHE_LIMIT) {
      const candidate = decodedFrames.keys().next().value;
      if (candidate === undefined) return;

      if (preserve.has(candidate)) {
        const entry = decodedFrames.get(candidate);
        decodedFrames.delete(candidate);
        decodedFrames.set(candidate, entry);
        continue;
      }

      const entry = decodedFrames.get(candidate);
      entry?.dispose();
      decodedFrames.delete(candidate);
    }
  };

  const decodeBlob = async (blob) => {
    if ("createImageBitmap" in window) {
      const bitmap = await window.createImageBitmap(blob);
      return {
        image: bitmap,
        dispose: () => bitmap.close?.(),
      };
    }

    return new Promise((resolve, reject) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(blob);

      image.onload = () => {
        resolve({
          image,
          dispose: () => URL.revokeObjectURL(objectUrl),
        });
      };

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("El navegador no pudo decodificar un fotograma."));
      };

      image.src = objectUrl;
    });
  };

  const runDecodeQueue = () => {
    while (activeDecodes < DECODE_CONCURRENCY && decodeQueue.length > 0) {
      const task = decodeQueue.shift();

      if (task.generation !== loadGeneration) {
        task.reject(new Error("Carga cancelada."));
        continue;
      }

      activeDecodes += 1;
      decodeBlob(task.blob)
        .then(task.resolve, task.reject)
        .finally(() => {
          activeDecodes -= 1;
          runDecodeQueue();
        });
    }
  };

  const createDecodeSupersededError = () => {
    const error = new Error(
      "El fotograma se ha sustituido por una solicitud más reciente.",
    );
    error.name = "DecodeSupersededError";
    return error;
  };

  const prioritizeDecodeQueue = (index) => {
    priorityDecodeIndex = index;

    const preferredTask = decodeQueue.find(
      (task) => task.index === index,
    );

    decodeQueue
      .filter((task) => task !== preferredTask)
      .forEach(({ reject }) => {
        reject(createDecodeSupersededError());
      });

    decodeQueue = preferredTask ? [preferredTask] : [];
    runDecodeQueue();
  };

  const decodeBlobQueued = (blob, generation, index, priority = false) =>
    new Promise((resolve, reject) => {
      const hasUnresolvedPriority =
        priorityDecodeIndex !== null &&
        priorityDecodeIndex !== index &&
        decodePromises.has(priorityDecodeIndex) &&
        !decodedFrames.has(priorityDecodeIndex);

      if (!priority && hasUnresolvedPriority) {
        reject(createDecodeSupersededError());
        return;
      }

      const task = {
        blob,
        generation,
        index,
        resolve,
        reject,
      };

      if (priority || index === priorityDecodeIndex) {
        decodeQueue.unshift(task);
      } else {
        decodeQueue.push(task);
      }

      runDecodeQueue();
    });

  const getDecodedFrame = async (index, priority = false) => {
    if (priority) {
      prioritizeDecodeQueue(index);
    }

    const cached = touchDecodedFrame(index);
    if (cached) return cached;

    if (decodePromises.has(index)) {
      return decodePromises.get(index);
    }

    const generation = loadGeneration;
    let promise;
    promise = getFrameBlob(index, generation)
      .then((blob) => {
        if (priority && index !== priorityDecodeIndex) {
          throw createDecodeSupersededError();
        }

        return decodeBlobQueued(
          blob,
          generation,
          index,
          index === priorityDecodeIndex,
        );
      })
      .then((entry) => {
        if (generation !== loadGeneration) {
          entry.dispose();
          throw new Error("Carga cancelada.");
        }

        decodedFrames.set(index, entry);
        pruneDecodedFrames(
          new Set(
            [index, priorityDecodeIndex].filter(Number.isInteger),
          ),
        );
        return entry;
      })
      .finally(() => {
        if (decodePromises.get(index) === promise) {
          decodePromises.delete(index);
        }
      });

    decodePromises.set(index, promise);
    return promise;
  };

  const setupCanvas = async () => {
    const context2d = canvas.getContext("2d", {
      alpha: true,
      desynchronized: true,
    });

    if (!context2d) {
      throw new Error("El navegador no ha podido iniciar el lienzo interactivo.");
    }

    await getDecodedFrame(0, true);

    const sequenceState = { frame: 0 };
    let desiredFrame = 0;
    let lastDrawnFrame = -1;
    let renderToken = 0;
    let resizeFrame = 0;
    let refreshFrame = 0;
    let scrollFrame = 0;
    let resizeTimer = 0;
    let scrollStart = 0;
    let scrollRange = 1;
    let movementDirection = 1;

    const drawFrame = (entry, frameIndex) => {
      const image = entry.image;
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const imageWidth = image.naturalWidth || image.width;
      const imageHeight = image.naturalHeight || image.height;
      const viewportRatio = canvasWidth / canvasHeight;
      const useContain = viewportRatio > 0.68;
      const scale = useContain
        ? Math.min(
            canvasWidth / imageWidth,
            canvasHeight / imageHeight,
          )
        : Math.max(
            canvasWidth / imageWidth,
            canvasHeight / imageHeight,
          );
      const drawWidth = imageWidth * scale;
      const drawHeight = imageHeight * scale;
      const x = (canvasWidth - drawWidth) / 2;
      const y = useContain
        ? (canvasHeight - drawHeight) / 2
        : canvasHeight - drawHeight;

      context2d.clearRect(0, 0, canvasWidth, canvasHeight);
      context2d.imageSmoothingEnabled = true;
      context2d.imageSmoothingQuality = "high";
      context2d.drawImage(image, x, y, drawWidth, drawHeight);
      canvas.dataset.currentFrame = String(frameIndex + 1);
      canvas.dataset.frameLoadError = "";
      lastDrawnFrame = frameIndex;
    };

    const warmNearbyFrames = (frameIndex) => {
      const preferredIndex = frameIndex + movementDirection;
      const fallbackIndex = frameIndex - movementDirection;
      const index =
        preferredIndex >= 0 && preferredIndex < TOTAL_FRAMES
          ? preferredIndex
          : fallbackIndex;

      if (index >= 0 && index < TOTAL_FRAMES) {
        getDecodedFrame(index).catch(() => {});
      }
    };

    const render = (force = false) => {
      const frameIndex = Math.min(
        TOTAL_FRAMES - 1,
        Math.max(0, Math.round(sequenceState.frame)),
      );

      const targetChanged = frameIndex !== desiredFrame;
      const priorityChanged = frameIndex !== priorityDecodeIndex;
      desiredFrame = frameIndex;
      canvas.dataset.desiredFrame = String(frameIndex + 1);
      if (
        !targetChanged &&
        !priorityChanged &&
        !force &&
        frameIndex === lastDrawnFrame
      ) {
        return;
      }

      const token = ++renderToken;
      if (priorityChanged) {
        prioritizeDecodeQueue(frameIndex);
      }
      if (!force && frameIndex === lastDrawnFrame) return;
      const cached = touchDecodedFrame(frameIndex);

      if (cached) {
        drawFrame(cached, frameIndex);
        warmNearbyFrames(frameIndex);
        return;
      }

      getDecodedFrame(frameIndex, true)
        .then((entry) => {
          if (token !== renderToken || frameIndex !== desiredFrame) return;
          drawFrame(entry, frameIndex);
          warmNearbyFrames(frameIndex);
        })
        .catch((error) => {
          if (error?.name === "DecodeSupersededError") {
            if (token === renderToken && frameIndex === desiredFrame) {
              window.requestAnimationFrame(() => render(true));
            }
            return;
          }

          canvas.dataset.frameLoadError =
            error instanceof Error ? error.message : "Error de carga.";
        });
    };

    const clampFrame = (frame) =>
      Math.min(TOTAL_FRAMES - 1, Math.max(0, frame));

    const getScrollTop = () =>
      window.scrollY ||
      document.scrollingElement?.scrollTop ||
      document.documentElement.scrollTop ||
      0;

    const updateScrollMetrics = () => {
      const bounds = container.getBoundingClientRect();
      scrollStart = getScrollTop() + bounds.top;
      scrollRange = Math.max(
        1,
        container.offsetHeight - window.innerHeight,
      );
      canvas.dataset.scrollRange = String(Math.round(scrollRange));
    };

    const setFrameFromInput = (frame, source) => {
      const nextFrame = clampFrame(frame);
      if (nextFrame > sequenceState.frame) {
        movementDirection = 1;
      } else if (nextFrame < sequenceState.frame) {
        movementDirection = -1;
      }
      sequenceState.frame = nextFrame;
      canvas.dataset.scrollProgress = (
        nextFrame / Math.max(1, TOTAL_FRAMES - 1)
      ).toFixed(4);
      canvas.dataset.inputSource = source;
      render();
      return nextFrame;
    };

    const updateFromDocumentScroll = () => {
      const progress = Math.min(
        1,
        Math.max(0, (getScrollTop() - scrollStart) / scrollRange),
      );
      setFrameFromInput(
        progress * (TOTAL_FRAMES - 1),
        "document-scroll",
      );
    };

    const scheduleScrollUpdate = () => {
      if (scrollFrame) return;

      scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = 0;
        updateFromDocumentScroll();
      });
    };

    const resizeCanvas = () => {
      const bounds = canvas.getBoundingClientRect();
      const sourcePixelRatioLimit = Math.min(
        frameManifest.width / Math.max(1, bounds.width),
        frameManifest.height / Math.max(1, bounds.height),
      );
      const devicePixelRatio = Math.max(
        0.5,
        Math.min(
          window.devicePixelRatio || 1,
          MAX_DEVICE_PIXEL_RATIO,
          sourcePixelRatioLimit,
        ),
      );
      const nextWidth = Math.max(
        1,
        Math.round(bounds.width * devicePixelRatio),
      );
      const nextHeight = Math.max(
        1,
        Math.round(bounds.height * devicePixelRatio),
      );

      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
        lastDrawnFrame = -1;
      }

      render(true);
    };

    const scheduleResize = () => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(resizeCanvas);

      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resizeCanvas();
        updateScrollMetrics();
        updateFromDocumentScroll();
      }, 180);
    };

    resizeCanvas();
    updateScrollMetrics();
    updateFromDocumentScroll();
    canvas.dataset.controller = "native-v4";

    const resizeObserver =
      "ResizeObserver" in window
        ? new ResizeObserver(scheduleResize)
        : null;

    resizeObserver?.observe(canvas);
    window.addEventListener("scroll", scheduleScrollUpdate, {
      passive: true,
    });
    window.addEventListener("resize", scheduleResize);
    window.addEventListener("orientationchange", scheduleResize);
    window.visualViewport?.addEventListener("resize", scheduleResize);

    refreshFrame = window.requestAnimationFrame(() => {
      updateScrollMetrics();
      updateFromDocumentScroll();
      render(true);
    });

    return () => {
      window.cancelAnimationFrame(resizeFrame);
      window.cancelAnimationFrame(refreshFrame);
      window.cancelAnimationFrame(scrollFrame);
      window.clearTimeout(resizeTimer);
      resizeObserver?.disconnect();
      window.removeEventListener("scroll", scheduleScrollUpdate);
      window.removeEventListener("resize", scheduleResize);
      window.removeEventListener("orientationchange", scheduleResize);
      window.visualViewport?.removeEventListener("resize", scheduleResize);
    };
  };

  const start = async () => {
    cancelActiveLoads();
    const generation = loadGeneration;
    scrollCleanup?.();
    scrollCleanup = null;
    frameBlobs = new Array(TOTAL_FRAMES);
    frameFetchPromises = new Map();
    disposeDecodedFrames();
    showLoading();

    try {
      await preloadInitialFrames();
      if (generation !== loadGeneration) return;

      setProgress(INITIAL_PRELOAD_COUNT, INITIAL_PRELOAD_COUNT);
      unlockScroll();
      scrollCleanup = await setupCanvas();

      if (generation !== loadGeneration) {
        scrollCleanup?.();
        scrollCleanup = null;
        return;
      }

      preloader.hidden = true;
      retryButton.disabled = false;
      experience.setAttribute("aria-busy", "false");
      preloadRemainingFrames();
    } catch (error) {
      if (generation !== loadGeneration) return;

      cancelActiveLoads();
      showError(
        error instanceof Error
          ? error.message
          : "No se pudo completar la carga de la secuencia.",
      );
    }
  };

  retryButton.addEventListener("click", start);

  window.addEventListener("pagehide", () => {
    cancelActiveLoads();
    scrollCleanup?.();
    scrollCleanup = null;
    disposeDecodedFrames();
  });

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) start();
  });

  container.dataset.frameCount = String(TOTAL_FRAMES);
  container.dataset.release = RELEASE_ID;
  start();
})();
