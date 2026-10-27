import type { Three } from '../types';
// Extensionless on purpose: Metro picks canvas2d.native.ts on device, web and tsc take canvas2d.ts.
import { canvasFont, createCanvasSurface } from './canvas2d';
import type { CanvasSurface } from './canvas2d-types';

/**
 * The H-Lynk's printed and lit detail: every procedural texture the device
 * scene uses, drawn through the shared Ctx2D (a browser canvas on web, Skia
 * on native), so both platforms build the same pixels from the same code.
 */

type Texture = CanvasSurface['texture'];

const finish = (surface: CanvasSurface): Texture => {
  surface.commit();
  return surface.texture;
};

/**
 * The fan's alpha falloff: opaque white at the mouth's centre, fading upward
 * and toward the edges. RGB is white so the material colour carries the tint.
 */
export function beamGradientTexture(THREE: Three): Texture {
  const surface = createCanvasSurface(THREE, 64, 256);
  const { ctx } = surface;
  const img = ctx.createImageData(64, 256);
  for (let y = 0; y < 256; y++) {
    // Row 0 is the texture's top (v=1), the apex; row 255 is the mouth. The
    // last 10% fades out too, or the crossed plane's mouth edge shows as a
    // pale slab across the head.
    const t = y / 255;
    const vertical = Math.pow(t, 1.7) * Math.min(1, (1 - t) / 0.1);
    for (let x = 0; x < 64; x++) {
      // Feather to zero inside the trapezoid edge so no silhouette shows under additive blending.
      const u = x / 63;
      const m = Math.min(u, 1 - u) / 0.28;
      const edge = m >= 1 ? 1 : m * m * (3 - 2 * m);
      const i = (y * 64 + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(255 * vertical * edge);
    }
  }
  ctx.putImageData(img, 0, 0);
  return finish(surface);
}

/** One soft diagonal light streak for the screen glass: the softbox catching the display. */
export function glareTexture(THREE: Three): Texture {
  const surface = createCanvasSurface(THREE, 256, 320);
  const { ctx } = surface;
  const grad = ctx.createLinearGradient(30, 300, 200, 20);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.42, 'rgba(255,255,255,0.10)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.22)');
  grad.addColorStop(0.58, 'rgba(255,255,255,0.10)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 320);
  return finish(surface);
}

/** Key glyphs: home, menu, back, forward. */
export function iconTexture(THREE: Three, icon: 'home' | 'menu' | 'back' | 'next', color: string): Texture {
  const surface = createCanvasSurface(THREE, 128, 128);
  const { ctx } = surface;
  ctx.strokeStyle = color;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (icon === 'home') {
    ctx.moveTo(24, 68); ctx.lineTo(64, 32); ctx.lineTo(104, 68);
    ctx.moveTo(36, 62); ctx.lineTo(36, 100); ctx.lineTo(92, 100); ctx.lineTo(92, 62);
  } else if (icon === 'menu') {
    for (const y of [44, 64, 84]) { ctx.moveTo(32, y); ctx.lineTo(96, y); }
  } else if (icon === 'back') {
    ctx.moveTo(84, 44); ctx.lineTo(48, 64); ctx.lineTo(84, 84);
  } else {
    ctx.moveTo(48, 44); ctx.lineTo(84, 64); ctx.lineTo(48, 84);
  }
  ctx.stroke();
  return finish(surface);
}

/** Tiling fine noise: the moulded-plastic grain under the finish. */
export function grainTexture(THREE: Three): Texture {
  const surface = createCanvasSurface(THREE, 128, 128);
  const { ctx } = surface;
  const img = ctx.createImageData(128, 128);
  // Deterministic, so every mount (and the capture) has the same grain.
  let seed = 0xbeef;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 128 * 128; i++) {
    const v = 118 + Math.floor(rand() * 20);
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const texture = finish(surface);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 10);
  return texture;
}

/** Soft white radial falloff; each sprite's material colour tints it. */
export function radialGlowTexture(THREE: Three): Texture {
  const surface = createCanvasSurface(THREE, 128, 128);
  const { ctx } = surface;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.4)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return finish(surface);
}

/** A single printed glyph on a transparent plate. */
export function textTexture(THREE: Three, text: string, color: string): Texture {
  const surface = createCanvasSurface(THREE, 512, 128);
  const { ctx } = surface;
  ctx.font = canvasFont(64, 800);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 64);
  return finish(surface);
}
