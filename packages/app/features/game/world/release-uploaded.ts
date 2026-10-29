// Drops the CPU copy of static world geometry and data-texture pixels once the
// GPU holds them. three r186's WebGPU renderer keeps every BufferAttribute's
// array and every DataTexture's image.data after upload, and on the iPad's
// unified memory that second copy counts against the same footprint the
// kernel kills at (about 2.5 GiB on the 4 GB iPad Pro 12.9" 3rd gen). The
// physical city kept about 134 MB of such arrays after its first frame
// (city-scene.physical-first-frame.test.ts).
//
// OFF by default (EXPO_PUBLIC_WORLD_RELEASE_UPLOADED=1 turns it on). On the
// iPad, 2026-10-28, with the pass on START failed with "world not ready:
// 20000 ms without progress" and the app was killed at about 80 s; with it
// off the same build ran 120 s. No node harness reproduces that failure: the
// recording device runs the device's order (compileAsync, a paused canvas,
// moving actors, a shadow pass turned on after the release, a close-up camera)
// with no read of a released array (release-uploaded.test.ts,
// city-scene.physical-first-frame.test.ts). Until the device says why, the
// pass stays opt-in.
//
// What three r186 does with an uploaded attribute: the GPU buffer is keyed on
// the attribute object (WebGPUAttributeUtils.createAttribute), so every pass
// (main, shadow cascades, MRT, a PMREM bake) binds the same buffer; none
// uploads its own copy. After upload it reads `count` (a field, kept),
// `array.BYTES_PER_ELEMENT` and `array.constructor` (vertex layout, index
// format), so a released attribute keeps an empty array of the same type. A
// texture keeps its width, height and depth and an empty data array; three
// re-reads pixels only when `version` moves, and nothing here bumps it.
//
// Only data nothing writes after build is released: per-vertex
// BufferAttributes and indices (instanced meshes' model geometry included),
// never InstancedBufferAttributes or instance matrices, interleaved buffers or
// dynamic-usage attributes, and never a geometry marked
// `userData.keepCpuArrays` (for code that reads its arrays after the build).
// A resource goes only after the backend has reported it uploaded on
// RELEASE_SETTLE_FRAMES consecutive frames. Bounds are computed first, so
// frustum culling keeps working. An attribute no material reads is never
// uploaded, so it stays on the CPU. A lost GPU device cannot re-upload
// released data; the app has no device-loss recovery path today.
import type { Three } from '@acme/ui/three';
import { parseSkyRigFlag } from './sky-rig.ts';

/** Off by default; EXPO_PUBLIC_WORLD_RELEASE_UPLOADED=1 turns the pass on (see the header for why). */
export const RELEASE_UPLOADED = parseSkyRigFlag(process.env.EXPO_PUBLIC_WORLD_RELEASE_UPLOADED);

/** Consecutive frames a resource must read as uploaded before its CPU copy goes. */
export const RELEASE_SETTLE_FRAMES = 3;

/**
 * Test seam: called with each empty array a release installs, so a test can
 * trap any later read of it. Null in the app.
 */
let releaseObserver: ((array: ArrayBufferView) => void) | null = null;
export function setReleaseObserver(observer: ((array: ArrayBufferView) => void) | null): void {
  releaseObserver = observer;
}

type Object3D = InstanceType<Three['Object3D']>;
type Attr = {
  array: ArrayBufferView & { length: number; constructor: new (n: number) => ArrayBufferView & { length: number } };
  isInstancedBufferAttribute?: boolean;
  isInterleavedBufferAttribute?: boolean;
  usage?: number;
};
type Tex = { isDataTexture?: boolean; isDataArrayTexture?: boolean; isData3DTexture?: boolean; image?: { data?: ArrayBufferView & { length: number; constructor: new (n: number) => ArrayBufferView } | null } };

/** three's StaticDrawUsage. */
const STATIC_DRAW = 35044;

/** Whether the GPU holds this attribute or texture (the backend made its buffer or texture). */
export type UploadedProbe = (resource: object) => boolean;

/** A probe for a three WebGPURenderer's backend data. */
export function backendUploaded(renderer: { backend: unknown }): UploadedProbe {
  const backend = renderer.backend as { has?(o: object): boolean; get(o: object): { buffer?: unknown; texture?: unknown } };
  return (resource) => {
    // A texture never flagged for upload (version 0) holds three's 1x1 default texture, not its pixels.
    const texture = resource as { isTexture?: boolean; version?: number };
    if (texture.isTexture === true && !(texture.version! > 0)) return false;
    if (typeof backend.has === 'function' && !backend.has(resource)) return false;
    const data = backend.get(resource);
    return data.buffer !== undefined || data.texture !== undefined;
  };
}

export interface UploadedReleaserOptions {
  /** Consecutive `release` calls a resource must read as uploaded first. Default RELEASE_SETTLE_FRAMES. */
  settleFrames?: number;
}

