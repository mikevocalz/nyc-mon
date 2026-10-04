import { Skia, VertexMode, type SkColor, type SkPoint, type SkVertices } from 'react-native-skia';
import type { MeshChunk } from './skia-mesh';

/**
 * Native: Skia.MakeVertices reads plain { x, y } objects and per-vertex
 * colours (a 4-float array each), so the typed arrays are unpacked once
 * here. Static meshes pay this once per size; moving layers per frame.
 */
export function makeSkVertices(chunk: MeshChunk): SkVertices {
  const n = chunk.colors.length;
  const positions = new Array<SkPoint>(n);
  const texs = new Array<SkPoint>(n);
  const colors = new Array<SkColor>(n);
  for (let i = 0; i < n; i++) {
    positions[i] = { x: chunk.positions[i * 2]!, y: chunk.positions[i * 2 + 1]! } as SkPoint;
    texs[i] = { x: chunk.texs[i * 2]!, y: chunk.texs[i * 2 + 1]! } as SkPoint;
    const c = chunk.colors[i]!;
    colors[i] = new Float32Array([((c >>> 16) & 255) / 255, ((c >>> 8) & 255) / 255, (c & 255) / 255, (c >>> 24) / 255]);
  }
  return Skia.MakeVertices(VertexMode.Triangles, positions, texs, colors, Array.from(chunk.indices));
}
