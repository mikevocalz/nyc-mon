// Labels drawn by Skia straight into WebGPU textures that three samples:
// licence plates, street-name blades, bus destination signs. Slop New York
// draws these on DOM canvases (js/actor-models.js plate texture,
// js/street-details.js sign blades); React Native has no DOM canvas, so on
// the shared device Skia draws them instead, with no copy (gate G9,
// docs/adr/0026-one-gpu-device.md).
//
// Glyphs come from world/pixel-font.ts, so no font file is involved and the
// lettering matches the vertex-quad signs already in the city. Where the
// device is not shared, or Skia is absent on the runtime, the same rects go
// into a byte array for a DataTexture: one layout, two back ends.
//
// APIs, as installed:
// - react-native-skia 3.6.1 lib/typescript/src/skia/types/:
//   Surface/SurfaceFactory.d.ts `MakeFromGPUTexture` (needs RENDER_ATTACHMENT;
//   TEXTURE_BINDING to sample), Surface/Surface.d.ts `flush(sync)`,
//   Canvas.d.ts `clear` / `drawRect`, Skia.d.ts `XYWHRect` / `Paint`,
//   Paint/Paint.d.ts `setColor` / `setAntiAlias`, Color.d.ts `SkColor`
//   (Float32Array), JsiInstance.d.ts `dispose`.
// - three 0.186.1 src/textures/ExternalTexture.js `ExternalTexture`: the
//   WebGPU backend binds `sourceTexture` as is and never uploads to or
//   destroys it (build/three.webgpu.js WebGPUTextureUtils.createTexture,
//   `if ( texture.isExternalTexture )`, ~L79611; destroyTexture ~L79777).
//
// Pure: Skia and three arrive as arguments, so node tests and the worklet
// render runtime (which must not import react-native) can both load it.
import type * as ThreeWebGpu from 'three/webgpu';
import { CITY_COLORS, hexToRgb } from '../world/palette.ts';
import { GLYPH_HEIGHT, GLYPHS, GLYPH_ORDER, GLYPH_WIDTH, layoutText } from '../world/pixel-font.ts';

type Three = typeof ThreeWebGpu;

/** The slice of a react-native-skia 3.6.1 `SkRect` this module reads. */
export interface SkiaRectLike { x: number; y: number; width: number; height: number }

export interface SkiaPaintLike {
  setColor(color: Float32Array): void;
  setAntiAlias(aa: boolean): void;
  dispose(): void;
}

export interface SkiaCanvasLike {
  clear(color: Float32Array): void;
  drawRect(rect: SkiaRectLike, paint: SkiaPaintLike): void;
}

export interface SkiaSurfaceLike {
  getCanvas(): SkiaCanvasLike;
  flush(sync?: boolean): void;
  dispose(): void;
}

/** The parts of the react-native-skia 3.6.1 `Skia` API the bridge and the device probes call. */
export interface SkiaInterop {
  getNativeDevice(): bigint;
  Surface: { MakeFromGPUTexture(texture: GPUTexture): SkiaSurfaceLike };
  Image: { MakeImageFromGPUTexture(texture: GPUTexture): { dispose(): void } };
  XYWHRect(x: number, y: number, width: number, height: number): SkiaRectLike;
  Paint(): SkiaPaintLike;
}

/** Linear 0..1 RGBA, as Skia's SkColor holds it. */
export type Rgba = readonly [number, number, number, number];

/** WebGPU spec values (https://www.w3.org/TR/webgpu/#typedefdef-gputextureusageflags); every runtime agrees on them. */
export const TEXTURE_USAGE = { COPY_SRC: 0x01, COPY_DST: 0x02, TEXTURE_BINDING: 0x04, RENDER_ATTACHMENT: 0x10 } as const;

/** Skia draws, three samples, the probes read back: render target, sampled, copy source. */
export const SKIA_TEXTURE_USAGE = TEXTURE_USAGE.RENDER_ATTACHMENT | TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.COPY_SRC;

