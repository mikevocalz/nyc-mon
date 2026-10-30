// The upload rules for a Mon's still art, shared by the console's drop zone
// (checked before any byte leaves the browser) and the collection hook (the
// trust boundary, which also reads the picture's size from its bytes).

/** Under Vercel's 4.5 MB request body limit, so one multipart request carries it. */
export const MON_ART_MAX_BYTES = 4 * 1024 * 1024;

export const MON_ART_MIME_TYPES = ['image/webp', 'image/png', 'image/jpeg'] as const;
export type MonArtMimeType = (typeof MON_ART_MIME_TYPES)[number];

const EXTENSIONS: Record<string, MonArtMimeType> = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };

export type MonArtFileProblem = 'type' | 'empty' | 'size' | 'header' | 'alt';
export type MonArtFileCheck = { ok: true; mimeType: MonArtMimeType } | { ok: false; problem: MonArtFileProblem };

/** Name and size rules: a WebP, PNG or JPEG with bytes, at most 4 MB. */
export function checkMonArtFile(file: { name: string; size: number }): MonArtFileCheck {
  const mimeType = EXTENSIONS[file.name.toLowerCase().split('.').pop() ?? ''];
  if (!mimeType) return { ok: false, problem: 'type' };
  if (file.size <= 0) return { ok: false, problem: 'empty' };
  if (file.size > MON_ART_MAX_BYTES) return { ok: false, problem: 'size' };
  return { ok: true, mimeType };
}

/** Alt text describes the picture for screen readers; a Mon's still is never decorative. */
export const checkMonArtAlt = (alt: unknown): boolean => typeof alt === 'string' && alt.trim().length >= 3;

export interface ImageFacts { mimeType: MonArtMimeType; width: number; height: number }

const ascii = (bytes: Uint8Array, at: number, text: string) => [...text].every((char, i) => bytes[at + i] === char.charCodeAt(0));

/**
 * The picture's type and pixel size from its first bytes: PNG IHDR, the WebP
 * VP8/VP8L/VP8X header, or the first JPEG start-of-frame marker. Null when the
 * bytes are none of the three, whatever the file is named.
 */
export function readImageFacts(bytes: Uint8Array): ImageFacts | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 24 && bytes[0] === 0x89 && ascii(bytes, 1, 'PNG') && ascii(bytes, 12, 'IHDR')) {
    return { mimeType: 'image/png', width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (bytes.length >= 30 && ascii(bytes, 0, 'RIFF') && ascii(bytes, 8, 'WEBP')) {
    if (ascii(bytes, 12, 'VP8 ')) return { mimeType: 'image/webp', width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    if (ascii(bytes, 12, 'VP8L')) {
      const bits = view.getUint32(21, true);
      return { mimeType: 'image/webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (ascii(bytes, 12, 'VP8X')) {
      const w = bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16);
      const h = bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16);
      return { mimeType: 'image/webp', width: w + 1, height: h + 1 };
    }
    return null;
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let at = 2;
    while (at + 9 < bytes.length) {
      if (bytes[at] !== 0xff) return null;
      const marker = bytes[at + 1]!;
      const length = view.getUint16(at + 2);
      // SOF0-SOF15, except DHT (C4), JPG (C8) and DAC (CC).
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { mimeType: 'image/jpeg', width: view.getUint16(at + 7), height: view.getUint16(at + 5) };
      }
      at += 2 + length;
    }
    return null;
  }
  return null;
}

/** Shown under the drop zone; the hook's own messages say the same things. */
export const MON_ART_FILE_MESSAGES: Record<MonArtFileProblem, string> = {
  type: 'Only WebP, PNG or JPEG pictures work here.',
  empty: 'This file is empty. Export the picture again.',
  size: 'This picture is over 4 MB. Export it smaller (960×1200 WebP is plenty) and try again.',
  header: 'This file is not a WebP, PNG or JPEG picture, whatever its name says.',
  alt: 'Describe the picture for people using a screen reader before saving.',
};