export interface UploadedReleaser {
  /**
   * One frame's check: releases what the probe has reported uploaded on the
   * last `settleFrames` calls in a row; returns the bytes freed by this call.
   */
  release(uploaded: UploadedProbe): number;
  /** Resources still waiting for their first upload. */
  readonly pending: number;
  /** Bytes released so far. */
  readonly released: number;
}

function releasable(a: Attr | null | undefined): a is Attr {
  return a != null && a.isInstancedBufferAttribute !== true && a.isInterleavedBufferAttribute !== true
    && (a.usage === undefined || a.usage === STATIC_DRAW) && ArrayBuffer.isView(a.array) && a.array.length > 0;
}

function isDataTexture(t: Tex): boolean {
  return (t.isDataTexture === true || t.isDataArrayTexture === true || t.isData3DTexture === true)
    && t.image?.data != null && ArrayBuffer.isView(t.image.data) && t.image.data.length > 0;
}

/**
 * Collects the static attributes of every non-instanced mesh under `root`
 * and the data textures its node materials reference. Call once the build is
 * done; call `release` after each frame until `pending` is 0.
 */
export function createUploadedReleaser(root: Object3D, options: UploadedReleaserOptions = {}): UploadedReleaser {
  const settleFrames = Math.max(1, Math.floor(options.settleFrames ?? RELEASE_SETTLE_FRAMES));
  const attrs: Attr[] = [];
  const textures: Tex[] = [];
  const seenAttr = new Set<unknown>();
  const seenTex = new Set<unknown>();
  const visited = new Set<unknown>();
  const visitMaterial = (node: unknown, depth: number) => {
    if (!node || typeof node !== 'object' || visited.has(node) || depth > 24 || ArrayBuffer.isView(node)) return;
    visited.add(node);
    const t = node as Tex & { isTexture?: boolean };
    if (t.isTexture) {
      if (isDataTexture(t) && !seenTex.has(t)) { seenTex.add(t); textures.push(t); }
      return;
    }
    for (const value of Object.values(node as Record<string, unknown>)) {
      if (value && typeof value === 'object') visitMaterial(value, depth + 1);
    }
  };
  root.traverse((object) => {
    const mesh = object as Object3D & {
      isMesh?: boolean; isInstancedMesh?: boolean;
      geometry?: {
        attributes: Record<string, Attr>; index: Attr | null; boundingBox: unknown; boundingSphere: unknown;
        userData?: { keepCpuArrays?: boolean }; computeBoundingBox(): void; computeBoundingSphere(): void;
      };
      material?: unknown;
    };
    if (mesh.isMesh !== true || !mesh.geometry) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of materials) visitMaterial(m, 0);
    // Instanced meshes (trees, cars, rain) refill their instance attributes
    // as the Caller moves; those are InstancedBufferAttributes and stay. The
    // per-vertex model geometry under them is static and goes like the rest.
    const g = mesh.geometry;
    if (g.userData?.keepCpuArrays === true) return;
    if (g.boundingBox == null) g.computeBoundingBox();
    if (g.boundingSphere == null) g.computeBoundingSphere();
    for (const a of [...Object.values(g.attributes), g.index]) {
      if (releasable(a) && !seenAttr.has(a)) { seenAttr.add(a); attrs.push(a); }
    }
  });

  let released = 0;
  // Consecutive uploaded frames per resource; a miss resets it.
  const streak = new Map<object, number>();
  /** Whether `resource` has now read as uploaded on `settleFrames` calls in a row. */
  const settled = (resource: object, uploaded: UploadedProbe): boolean => {
    if (!uploaded(resource)) {
      streak.delete(resource);
      return false;
    }
    const n = (streak.get(resource) ?? 0) + 1;
    if (n < settleFrames) {
      streak.set(resource, n);
      return false;
    }
    streak.delete(resource);
    return true;
  };
  // Order does not matter: swap the last entry into the hole (no O(n) splice).
  const drop = <T>(list: T[], i: number) => {
    list[i] = list[list.length - 1]!;
    list.pop();
  };
  return {
    get pending() { return attrs.length + textures.length; },
    get released() { return released; },
    release(uploaded) {
      let freed = 0;
      for (let i = attrs.length - 1; i >= 0; i--) {
        const a = attrs[i]!;
        if (!settled(a, uploaded)) continue;
        freed += a.array.byteLength;
        a.array = new a.array.constructor(0) as Attr['array'];
        releaseObserver?.(a.array);
        drop(attrs, i);
      }
      for (let i = textures.length - 1; i >= 0; i--) {
        const t = textures[i]!;
        if (!settled(t, uploaded)) continue;
        const data = t.image!.data!;
        freed += data.byteLength;
        t.image!.data = new data.constructor(0) as typeof data;
        releaseObserver?.(t.image!.data);
        drop(textures, i);
      }
      released += freed;
      return freed;
    },
  };
}
