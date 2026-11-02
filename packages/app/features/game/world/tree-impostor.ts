import { decodeBase64 } from './foliage-decode.ts';

/** Lossless alpha and compact RGB565 for the offline canopy projections. */
export function decodeTreeImpostors(encoded: string, encodedAlpha: string): Uint8Array {
  const packed = decodeBase64(encoded);
  const alpha = decodeBase64(encodedAlpha);
  const rgba = new Uint8Array(packed.length * 2);
  for (let i = 0; i < packed.length / 2; i++) {
    const pixel = packed[i * 2]! | packed[i * 2 + 1]! << 8;
    rgba[i * 4] = Math.round((pixel >>> 11) * 255 / 31);
    rgba[i * 4 + 1] = Math.round((pixel >>> 5 & 63) * 255 / 63);
    rgba[i * 4 + 2] = Math.round((pixel & 31) * 255 / 31);
    rgba[i * 4 + 3] = alpha[i >>> 3]! & 1 << (i & 7) ? 255 : 0;
  }
  return rgba;
}
