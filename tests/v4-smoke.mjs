import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const waitUntil = async (predicate, timeout = 1000) => {
  const startedAt = Date.now();

  while (!predicate()) {
    if (Date.now() - startedAt > timeout) {
      throw new Error("Timed out waiting for the application state.");
    }
    await wait(5);
  }
};

test("the latest requested frame supersedes stale queued decodes", async () => {
  const totalFrames = 20;
  const viewportHeight = 1000;
  const scrollRange = 2500;
  const files = Array.from(
    { length: totalFrames },
    (_, index) => `frame-${String(index + 1).padStart(3, "0")}.webp`,
  );
  const fileIndexes = new Map(
    files.map((file, index) => [file, index]),
  );
  const windowListeners = new Map();
  const decodeStarts = [];
  let scrollY = 0;
  let animationFrameId = 0;

  const addListener = (store, type, listener) => {
    if (!store.has(type)) store.set(type, new Set());
    store.get(type).add(listener);
  };

  const removeListener = (store, type, listener) => {
    store.get(type)?.delete(listener);
  };

  const createClassList = () => {
    const values = new Set();
    return {
      add: (...names) => names.forEach((name) => values.add(name)),
      remove: (...names) => names.forEach((name) => values.delete(name)),
      contains: (name) => values.has(name),
    };
  };

  const createElement = (id) => {
    const listeners = new Map();
    const attributes = new Map();

    return {
      id,
      classList: createClassList(),
      dataset: {},
      style: {},
      hidden: false,
      disabled: false,
      textContent: "",
      width: 300,
      height: 150,
      offsetHeight: id === "scroll-container"
        ? viewportHeight + scrollRange
        : viewportHeight,
      addEventListener(type, listener) {
        addListener(listeners, type, listener);
      },
      removeEventListener(type, listener) {
        removeListener(listeners, type, listener);
      },
      setAttribute(name, value) {
        attributes.set(name, String(value));
      },
      getAttribute(name) {
        return attributes.get(name) ?? null;
      },
      getBoundingClientRect() {
        if (id === "scroll-container") {
          return {
            top: -scrollY,
            left: 0,
            width: 600,
            height: viewportHeight + scrollRange,
          };
        }
        return {
          top: 0,
          left: 0,
          width: 600,
          height: viewportHeight,
        };
      },
      getContext() {
        if (id !== "sequence-canvas") return null;
        return {
          clearRect() {},
          drawImage() {},
          imageSmoothingEnabled: true,
          imageSmoothingQuality: "high",
        };
      },
    };
  };

  const elementIds = [
    "scrollytelling",
    "preloader",
    "loading-state",
    "loading-percent",
    "loading-detail",
    "progress-track",
    "progress-bar",
    "error-state",
    "error-message",
    "retry-button",
    "scroll-container",
    "sequence-canvas",
  ];
  const elements = new Map(
    elementIds.map((id) => [id, createElement(id)]),
  );
  const root = createElement("html");
  const body = createElement("body");

  const requestAnimationFrame = (callback) => {
    const id = ++animationFrameId;
    setTimeout(() => callback(Date.now()), 0);
    return id;
  };

  const windowObject = {
    DESORDEN_FRAME_MANIFEST: {
      version: "test",
      width: 1080,
      height: 1920,
      files,
    },
    innerHeight: viewportHeight,
    devicePixelRatio: 1,
    visualViewport: {
      addEventListener() {},
      removeEventListener() {},
    },
    location: {
      reload() {},
    },
    matchMedia() {
      return { matches: false };
    },
    addEventListener(type, listener) {
      addListener(windowListeners, type, listener);
    },
    removeEventListener(type, listener) {
      removeListener(windowListeners, type, listener);
    },
    requestAnimationFrame,
    cancelAnimationFrame() {},
    setTimeout,
    clearTimeout,
    async createImageBitmap(blob) {
      decodeStarts.push(blob.index);
      await wait(blob.index === 0 ? 1 : 150);
      return {
        width: 1080,
        height: 1920,
        close() {},
      };
    },
    async fetch(path) {
      const file = String(path).split("/").at(-1);
      const index = fileIndexes.get(file);
      assert.notEqual(index, undefined);
      return {
        ok: true,
        status: 200,
        headers: {
          get: () => "image/webp",
        },
        blob: async () => ({
          index,
          size: 1,
        }),
      };
    },
  };

  Object.defineProperty(windowObject, "scrollY", {
    get: () => scrollY,
  });

  const documentObject = {
    documentElement: root,
    body,
    scrollingElement: root,
    getElementById: (id) => elements.get(id) ?? null,
  };

  Object.defineProperty(root, "scrollTop", {
    get: () => scrollY,
  });

  class ResizeObserver {
    observe() {}
    disconnect() {}
  }

  Object.assign(globalThis, {
    window: windowObject,
    document: documentObject,
    fetch: windowObject.fetch,
    ResizeObserver,
  });

  const appSource = await readFile(
    new URL("../public/assets/app.20260730.worker-v4.js", import.meta.url),
    "utf8",
  );
  vm.runInThisContext(appSource, {
    filename: "app.20260730.worker-v4.js",
  });

  const preloader = elements.get("preloader");
  const canvas = elements.get("sequence-canvas");
  await waitUntil(() => preloader.hidden, 1000);

  assert.equal(canvas.dataset.currentFrame, "1");
  assert.equal(canvas.dataset.controller, "native-v4");
  assert.equal(root.classList.contains("is-loading"), false);

  const scrollToFrame = async (frameIndex) => {
    scrollY = (frameIndex / (totalFrames - 1)) * scrollRange;
    for (const listener of windowListeners.get("scroll") ?? []) {
      listener();
    }
    await wait(5);
  };

  await scrollToFrame(19);
  await scrollToFrame(10);
  await scrollToFrame(11);
  await scrollToFrame(12);
  await waitUntil(() => canvas.dataset.currentFrame === "13", 600);

  assert.equal(canvas.dataset.desiredFrame, "13");
  assert.equal(decodeStarts.includes(10), false);
  assert.equal(decodeStarts.includes(11), false);

  await scrollToFrame(0);
  assert.equal(canvas.dataset.currentFrame, "1");
  assert.equal(canvas.dataset.desiredFrame, "1");
  assert.equal(canvas.dataset.frameLoadError, "");
});
