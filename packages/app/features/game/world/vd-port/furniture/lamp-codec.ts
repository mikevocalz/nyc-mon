// The lamp spots' packed form (data/lamps.ts, written by tooling/city/vd-port/bake-furniture.mjs). JSON text cost ~37
// bytes a lamp and pushed lane C's JS past its 3 MB cap once ring 9 brought the count to ~51k; packed, a lamp is 16
// bytes (~21 base64 characters) and decodes to the same numbers the JSON held.
//
// Per lamp, little-endian: i32 x, i32 y over ground, i32 z (millimetres, the JSON's 3 decimals), i8 fixture kind
// (night11 FIXTURES; -1 legacy), u8 mounting height (decimetres), i16 arm yaw (1/10000 rad, the JSON's 4 decimals;
// -32768 for a round throw, NaN).
import { decodeBase64 } from '../../foliage-decode.ts';

export const LAMP_BYTES = 16;
const ROUND = -32768;

/** The packed spots as data/lamps.ts's contract: [x, y, z, kind, head, yaw or NaN] per lamp, flat. */
export function decodeLampSpots(base64: string): number[] {
  const bytes = decodeBase64(base64);
  if (bytes.length % LAMP_BYTES) throw new Error(`vd lamps: ${bytes.length} bytes is not a whole number of ${LAMP_BYTES}-byte lamps`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = bytes.length / LAMP_BYTES;
  const out = new Array<number>(n * 6);
  for (let i = 0; i < n; i++) {
    const o = i * LAMP_BYTES, r = i * 6;
    out[r] = view.getInt32(o, true) / 1000;
    out[r + 1] = view.getInt32(o + 4, true) / 1000;
    out[r + 2] = view.getInt32(o + 8, true) / 1000;
    out[r + 3] = view.getInt8(o + 12);
    out[r + 4] = view.getUint8(o + 13) / 10;
    const yaw = view.getInt16(o + 14, true);
    out[r + 5] = yaw === ROUND ? Number.NaN : yaw / 10000;
  }
  return out;
}
