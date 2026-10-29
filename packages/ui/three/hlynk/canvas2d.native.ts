import {
  AlphaType, BlendMode, ColorType, PaintStyle, Skia, StrokeCap, StrokeJoin, TileMode, matchFont,
  type SkCanvas, type SkFont, type SkPaint, type SkPathBuilder, type SkShader, type SkSurface,
} from 'react-native-skia';
import { fontFamilies } from '@acme/theme';
import type { Three } from '../types';
import { registerReleasable } from '../release.ts';
import type { CanvasFont, CanvasSurface, Ctx2D, Gradient2D, ImageData2D } from './canvas2d-types';

/**
 * Native: there is no DOM canvas, so the same Ctx2D calls the web makes on
 * its <canvas> are drawn by Skia into a CPU raster surface. `commit()`
 * snapshots it, reads the RGBA pixels back and hands them to a
 * `THREE.DataTexture`, flipped to three's bottom-up rows. A raster surface
 * keeps the read-back a memcpy: no GPU round trip, no stall on the render
 * thread. Repaints happen on state changes (a new tab, a hover, a focus),
 * never per frame.
 */

/** The body face's first family, unquoted: what expo-font registered on device ("Space Grotesk"). */
const BODY_FAMILY = (fontFamilies.sans.split(',')[0] ?? '').replace(/['"]/g, '').trim();

export const canvasFont: CanvasFont = (size, weight = 700) => `${weight} ${size}px ${BODY_FAMILY}`;

/** Native has no web-font load to wait for: fonts are bundled. */
export function whenFontsReady(_onReady: () => void): void {}

const fonts = new Map<string, SkFont>();
// releaseHLynkResources empties it with the GLB caches; the glass rematches on its next paint.
registerReleasable({
  name: 'skia-fonts',
  releaseAll: () => {
    const freed = fonts.size;
    fonts.clear();
    return { freed, deferred: 0 };
  },
});
/** Parses `"700 32px Family"` (canvasFont's shape) into a cached Skia font from the system font manager. */
function skFont(spec: string): SkFont {
  const cached = fonts.get(spec);
  if (cached) return cached;
  const match = /^(\d{3})\s+(\d+(?:\.\d+)?)px\s+(.+)$/.exec(spec.trim());
  const weight = (match?.[1] ?? '400') as '400';
  const size = Number(match?.[2] ?? 16);
  const family = (match?.[3] ?? BODY_FAMILY).split(',')[0]?.replace(/['"]/g, '').trim() || 'System';
  const font = matchFont({ fontFamily: family, fontSize: size, fontWeight: weight });
  fonts.set(spec, font);
  return font;
}

function textWidth(font: SkFont, text: string): number {
  const widths = font.getGlyphWidths(font.getGlyphIDs(text));
  let sum = 0;
  for (const w of widths) sum += w;
  return sum;
}

type Stops = { offset: number; color: string }[];
class Gradient implements Gradient2D {
  readonly stops: Stops = [];
  constructor(readonly make: (colors: ReturnType<typeof Skia.Color>[], positions: number[]) => SkShader) {}
  addColorStop(offset: number, color: string): void {
    this.stops.push({ offset, color });
  }
  shader(): SkShader {
    const sorted = [...this.stops].sort((a, b) => a.offset - b.offset);
    return this.make(sorted.map((s) => Skia.Color(s.color)), sorted.map((s) => s.offset));
  }
}

const CAPS = { butt: StrokeCap.Butt, round: StrokeCap.Round, square: StrokeCap.Square } as const;
const JOINS = { miter: StrokeJoin.Miter, round: StrokeJoin.Round, bevel: StrokeJoin.Bevel } as const;

class SkiaContext2D implements Ctx2D {
  fillStyle: string | Gradient2D = '#000';
  strokeStyle = '#000';
  lineWidth = 1;
  lineCap: Ctx2D['lineCap'] = 'butt';
  lineJoin: Ctx2D['lineJoin'] = 'miter';
  font = canvasFont(10, 400);
  textAlign: Ctx2D['textAlign'] = 'left';
  textBaseline: Ctx2D['textBaseline'] = 'alphabetic';
  private path: SkPathBuilder = Skia.PathBuilder.Make();

  constructor(private readonly canvas: SkCanvas) {}

  private fillPaint(): SkPaint {
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setStyle(PaintStyle.Fill);
    const style = this.fillStyle;
    if (style instanceof Gradient) paint.setShader(style.shader());
    else paint.setColor(Skia.Color(typeof style === 'string' ? style : '#000'));
    return paint;
  }

  fillRect(x: number, y: number, width: number, height: number): void {
    this.canvas.drawRect(Skia.XYWHRect(x, y, width, height), this.fillPaint());
  }

  fillText(text: string, x: number, y: number): void {
    const font = skFont(this.font);
    let left = x;
    if (this.textAlign !== 'left') {
      const width = textWidth(font, text);
      left = this.textAlign === 'center' ? x - width / 2 : x - width;
    }
    let baseline = y;
    if (this.textBaseline === 'middle') {
      // Canvas 'middle' sits on the em box's centre; Skia draws on the baseline.
      const { ascent, descent } = font.getMetrics();
      baseline = y - (ascent + descent) / 2;
    }
    this.canvas.drawText(text, left, baseline, this.fillPaint(), font);
  }

  measureText(text: string): { width: number } {
    return { width: textWidth(skFont(this.font), text) };
  }

  beginPath(): void {
    this.path = Skia.PathBuilder.Make();
  }
  moveTo(x: number, y: number): void {
    this.path.moveTo(x, y);
  }
  lineTo(x: number, y: number): void {
    this.path.lineTo(x, y);
  }
  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void {
    this.path.arcToTangent(x1, y1, x2, y2, radius);
  }
  closePath(): void {
    this.path.close();
  }
  fill(): void {
    this.canvas.drawPath(this.path.build(), this.fillPaint());
  }
  stroke(): void {
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setStyle(PaintStyle.Stroke);
    paint.setStrokeWidth(this.lineWidth);
    paint.setStrokeCap(CAPS[this.lineCap]);
    paint.setStrokeJoin(JOINS[this.lineJoin]);
    paint.setColor(Skia.Color(this.strokeStyle));
    this.canvas.drawPath(this.path.build(), paint);
  }

  createLinearGradient(x0: number, y0: number, x1: number, y1: number): Gradient2D {
    return new Gradient((colors, positions) =>
      Skia.Shader.MakeLinearGradient(Skia.Point(x0, y0), Skia.Point(x1, y1), colors, positions, TileMode.Clamp));
  }
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): Gradient2D {
    return new Gradient((colors, positions) =>
      Skia.Shader.MakeTwoPointConicalGradient(Skia.Point(x0, y0), r0, Skia.Point(x1, y1), r1, colors, positions, TileMode.Clamp));
  }

  createImageData(width: number, height: number): ImageData2D {
    return { data: new Uint8ClampedArray(width * height * 4), width, height };
  }
  putImageData(image: ImageData2D, x: number, y: number): void {
    const bytes = new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.byteLength);
    const img = Skia.Image.MakeRasterImage(
      { width: image.width, height: image.height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul },
      Skia.Data.fromBytes(bytes),
      image.width * 4,
    );
    if (!img) return;
    // putImageData replaces pixels; it never blends.
    const paint = Skia.Paint();
    paint.setBlendMode(BlendMode.Src);
    this.canvas.drawImage(img, x, y, paint);
    img.dispose();
  }
}

export function createCanvasSurface(THREE: Three, width: number, height: number, scale = 1): CanvasSurface {
  // Callers draw in logical px; the raster holds `scale` times as many (crisp glass text on tablets).
  const pw = Math.round(width * scale);
  const ph = Math.round(height * scale);
  const surface: SkSurface | null = Skia.Surface.MakeRaster(pw, ph) ?? Skia.Surface.MakeOffscreen(pw, ph);
  if (!surface) throw new Error(`[hlynk] Skia could not make a ${pw}x${ph} surface`);
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('transparent'));
  if (scale !== 1) canvas.scale(scale, scale);
  const ctx = new SkiaContext2D(canvas);
  const data = new Uint8Array(pw * ph * 4);
  const texture = new THREE.DataTexture(data, pw, ph, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const row = pw * 4;
  const commit = () => {
    surface.flush();
    // A snapshot is a full raster copy in native memory; free it now, not at a GC that cannot see its size.
    const snapshot = surface.makeImageSnapshot();
    const pixels = snapshot.readPixels(0, 0, {
      width: pw, height: ph, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul,
    });
    snapshot.dispose();
    if (!(pixels instanceof Uint8Array)) return;
    // Skia rows run top-down; a DataTexture's first row is v = 0, the bottom.
    for (let y = 0; y < ph; y++) {
      data.set(pixels.subarray(y * row, (y + 1) * row), (ph - 1 - y) * row);
    }
    texture.needsUpdate = true;
  };
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    surface.dispose();
  };
  return { ctx, width, height, texture, commit: () => (disposed ? undefined : commit()), dispose };
}
