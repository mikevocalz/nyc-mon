import type { Three } from '../types';

/** A gradient from `createLinearGradient` / `createRadialGradient`. */
export interface Gradient2D {
  addColorStop(offset: number, color: string): void;
}

/** Raw RGBA pixels, row-major from the top-left, as `createImageData` returns them. */
export interface ImageData2D {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

/**
 * The slice of `CanvasRenderingContext2D` the H-Lynk scene draws with. On web
 * it is the browser's own context; on native it is drawn by Skia
 * (canvas2d.native.ts). Anything that paints a screen or a texture for the
 * device scene goes through this, so both platforms draw the same pixels
 * from the same code.
 */
export interface Ctx2D {
  fillStyle: string | Gradient2D;
  strokeStyle: string;
  lineWidth: number;
  lineCap: 'butt' | 'round' | 'square';
  lineJoin: 'miter' | 'round' | 'bevel';
  /** CSS font shorthand: `"<weight> <size>px <family>"`. */
  font: string;
  textAlign: 'left' | 'center' | 'right';
  textBaseline: 'middle' | 'alphabetic';
  fillRect(x: number, y: number, width: number, height: number): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): Gradient2D;
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): Gradient2D;
  createImageData(width: number, height: number): ImageData2D;
  putImageData(image: ImageData2D, x: number, y: number): void;
}

/** Canvas font string for a size (canvas px) and weight, in the body face. */
export type CanvasFont = (size: number, weight?: number) => string;

type Texture = InstanceType<Three['Texture']>;

/**
 * A 2D drawing surface backing one three.js texture. Draw with `ctx`, then
 * `commit()` to upload the new pixels. Nothing uploads per frame.
 */
export interface CanvasSurface {
  readonly ctx: Ctx2D;
  readonly width: number;
  readonly height: number;
  /** sRGB, mip-mapped, ready for a material map. */
  readonly texture: Texture;
  /** Flag the texture for upload after a redraw. */
  commit(): void;
}
