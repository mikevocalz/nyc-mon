import { platformIo } from '#cell-source-platform';
import type { PbrDescriptor } from '../furniture/pbr-material.ts';
import type { SourceRenderState } from './source-standard.ts';
import type { createSurfaceParameters } from './surface-parameters.ts';

export interface SurfaceTextureRef {
  id: number; sha256: string; width: number; height: number; format: number; type: number;
  page?: number; layer?: number; semantic?: string;
  colorSpace?: string; matrix?: readonly number[];
  wrapS?: number; wrapT?: number; flipY?: boolean; premultiplyAlpha?: boolean;
  minFilter?: number; magFilter?: number; anisotropy?: number; generateMipmaps?: boolean;
}
export interface SurfaceMaterial {
  id: number; family: number; type: string; vertexColors: boolean; normalMapType?: number;
  source: { key: string; shaderHash: string; shaderSha256: string };
  pbr?: PbrDescriptor;
  shader?: { attrs?: readonly string[]; uniforms?: Readonly<Record<string, unknown>> };
  textureBindings: Readonly<Record<string, SurfaceTextureRef & { texture: number }>>;
  textures: readonly number[];
}
export interface SurfaceFamily {
  id: number; name: string; supported: boolean; state: SourceRenderState;
  staticFlags: { vertexColors: boolean; hasAlphaTest: boolean; pbrSet?: string; program?: string; shaderHash?: string;
    textureRoles: readonly string[]; texturePages: readonly { role: string; page: number }[]; renderOrder?: number;
    castShadow?: boolean; receiveShadow?: boolean };
}
export interface SurfaceRegistry {
  schema: 'vd-block-surfaces'; version: 1; sha256: string; materialCount: number; variantCount: number;
  encoding: { layout: number; stride: number };
  families: readonly SurfaceFamily[]; materials: readonly SurfaceMaterial[]; textures: readonly SurfaceTextureRef[];
  variants: readonly unknown[]; frames: readonly unknown[];
  parameters: Parameters<typeof createSurfaceParameters>[1];
  coverage: { complete: boolean; unsupported: readonly unknown[] };
}

/** Same canonical JSON contract as the offline registry: every field except sha256 is authenticated. */
export function canonicalSurfaceRegistry(value: unknown): string {
  const visit = (item: unknown): unknown => {
    if (typeof item === 'number' && !Number.isFinite(item)) throw new Error('Non-finite authored registry value');
    if (Array.isArray(item)) return item.map(visit);
    if (item && typeof item === 'object') return Object.fromEntries(Object.keys(item).filter((key) => (item as Record<string, unknown>)[key] !== undefined).sort()
      .map((key) => [key, visit((item as Record<string, unknown>)[key])]));
    if (item === undefined || typeof item === 'function') throw new Error('Invalid authored registry value');
    return item;
  };
  return JSON.stringify(visit(value));
}

export async function verifySurfaceRegistry(
  registry: SurfaceRegistry,
  expectedSha256: string,
  sha256Hex: (bytes: Uint8Array) => Promise<string> = (bytes) => platformIo().sha256Hex(bytes),
): Promise<void> {
  if (!/^[a-f0-9]{64}$/.test(expectedSha256) || registry.sha256 !== expectedSha256) throw new Error('Authored registry identity mismatch');
  if (registry.schema !== 'vd-block-surfaces' || registry.version !== 1 || registry.encoding.layout !== 1 || registry.encoding.stride !== 52) throw new Error('Unsupported authored registry encoding');
  if (!registry.coverage.complete || registry.coverage.unsupported.length || registry.families.some((family) => !family.supported)) throw new Error('Authored registry has unbound shader families');
  if (!Number.isSafeInteger(registry.materialCount) || registry.materialCount < 1 || registry.materialCount > 65536 ||
    !Number.isSafeInteger(registry.variantCount) || registry.variantCount < 1 || registry.variantCount >= 2 ** 24 || !registry.frames.length ||
    registry.materialCount !== registry.materials.length || registry.variantCount !== registry.variants.length || registry.parameters.materialCount !== registry.materialCount) throw new Error('Authored registry count mismatch');
  const { sha256: _sha256, ...document } = registry;
  const actual = await sha256Hex(new TextEncoder().encode(canonicalSurfaceRegistry(document)));
  if (actual !== expectedSha256) throw new Error('Authored registry content hash mismatch');
}
