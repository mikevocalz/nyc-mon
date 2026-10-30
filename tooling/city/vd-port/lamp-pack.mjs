// data/lamps.ts's packed lamp spots: the encoder for furniture/lamp-codec.ts's decodeLampSpots (16 bytes a lamp,
// base64). Every field rounds to what the JSON form wrote (millimetres, decimetres, 1/10000 rad); a value the packing
// cannot hold throws instead of wrapping.
export const LAMP_BYTES = 16;

/** lamps: { x, y, z, kind, head, yaw (null for a round throw) }[] -> base64 */
export function packLampSpots(lamps) {
  const buf = Buffer.alloc(lamps.length * LAMP_BYTES);
  const int = (v, lo, hi, what, l) => {
    if (!Number.isInteger(v) || v < lo || v > hi) throw new Error(`lamp ${what} ${v} out of range at (${l.x}, ${l.z})`);
    return v;
  };
  lamps.forEach((l, i) => {
    const o = i * LAMP_BYTES;
    buf.writeInt32LE(int(Math.round(l.x * 1000), -2147483648, 2147483647, 'x', l), o);
    buf.writeInt32LE(int(Math.round(l.y * 1000), -2147483648, 2147483647, 'y', l), o + 4);
    buf.writeInt32LE(int(Math.round(l.z * 1000), -2147483648, 2147483647, 'z', l), o + 8);
    buf.writeInt8(int(l.kind, -128, 127, 'kind', l), o + 12);
    buf.writeUInt8(int(Math.round(l.head * 10), 0, 255, 'head', l), o + 13);
    buf.writeInt16LE(l.yaw === null ? -32768 : int(Math.round(l.yaw * 10000), -32767, 32767, 'yaw', l), o + 14);
  });
  return buf.toString('base64');
}
