import { gunzipSync } from 'three/examples/jsm/libs/fflate.module.js';
import type { Three } from '@acme/ui/three';
import { createTriangleCollisionFromData, type TriangleCollision } from '../../../triangle-collision.ts';
import { decodeTriangleCollisionData, COLLISION_BVH_HEADER_BYTES } from '../../../triangle-collision-binary.ts';
import type { ShellCellInfo } from './codec.ts';

export type ShellCollisionRegion = readonly [number, number, number, number, number, number];
export const SHELL_COLLISION_PACK_HEADER_BYTES = 64;
/** Forty-metre chase range plus body/boom clearance; shared with the offline producer. */
export function shellCollisionRegion(extent: number): ShellCollisionRegion {
  if (Number.isNaN(extent) || extent < 0) throw new Error('Invalid building collision extent');
  const reach = extent + 42;
  return [-reach, -1, -reach, reach, 24, reach];
}
export interface ShellCollisionCell {
  readonly source: ShellCellInfo;
  readonly triangles: number;
  readonly payload: { readonly offset: number; readonly fileBytes: number; readonly bytes: number; readonly sha256: string } | null;
}
export interface ShellCollisionManifest {
  readonly version: 1;
  readonly layout: 'exact-shell-bvh-v1';
  readonly region: ShellCollisionRegion;
  readonly frame: { readonly cellSize: 128; readonly positionDivisor: 8; readonly space: 'absolute'; readonly triangleAreaMin: 1e-8 };
  readonly file: { readonly sha256: string; readonly bytes: number };
  readonly directorySha256: string;
  readonly sets: readonly {
    readonly ring: number; readonly shellSha256: string; readonly shellBytes: number; readonly cells: readonly ShellCollisionCell[];
  }[];
}
export interface PrecomputedShellCollisionPack {
  readonly region: ShellCollisionRegion;
  /** Bind every current cell descriptor, including cells excluded by the region. */
  checkSourceSet(ring: number, sources: readonly ShellCellInfo[], region: ShellCollisionRegion): void;
  /** Decoded arrays belong only to the returned scene proxy, never to this compressed asset bank. */
  create(THREE: Three, ring: number, source: ShellCellInfo, region: ShellCollisionRegion): TriangleCollision;
}
/** Required production collision data must never degrade to a different building lane. */
export class ShellCollisionPackError extends Error {
  constructor(message: string) { super(`Precomputed shell collision: ${message}`); this.name = 'ShellCollisionPackError'; }
}
function error(message: string): never { throw new ShellCollisionPackError(message); }
const hash = (value: string) => /^[0-9a-f]{64}$/.test(value);
const integer = (value: number, minimum = 0) => Number.isSafeInteger(value) && value >= minimum;
const sameSource = (a: ShellCellInfo, b: ShellCellInfo) => a.key === b.key && a.cx === b.cx && a.cz === b.cz &&
  a.vertices === b.vertices && a.triangles === b.triangles && a.offset === b.offset && a.length === b.length &&
  a.bounds.length === 6 && b.bounds.length === 6 && a.bounds.every((value, index) => value === b.bounds[index]);

/** Same explicit field order in the producer and loader; file hash is outside this directory to avoid a cycle. */
export function shellCollisionDirectory(manifest: Pick<ShellCollisionManifest, 'version' | 'layout' | 'region' | 'frame' | 'sets'>): string {
  return JSON.stringify({ version: manifest.version, layout: manifest.layout, region: manifest.region, frame: manifest.frame, sets: manifest.sets });
}

/**
 * Authenticate the compressed bank and the actual shell inputs before the
 * synchronous scene build. The immutable bank retains compressed bytes only.
 */
