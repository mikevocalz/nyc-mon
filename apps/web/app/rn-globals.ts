// RN globals for transpiled RN packages (replaces webpack DefinePlugin).
declare const globalThis: Record<string, unknown>;
declare const process: { env: Record<string, string | undefined> };
if (typeof globalThis.__DEV__ === 'undefined') {
  globalThis.__DEV__ = process.env.NODE_ENV !== 'production';
}
// Reanimated's web bundle schedules its CSS-animation frame loop when an
// Animated component renders, which also happens during SSR prerender.
// In worklets-bundle mode it polyfills requestAnimationFrame itself; do the
// same for Node so a scheduled frame resolves instead of throwing.
// No-ops in the browser, where both globals exist.
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback) =>
    setTimeout(() => callback(performance.now()), 0) as unknown as number;
}
if (typeof globalThis.cancelAnimationFrame === 'undefined') {
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}
export {};
