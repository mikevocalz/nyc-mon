import type { SkVertices } from 'react-native-skia';
import { JsiSkVertices } from 'react-native-skia/lib/module/skia/web/JsiSkVertices';
import type { MeshChunk } from './skia-mesh';

/** The slice of the CanvasKit global this file uses (canvaskit-wasm is not a dependency of @acme/ui). */
interface CanvasKitVertices {
  VertexMode: { Triangles: unknown };
  MakeVertices(mode: unknown, positions: Float32Array, texs: Float32Array, colors: Uint32Array, indices: Uint16Array, isVolatile: boolean): unknown;
}

/**
 * Web: hand the typed arrays straight to CanvasKit. react-native-skia's web
 * Skia.MakeVertices takes SkPoint objects, flattens them with map().flat()
 * and joins the colours with a reduce/concat that copies the whole array per
 * vertex (quadratic), which is most of why the old fallback crawled.
 * CanvasKit is the global LoadSkiaWeb installs.
 */
export function makeSkVertices(chunk: MeshChunk): SkVertices {
  const ck = (globalThis as unknown as { CanvasKit: CanvasKitVertices }).CanvasKit;
  const vertices = ck.MakeVertices(ck.VertexMode.Triangles, chunk.positions, chunk.texs, chunk.colors, chunk.indices, false);
  return new JsiSkVertices(ck as never, vertices as never);
}
