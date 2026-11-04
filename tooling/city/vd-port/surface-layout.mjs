// VDN3 layout 1. Shared by the page-side harvester and offline writer only.
export const VDN3_STRIDE = 52;
export const VDN3_HEADER_BYTES = 64;
export const VDN3_LAYOUT = 1;
export const SURFACE_FLAGS = Object.freeze({ uv: 1, normal: 2, color: 4, grime: 8, weather: 16, weather4: 32 });
export const VDN3_FLAGS_MASK = 63;

const roundEven = value => {
  const floor = Math.floor(value), fraction = value - floor;
  return fraction > 0.5 || (fraction === 0.5 && (floor & 1)) ? floor + 1 : floor;
};
/** Finite IEEE binary16, round-to-nearest-even. Overflow is an error, never saturation. */
export function floatToHalf(value) {
  if (!Number.isFinite(value) || Math.abs(value) > 65504) throw new Error(`VDN3 half outside finite range: ${value}`);
  const sign = value < 0 || Object.is(value, -0) ? 0x8000 : 0;
  const magnitude = Math.abs(value);
  if (magnitude < 2 ** -14) return sign | roundEven(magnitude / 2 ** -24);
  let exponent = Math.floor(Math.log2(magnitude));
  let mantissa = roundEven((magnitude / 2 ** exponent - 1) * 1024);
  if (mantissa === 1024) { exponent++; mantissa = 0; }
  return sign | ((exponent + 15) << 10) | mantissa;
}
export function halfToFloat(bits) {
  const sign = bits & 0x8000 ? -1 : 1, exponent = (bits >>> 10) & 31, mantissa = bits & 1023;
  if (exponent === 31) return mantissa ? NaN : sign * Infinity;
  return sign * (exponent ? (1 + mantissa / 1024) * 2 ** (exponent - 15) : mantissa * 2 ** -24);
}
export function octEncode(normal) {
  if (normal.length !== 3 || !normal.every(Number.isFinite)) throw new Error('VDN3 normal must be finite vec3');
  const length = Math.hypot(...normal);
  if (length < 1e-20) throw new Error('VDN3 normal must be nonzero');
  let [x, y, z] = normal.map(v => v / length);
  const sum = Math.abs(x) + Math.abs(y) + Math.abs(z);
  x /= sum; y /= sum; z /= sum;
  if (z < 0) { const oldX = x; x = (1 - Math.abs(y)) * (x >= 0 ? 1 : -1); y = (1 - Math.abs(oldX)) * (y >= 0 ? 1 : -1); }
  return [Math.round(x * 32767), Math.round(y * 32767)];
}
export function octDecode(encoded) {
  let x = encoded[0] / 32767, y = encoded[1] / 32767;
  const z = 1 - Math.abs(x) - Math.abs(y);
  if (z < 0) { const oldX = x; x = (1 - Math.abs(y)) * (x >= 0 ? 1 : -1); y = (1 - Math.abs(oldX)) * (y >= 0 ? 1 : -1); }
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
}
/** Inverse transpose of an affine matrix's linear part, including nonuniform instance scale. */
export function transformSurfaceNormal(normal, elements) {
  const a = elements[0], b = elements[4], c = elements[8], d = elements[1], e = elements[5], f = elements[9], g = elements[2], h = elements[6], i = elements[10];
  const cofactor = [e * i - f * h, f * g - d * i, d * h - e * g, c * h - b * i, a * i - c * g, b * g - a * h, b * f - c * e, c * d - a * f, a * e - b * d];
  const determinant = a * cofactor[0] + b * cofactor[1] + c * cofactor[2];
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-20) throw new Error('VDN3 singular normal transform');
  const n = [0, 1, 2].map(row => cofactor[row * 3] * normal[0] / determinant + cofactor[row * 3 + 1] * normal[1] / determinant + cofactor[row * 3 + 2] * normal[2] / determinant);
  const length = Math.hypot(...n);
  if (!Number.isFinite(length) || length < 1e-20) throw new Error('VDN3 invalid transformed normal');
  return n.map(v => v / length);
}
