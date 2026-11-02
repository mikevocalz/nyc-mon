// WebGPU has no scalar unorm8 vertex format. Keep CTL1's bytes on disk,
// but upload AO as float32 with the same normalized values the shader reads.
const converted = new WeakMap<Uint8Array, Float32Array>();
let zeroValues = new Float32Array(0);

export function farAoValues(bytes: Uint8Array | null, count: number): Float32Array {
  if (bytes !== null) {
    let values = converted.get(bytes);
    if (!values) {
      values = Float32Array.from(bytes, (value) => value / 255);
      converted.set(bytes, values);
    }
    return values;
  }
  // Every zero-only ground/landmark attribute shares this backing buffer;
  // a larger later request doesn't invalidate previously returned views.
  if (zeroValues.length < count) zeroValues = new Float32Array(count);
  return zeroValues.subarray(0, count);
}
