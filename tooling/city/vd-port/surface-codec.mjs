import { VDN3_FLAGS_MASK, VDN3_HEADER_BYTES, VDN3_LAYOUT, VDN3_STRIDE, floatToHalf, octEncode } from './surface-layout.mjs';

const integer = (value, lo, hi, field) => {
  if (!Number.isInteger(value) || value < lo || value > hi) throw new Error(`VDN3 ${field} out of range: ${value}`);
  return value;
};
/** Encode one compact (cell, registry family) package. Vertices are already in scene metres. */
export async function encodeSurfaceCell({ cx, cz, vertices, indices, registry, encoder }) {
  if (!/^[0-9a-f]{64}$/.test(registry.sha256)) throw new Error('VDN3 registry needs a SHA-256 hex digest');
  integer(registry.materialCount, 1, 65536, 'material count');
  integer(registry.variantCount, 1, 2 ** 24, 'variant count');
  integer(cx, -1e6, 1e6, 'cx'); integer(cz, -1e6, 1e6, 'cz');
  if (!vertices.length || !indices.length || indices.length % 3) throw new Error('VDN3 requires indexed triangles');
  const ys = vertices.map(v => v.position[1]);
  let yMin = Infinity, yMax = -Infinity;
  for (const y of ys) { yMin = Math.min(yMin, y); yMax = Math.max(yMax, y); }
  const yOrigin = Math.round((yMin + yMax) * 64) / 128;
  const raw = new Uint8Array(vertices.length * VDN3_STRIDE), view = new DataView(raw.buffer);
  for (const [n, vertex] of vertices.entries()) {
    const offset = n * VDN3_STRIDE;
    if (vertex.position.length !== 3 || !vertex.position.every(Number.isFinite)) throw new Error('VDN3 position must be finite vec3');
    const quantized = [(vertex.position[0] - cx * 128 - 64) * 128, (vertex.position[1] - yOrigin) * 128, (vertex.position[2] - cz * 128 - 64) * 128].map(Math.round);
    quantized.forEach((v, component) => view.setInt16(offset + component * 2, integer(v, -32768, 32767, 'position'), true));
    if (vertex.color.length !== 3) throw new Error('VDN3 source color must be vec3');
    vertex.color.forEach((v, component) => view.setUint16(offset + 8 + component * 2, floatToHalf(v), true));
    const flags = integer(vertex.flags, 0, VDN3_FLAGS_MASK, 'flags'); view.setUint16(offset + 14, flags, true);
    if (vertex.uv.length !== 2 || !vertex.uv.every(v => Number.isFinite(Math.fround(v)))) throw new Error('VDN3 UV must be finite vec2');
    vertex.uv.forEach((v, component) => view.setFloat32(offset + 16 + component * 4, v, true));
    octEncode(vertex.normal).forEach((v, component) => view.setInt16(offset + 24 + component * 2, v, true));
    view.setUint16(offset + 28, integer(vertex.material, 0, registry.materialCount - 1, 'material ID'), true);
    view.setUint16(offset + 30, floatToHalf(vertex.grime), true);
    view.setUint32(offset + 32, integer(vertex.variant, 0, registry.variantCount - 1, 'variant row'), true);
    if (vertex.weather.length !== 4 || !vertex.weather.every(v => Number.isFinite(Math.fround(v)))) throw new Error('VDN3 weather must be finite vec4');
    vertex.weather.forEach((v, component) => view.setFloat32(offset + 36 + component * 4, v, true));
  }
  for (let at = 0; at < indices.length; at += 3) {
    const triangle = indices.slice(at, at + 3).map(index => vertices[integer(index, 0, vertices.length - 1, 'index')]);
    if (triangle.some(v => v.material !== triangle[0].material || v.variant !== triangle[0].variant)) throw new Error('VDN3 triangle crosses a material or variant seam');
    if (triangle.some(vertex => vertex.flags & 16) && triangle.some(vertex => !(vertex.flags & 16) || vertex.weather.some((value, axis) => value !== triangle[0].weather[axis]))) throw new Error('VDN3 flat weather varies inside a triangle');
  }
  await encoder.ready;
  const wide = vertices.length > 65535, index = wide ? Uint32Array.from(indices) : Uint16Array.from(indices);
  const encodedVertices = encoder.encodeVertexBuffer(raw, vertices.length, VDN3_STRIDE);
  const encodedIndices = encoder.encodeIndexBuffer(new Uint8Array(index.buffer), indices.length, wide ? 4 : 2);
  const header = new Uint8Array(VDN3_HEADER_BYTES), h = new DataView(header.buffer);
  header.set([86, 68, 78, 51]); h.setUint32(4, vertices.length, true); h.setUint32(8, indices.length, true);
  h.setUint32(12, encodedVertices.length + (wide ? 0x80000000 : 0), true); h.setFloat32(16, yOrigin, true);
  h.setUint16(20, VDN3_LAYOUT, true); h.setUint16(22, VDN3_STRIDE, true);
  for (let i = 0; i < 32; i++) header[24 + i] = parseInt(registry.sha256.slice(i * 2, i * 2 + 2), 16);
  h.setUint32(56, registry.materialCount, true); h.setUint32(60, registry.variantCount, true);
  const bytes = new Uint8Array(header.length + encodedVertices.length + encodedIndices.length);
  bytes.set(header); bytes.set(encodedVertices, header.length); bytes.set(encodedIndices, header.length + encodedVertices.length);
  return { bytes, vertexBytes: raw, index, yOrigin };
}