export async function bindShellCollisionPack(manifest: ShellCollisionManifest, input: Uint8Array,
  sources: readonly { ring: number; bytes: Uint8Array }[], sha256Hex: (bytes: Uint8Array) => Promise<string>): Promise<PrecomputedShellCollisionPack> {
  const directory = shellCollisionDirectory(manifest);
  // Snapshot before hashing yields: neither directory offsets nor its source
  // identities may change while the prereveal gate is awaiting native crypto.
  manifest = { ...JSON.parse(directory), file: { ...manifest.file }, directorySha256: manifest.directorySha256 } as ShellCollisionManifest;
  if (manifest.version !== 1 || manifest.layout !== 'exact-shell-bvh-v1' ||
    manifest.frame.cellSize !== 128 || manifest.frame.positionDivisor !== 8 || manifest.frame.space !== 'absolute' || manifest.frame.triangleAreaMin !== 1e-8 ||
    manifest.region.length !== 6 || !manifest.region.every(Number.isFinite) || manifest.region.some((value, index) => index < 3 && value > manifest.region[index + 3]!)) error('unsupported frame or region');
  if (!hash(manifest.file.sha256) || !hash(manifest.directorySha256) || !integer(manifest.file.bytes, SHELL_COLLISION_PACK_HEADER_BYTES) || input.byteLength !== manifest.file.bytes) error('bank byte count mismatch');
  // Platform readers can reuse pooled buffers after resolving; keep the exact
  // bank that was authenticated, independently of those upstream buffers.
  const bytes = input.slice();
  if (await sha256Hex(bytes) !== manifest.file.sha256) error('bank SHA-256 mismatch');
  const header = new DataView(bytes.buffer, bytes.byteOffset, SHELL_COLLISION_PACK_HEADER_BYTES);
  const boundDirectory = [...bytes.subarray(32, 64)].map(value => value.toString(16).padStart(2, '0')).join('');
  if (bytes[0] !== 78 || bytes[1] !== 67 || bytes[2] !== 80 || bytes[3] !== 49 || header.getUint16(4, true) !== 1 ||
    header.getUint16(6, true) !== SHELL_COLLISION_PACK_HEADER_BYTES || header.getUint32(8, true) !== bytes.length ||
    header.getUint32(20, true) !== 0 || header.getUint32(24, true) !== 0 || header.getUint32(28, true) !== 0 ||
    boundDirectory !== manifest.directorySha256 || await sha256Hex(new TextEncoder().encode(directory)) !== boundDirectory) error('bank/directory binding mismatch');
  const sets = new Map<number, { source: typeof manifest.sets[number]; cells: Map<string, ShellCollisionCell> }>();
  let payloadEnd = SHELL_COLLISION_PACK_HEADER_BYTES, payloadCount = 0;
  for (const set of manifest.sets) {
    if (!integer(set.ring) || sets.has(set.ring) || !hash(set.shellSha256) || !integer(set.shellBytes)) error('invalid shell identity');
    const cells = new Map<string, ShellCollisionCell>();
    for (const entry of set.cells) {
      const source = entry.source;
      if (cells.has(source.key) || !integer(source.vertices) || !integer(source.triangles) || source.vertices !== source.triangles * 3 ||
        !Number.isSafeInteger(source.cx) || !Number.isSafeInteger(source.cz) || !integer(source.offset) || !integer(source.length) ||
        source.offset + source.length > set.shellBytes || source.bounds.length !== 6 || !source.bounds.every(Number.isFinite) ||
        !integer(entry.triangles) || entry.triangles > source.triangles) error('invalid cell metadata');
      const payload = entry.payload;
      if (payload) {
        // The exact format has44 bytes per retained triangle and at most
        // 2*n-1 tree nodes of40 bytes. Bound allocation by source geometry,
        // not merely a potentially oversized declared gzip output length.
        const maximumBytes = COLLISION_BVH_HEADER_BYTES + entry.triangles * 44 + Math.max(0, entry.triangles * 2 - 1) * 40;
        if (!integer(payload.offset) || payload.offset !== payloadEnd || !integer(payload.fileBytes, 18) ||
          !integer(payload.bytes, COLLISION_BVH_HEADER_BYTES) || payload.bytes > maximumBytes || !hash(payload.sha256) || payload.offset + payload.fileBytes > bytes.length) error('invalid cell payload range');
        payloadEnd += payload.fileBytes;
        payloadCount++;
      } else if (entry.triangles !== 0) error('missing nonempty cell payload');
      // Snapshot the small directory; callers cannot change coordinates or
      // offsets after its pairing has passed the prereveal gate.
      cells.set(source.key, Object.freeze({ triangles: entry.triangles,
        source: Object.freeze({ ...source, bounds: Object.freeze([...source.bounds]) }),
        payload: payload ? Object.freeze({ ...payload }) : null }));
    }
    sets.set(set.ring, { source: set, cells });
  }
  if (payloadEnd !== bytes.length || header.getUint32(12, true) !== payloadCount || header.getUint32(16, true) !== sets.size) error('unclaimed bank bytes or directory count mismatch');
  const loaded = new Set<number>();
  await Promise.all(sources.map(async source => {
    const expected = sets.get(source.ring)?.source;
    if (!expected || loaded.has(source.ring) || source.bytes.byteLength !== expected.shellBytes) error('unknown or changed shell source');
    loaded.add(source.ring);
    if (await sha256Hex(source.bytes) !== expected.shellSha256) error(`shell ${source.ring} SHA-256 mismatch`);
  }));
  const region = Object.freeze([...manifest.region]) as ShellCollisionRegion;
  return {
    region,
    checkSourceSet(ring, sources, requested) {
      if (requested.length !== region.length || requested.some((value, index) => value !== region[index])) error('runtime region does not match authored coverage');
      const set = sets.get(ring);
      if (!loaded.has(ring) || !set || set.cells.size !== sources.length) error('shell source cell inventory changed');
      const seen = new Set<string>();
      for (const source of sources) {
        const expected = set.cells.get(source.key);
        if (seen.has(source.key) || !expected || !sameSource(source, expected.source)) error('shell cell/frame metadata changed');
        seen.add(source.key);
      }
    },
    create(THREE, ring, source, requested) {
      if (requested.length !== region.length || requested.some((value, index) => value !== region[index])) error('runtime region does not match authored coverage');
      if (!loaded.has(ring)) error('shell was not authenticated during preload');
      const entry = sets.get(ring)?.cells.get(source.key);
      if (!entry || !sameSource(source, entry.source)) error('shell cell/frame metadata changed');
      if (!entry.payload) return { bytes: 0, triangles: 0, blocked: () => false, firstHit: () => null };
      const spec = entry.payload;
      const compressed = bytes.subarray(spec.offset, spec.offset + spec.fileBytes);
      if (compressed[0] !== 31 || compressed[1] !== 139 || compressed[2] !== 8 || compressed[3] !== 0 ||
        new DataView(compressed.buffer, compressed.byteOffset + compressed.byteLength - 4, 4).getUint32(0, true) !== spec.bytes) error('invalid gzip member');
      // The reviewed fixed output never grows. The sentinel detects a stream
      // longer than declared instead of accepting a silently truncated prefix.
      const payload = gunzipSync(compressed, { out: new Uint8Array(spec.bytes + 1) });
      if (payload.byteLength !== spec.bytes) error('decoded byte count mismatch');
      const data = decodeTriangleCollisionData(payload, source.triangles);
      if (data.triangles !== entry.triangles) error('retained triangle count mismatch');
      return createTriangleCollisionFromData(THREE, data);
    },
  };
}
