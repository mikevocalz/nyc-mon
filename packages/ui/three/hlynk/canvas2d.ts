import { fontFamilies } from '@acme/theme';
import type { Three } from '../types';
import type { CanvasFont, CanvasSurface, Ctx2D } from './canvas2d-types';

/**
 * Web (and the platform resolution anchor): a document canvas and the
 * browser's own 2D context behind a `THREE.CanvasTexture`. The native fork
 * (canvas2d.native.ts) draws the same calls with Skia. Same `.ts` extension
 * as the fork, so Metro's `.native.ts` wins on device.
 */
export function createCanvasSurface(THREE: Three, width: number, height: number, scale = 1): CanvasSurface {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const raw = canvas.getContext('2d');
  // Callers draw in logical px; the backing store holds `scale` times as many (crisp glass text on tablets).
  if (scale !== 1) raw?.scale(scale, scale);
  // The browser context is a superset of Ctx2D; its fillStyle getter is wider, so a cast.
  const ctx = raw as unknown as Ctx2D;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return {
    ctx,
    width,
    height,
    texture,
    commit: () => {
      texture.needsUpdate = true;
    },
    // The canvas IS the texture's image here (uploaded lazily, re-uploaded by
    // a new renderer), so it stays; it goes with the texture at GC.
    dispose: () => undefined,
  };
}

/**
 * Canvas font string in the site's body face. next/font renames the family,
 * so the page's `--font-sans` wins; the token's stack is the fallback.
 */
export const canvasFont: CanvasFont = (size, weight = 700) => {
  const family = typeof document === 'undefined' ? '' : getComputedStyle(document.body).getPropertyValue('--font-sans').trim();
  return `${weight} ${size}px ${family ? `${family}, ` : ''}${fontFamilies.sans}`;
};

/** Calls `onReady` once the page's web fonts have loaded, so text drawn before then can be redrawn. */
export function whenFontsReady(onReady: () => void): void {
  if (typeof document === 'undefined') return;
  void document.fonts?.ready.then(onReady);
}