/** 8-bit RGBA: the DataTexture fallback's layout too, so both paths hold the same bytes. */
export const SKIA_TEXTURE_FORMAT: GPUTextureFormat = 'rgba8unorm';

export function rgba(hex: string, alpha = 1): Rgba {
  const [r, g, b] = hexToRgb(hex);
  return [r, g, b, alpha];
}

/** A label: one line of pixel-font capitals on a plain ground. */
export interface LabelSpec {
  text: string;
  ground: Rgba;
  ink: Rgba;
  /** Texels per font pixel. */
  scale: number;
  /** Margin around the text, in font pixels. */
  pad: number;
}

/**
 * The three label kinds Slop draws on canvases, coloured from the city
 * palette (tokens via world/palette.ts): the NYC blade is white on sign
 * green, a plate dark on white, a bus destination amber on dark.
 */
export const LABEL_STYLES = {
  blade: { ground: rgba(CITY_COLORS.signGreen), ink: rgba(CITY_COLORS.signText), scale: 4, pad: 2 },
  plate: { ground: rgba(CITY_COLORS.signText), ink: rgba(CITY_COLORS.pole), scale: 4, pad: 2 },
  destination: { ground: rgba(CITY_COLORS.pole), ink: rgba(CITY_COLORS.windowAmber), scale: 4, pad: 2 },
} as const satisfies Record<string, Omit<LabelSpec, 'text'>>;

export type LabelKind = keyof typeof LABEL_STYLES;

export function label(kind: LabelKind, text: string): LabelSpec {
  return { text, ...LABEL_STYLES[kind] };
}

export function labelSize(spec: LabelSpec): { width: number; height: number } {
  const { width } = layoutText(spec.text);
  return {
    width: Math.max(1, (width + spec.pad * 2) * spec.scale),
    height: (GLYPH_HEIGHT + spec.pad * 2) * spec.scale,
  };
}

/** Lit font pixels as texel rects, runs on a row merged into one rect. */
export function labelRects(spec: LabelSpec): { x: number; y: number; w: number; h: number }[] {
  const rects: { x: number; y: number; w: number; h: number }[] = [];
  const s = spec.scale;
  for (const glyph of layoutText(spec.text).glyphs) {
    const rows = GLYPHS[GLYPH_ORDER[glyph.index]!]!;
    rows.forEach((line, row) => {
      let x = 0;
      while (x < GLYPH_WIDTH) {
        if (line[x] !== '#') { x++; continue; }
        const start = x;
        while (x < GLYPH_WIDTH && line[x] === '#') x++;
        rects.push({ x: (spec.pad + glyph.x + start) * s, y: (spec.pad + row) * s, w: (x - start) * s, h: s });
      }
    });
  }
  return rects;
}

/** Draws a label onto any Skia canvas sized by labelSize. */
export function drawLabel(skia: SkiaInterop, canvas: SkiaCanvasLike, spec: LabelSpec): void {
  canvas.clear(Float32Array.from(spec.ground));
  const paint = skia.Paint();
  // Pixel lettering: edges stay on texel boundaries, so no coverage blending.
  paint.setAntiAlias(false);
  paint.setColor(Float32Array.from(spec.ink));
  for (const r of labelRects(spec)) canvas.drawRect(skia.XYWHRect(r.x, r.y, r.w, r.h), paint);
  paint.dispose();
}

