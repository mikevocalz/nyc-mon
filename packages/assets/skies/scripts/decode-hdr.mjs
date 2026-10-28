// decode-hdr.mjs — Radiance RGBE (.hdr) decoder, no dependencies.
//
// Format (Greg Ward's "REAL Pixels" / RGBE, as written by Poly Haven):
//   "#?RADIANCE" magic, '#'-comment lines, "FORMAT=32-bit_rle_rgbe",
//   a blank line, then a resolution line like "-Y 1024 +X 2048", then the
//   scanline payload. Each pixel is four bytes R,G,B,E sharing one exponent:
//   channel value = byte * 2^(E - 136) (E == 0 encodes black).
//
// Scanlines are either flat (width * 4 bytes) or new-style RLE: a scanline
// starts with bytes [2, 2, width>>8, width&255] when 8 <= width < 32768, then
// the four channels are stored separately, each as RLE packets — a count byte
// c: c > 128 repeats the next byte (c - 128) times, c <= 128 copies c literal
// bytes. The pre-1995 adaptive RLE (scanlines starting with 1,1,1) is rejected
// rather than decoded wrongly.
//
// decodeHDR(buffer) -> { width, height, data } where data is a Float32Array of
// linear RGB triples, row-major, row 0 = the TOP of the image (the '-Y'
// ordering Poly Haven ships), i.e. the zenith of the equirect map.

const MAGIC = ['#?RADIANCE', '#?RGBE'];
const EXP_BIAS = 136; // value = byte * 2^(E - 136); table below avoids pow() per pixel
const EXP_TABLE = Array.from({ length: 256 }, (_, e) => Math.pow(2, e - EXP_BIAS));

export function decodeHDR(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let pos = 0;

  const readLine = () => {
    const start = pos;
    while (pos < bytes.length && bytes[pos] !== 0x0a) pos++;
    const line = new TextDecoder().decode(bytes.subarray(start, pos)).replace(/\r$/, '');
    pos++; // skip '\n'
    return line;
  };

  const magic = readLine();
  if (!MAGIC.includes(magic)) throw new Error(`not a Radiance HDR file (magic "${magic}")`);

  const header = {};
  let line = readLine();
  while (line !== '') {
    if (line.startsWith('#')) {
      // comment
    } else {
      const eq = line.indexOf('=');
      if (eq > 0) header[line.slice(0, eq)] = line.slice(eq + 1);
    }
    line = readLine();
  }
  if (header.FORMAT && header.FORMAT !== '32-bit_rle_rgbe' && header.FORMAT !== '32-bit_rle_xyze') {
    throw new Error(`unsupported FORMAT "${header.FORMAT}"`);
  }

  const resLine = readLine();
  const m = resLine.match(/^([+-])Y (\d+) ([+-])X (\d+)$/);
  if (!m) throw new Error(`bad resolution line "${resLine}"`);
  const [, ySign, yDim, xSign, xDim] = m;
  const height = Number(yDim);
  const width = Number(xDim);
  if (ySign === '+' || xSign === '-') {
    // Only "-Y +X" (top-down, left-to-right) is implemented; Poly Haven ships that.
    throw new Error(`unsupported scanline order "${resLine}" (only "-Y h +X w")`);
  }

  const data = new Float32Array(width * height * 3);
  const pixel = new Uint8Array(4);

  for (let y = 0; y < height; y++) {
    const rle = width >= 8 && width < 0x8000 &&
      bytes[pos] === 2 && bytes[pos + 1] === 2 && ((bytes[pos + 2] << 8) | bytes[pos + 3]) === width;
    const row = data.subarray(y * width * 3, (y + 1) * width * 3);

    if (rle) {
      pos += 4;
      const chans = [new Uint8Array(width), new Uint8Array(width), new Uint8Array(width), new Uint8Array(width)];
      for (const chan of chans) {
        let x = 0;
        while (x < width) {
          const count = bytes[pos++];
          if (count === undefined) throw new Error(`RLE underrun at row ${y}`);
          if (count > 128) {
            const v = bytes[pos++];
            chan.fill(v, x, x + count - 128);
            x += count - 128;
          } else {
            chan.set(bytes.subarray(pos, pos + count), x);
            pos += count;
            x += count;
          }
        }
        if (x !== width) throw new Error(`RLE overrun at row ${y} (wrote ${x} of ${width})`);
      }
      const [r, g, b, e] = chans;
      for (let x = 0; x < width; x++) {
        const ex = e[x];
        if (ex) {
          const s = EXP_TABLE[ex];
          const o = x * 3;
          row[o] = r[x] * s;
          row[o + 1] = g[x] * s;
          row[o + 2] = b[x] * s;
        }
      }
    } else {
      if (width >= 8 && bytes[pos] === 1 && bytes[pos + 1] === 1 && bytes[pos + 2] === 1) {
        throw new Error('old-style adaptive RLE .hdr is not supported');
      }
      for (let x = 0; x < width; x++) {
        pixel[0] = bytes[pos++];
        pixel[1] = bytes[pos++];
        pixel[2] = bytes[pos++];
        pixel[3] = bytes[pos++];
        if (pixel[3]) {
          const s = EXP_TABLE[pixel[3]];
          const o = x * 3;
          row[o] = pixel[0] * s;
          row[o + 1] = pixel[1] * s;
          row[o + 2] = pixel[2] * s;
        }
      }
    }
  }

  // Sanity: decoded radiance must be finite and non-negative, and a real sky is not all black.
  let max = 0;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (!Number.isFinite(v) || v < 0) throw new Error(`decoded negative/NaN radiance at pixel ${(i / 3) | 0}`);
    if (v > max) max = v;
  }
  if (max === 0) throw new Error('decoded an all-black image — decode is wrong');
  return { width, height, data, header };
}
