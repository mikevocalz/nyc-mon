/** Reanimated's web worklets also initialize while the admin renders in Node. */
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback) =>
    setTimeout(() => callback(performance.now()), 0) as unknown as number;
}
if (typeof globalThis.cancelAnimationFrame === 'undefined') {
  globalThis.cancelAnimationFrame = (id: number | null | undefined) => {
    if (id != null) clearTimeout(id);
  };
}

export {};