/** The fallback: the same label as RGBA bytes, row 0 at the top. */
export function rasterLabel(spec: LabelSpec): { width: number; height: number; data: Uint8Array } {
  const { width, height } = labelSize(spec);
  const data = new Uint8Array(width * height * 4);
  const byte = (c: Rgba) => c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255));
  const ground = byte(spec.ground);
  const ink = byte(spec.ink);
  for (let i = 0; i < width * height; i++) data.set(ground, i * 4);
  for (const r of labelRects(spec)) {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) data.set(ink, (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

/** A WebGPU texture Skia draws into. Dispose before the texture is destroyed (react-native-webgpu docs, integrations/react-native-skia.mdx). */
export interface SkiaTexture {
  readonly texture: GPUTexture;
  readonly width: number;
  readonly height: number;
  /**
   * Draws, then flushes Skia's recording to the GPU. Call it before the frame
   * that samples the texture. `sync` blocks until the GPU has run Skia's work
   * (Surface.d.ts `flush(sync)`): the skiatex probe decides whether three's
   * queue needs it.
   */
  draw(paint: (canvas: SkiaCanvasLike) => void, options?: { sync?: boolean }): void;
  dispose(): void;
}

export function createSkiaTexture(args: { device: GPUDevice; skia: SkiaInterop; width: number; height: number; label?: string }): SkiaTexture {
  const { device, skia, width, height } = args;
  const texture = device.createTexture({
    label: args.label ?? 'skia-texture',
    size: { width, height },
    format: SKIA_TEXTURE_FORMAT,
    usage: SKIA_TEXTURE_USAGE,
  });
  let surface: SkiaSurfaceLike;
  try {
    surface = skia.Surface.MakeFromGPUTexture(texture);
  } catch (error) {
    texture.destroy();
    throw error;
  }
  let disposed = false;
  return {
    texture,
    width,
    height,
    draw(paint, options) {
      if (disposed) throw new Error('SkiaTexture.draw after dispose');
      paint(surface.getCanvas());
      surface.flush(options?.sync ?? false);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      surface.dispose();
      texture.destroy();
    },
  };
}

/** Wraps a Skia-drawn texture for three without a copy. Sizes go on `image`, which three reads for bookkeeping (Textures.getSize). */
export function toThreeTexture(THREE: Three, source: SkiaTexture): ThreeWebGpu.ExternalTexture {
  const texture = new THREE.ExternalTexture(source.texture);
  texture.image = { width: source.width, height: source.height } as never;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  return texture;
}

/** Where a label texture can be drawn. `deviceSource` is gpu-store's (or game-render's) record of which device three is on. */
export interface LabelTextureEnv {
  device: GPUDevice | null;
  deviceSource: 'shared' | 'own' | 'unknown';
  skia: SkiaInterop | null;
}

export interface LabelTexture {
  texture: ThreeWebGpu.Texture;
  path: 'skia' | 'bitmap';
  /** Why the Skia path was skipped or failed; null on the Skia path. */
  fallbackReason: string | null;
  width: number;
  height: number;
  dispose(): void;
}

/**
 * A label as a three texture: Skia on the shared device when the device is
 * Skia's and the Skia API is on this runtime, a DataTexture otherwise. A Skia
 * failure (MakeFromGPUTexture throws on a texture of another device) falls
 * back too, and `path` says which one ran.
 */
export function makeLabelTexture(THREE: Three, spec: LabelSpec, env: LabelTextureEnv): LabelTexture {
  const { width, height } = labelSize(spec);
  let fallbackReason = !env.device ? 'no device' : !env.skia ? 'Skia API not on this runtime' : env.deviceSource !== 'shared' ? `device is ${env.deviceSource}, not Skia's` : '';
  if (env.device && env.skia && env.deviceSource === 'shared') {
    const skia = env.skia;
    try {
      const target = createSkiaTexture({ device: env.device, skia, width, height, label: `label:${spec.text}` });
      target.draw((canvas) => drawLabel(skia, canvas, spec));
      const texture = toThreeTexture(THREE, target);
      return {
        texture, path: 'skia', fallbackReason: null, width, height,
        dispose: () => { texture.dispose(); target.dispose(); },
      };
    } catch (error) {
      fallbackReason = error instanceof Error ? error.message : String(error);
    }
  }
  const raster = rasterLabel(spec);
  const texture = new THREE.DataTexture(raster.data, raster.width, raster.height, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return { texture, path: 'bitmap', fallbackReason, width, height, dispose: () => texture.dispose() };
}
