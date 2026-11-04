import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/** Canonical JSON forbids nonfinite values and excludes only absent fields. */
export function canonicalSurfaceJSON(value) {
  const visit = input => {
    if (typeof input === 'number' && !Number.isFinite(input)) throw new Error('Surface registry contains a nonfinite number');
    if (Array.isArray(input)) return input.map(visit);
    if (input && typeof input === 'object') return Object.fromEntries(Object.keys(input).filter(key => input[key] !== undefined).sort().map(key => [key, visit(input[key])]));
    if (input === undefined || typeof input === 'function') throw new Error('Surface registry contains an unserializable value');
    return input;
  };
  return JSON.stringify(visit(value));
}
const digest = value => createHash('sha256').update(canonicalSurfaceJSON(value)).digest('hex');

/**
 * Offline registry allocator. The renderer supplies identifyFamily; unsupported
 * graphs remain explicit and prevent writeSurfacePacks from publishing assets.
 * Descriptors must be captured from the same live page as geometry harvesting.
 */
export class SurfaceRegistry {
  constructor({ source, identifyFamily, textures = [], provenanceFiles = [] }) {
    this.source = { ...source, hashes: [...provenanceFiles].sort((a, b) => a.path.localeCompare(b.path)).map(({ path, file }) => ({ path, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') })) };
    this.identifyFamily = identifyFamily;
    if (new Set(textures.map(texture => texture.id)).size !== textures.length) throw new Error('Duplicate authored texture ID');
    this.textures = textures;
    this.materials = []; this.families = []; this.variants = []; this.frames = [];
    this.sourceMaterials = new Map(); this.materialKeys = new Map(); this.familyKeys = new Map(); this.variantKeys = new Map(); this.frameKeys = new Map();
    this.unsupported = new Map(); this.textureById = new Map(textures.map(texture => [texture.id, texture]));
  }
  registerMaterial(descriptor) {
    if (!/^[0-9a-f]{64}$/.test(descriptor.source?.shaderSha256 ?? '')) throw new Error('Surface material requires expanded shader SHA-256');
    const classification = this.identifyFamily(descriptor);
    if (!classification || !classification.name) throw new Error('Source shader family was not classified');
    const familyRecord = { name: classification.name, staticFlags: classification.staticFlags ?? {}, state: classification.renderState ?? descriptor.state, supported: classification.supported === true };
    const familyKey = canonicalSurfaceJSON(familyRecord);
    let family = this.familyKeys.get(familyKey);
    if (family === undefined) { family = this.families.length; this.familyKeys.set(familyKey, family); this.families.push({ id: family, ...familyRecord }); }
    const { uuid, ...content } = descriptor;
    const materialKey = canonicalSurfaceJSON({ ...content, family });
    let material = this.materialKeys.get(materialKey);
    if (material === undefined) {
      material = this.materials.length;
      if (material > 65535) throw new Error('VDN3 material ID exceeds uint16');
      this.materialKeys.set(materialKey, material); this.materials.push({ ...content, id: material, family });
    }
    if (uuid) this.sourceMaterials.set(uuid, { material, family, requiredAttributes: classification.requiredAttributes ?? [] });
    if (!classification.supported) this.unsupported.set(descriptor.source.shaderSha256, classification.reason ?? classification.name);
    return { material, family };
  }
  material(sourceMaterial, { attributes } = {}) {
    const match = this.sourceMaterials.get(sourceMaterial.uuid);
    if (!match) throw new Error('Uncaptured source material; capture registry and geometry in the same page');
    for (const name of match.requiredAttributes) if (!attributes?.[name]) throw new Error(`Source family requires missing ${name}`);
    return { material: match.material, family: match.family };
  }
  frame(sourceFrame) {
    const key = canonicalSurfaceJSON(sourceFrame);
    let id = this.frameKeys.get(key);
    if (id === undefined) { id = this.frames.length; this.frameKeys.set(key, id); this.frames.push(JSON.parse(key)); }
    return id;
  }
  variant(material, fields, sourceFrame) {
    if (!this.materials[material]) throw new Error('Variant refers to an unknown material');
    const frame = this.frame(sourceFrame);
    return this.allocateVariant(fields, frame, [material]);
  }
  allocateVariant(fields, frame, materials) {
    const key = canonicalSurfaceJSON({ fields, frame });
    let row = this.variantKeys.get(key);
    if (row === undefined) {
      row = this.variants.length;
      if (row >= 2 ** 24) throw new Error('Variant address is not exact in Float32');
      this.variantKeys.set(key, row); this.variants.push({ ...JSON.parse(key), materials: [] });
    }
    this.variants[row].materials = [...new Set([...this.variants[row].materials, ...materials])].sort((a,b)=>a-b);
    return row;
  }
  withSourceFrame(variant, sceneFrame) {
    const original = this.variants[variant];
    if (!original) throw new Error('Unknown source variant');
    const frame = this.frame({ ...this.frames[original.frame], ...sceneFrame, sourceYOffset: sceneFrame.baseY - sceneFrame.curb });
    return this.allocateVariant(original.fields, frame, original.materials);
  }
  textureRefs(material) {
    const descriptor = this.materials[material];
    if (!descriptor) throw new Error('Unknown material texture reference');
    const refs = descriptor.textures ?? [];
    for (const id of refs) if (!this.textureById.has(id)) throw new Error(`Missing authored texture ${id}`);
    return refs;
  }
  retainVariants(rows) {
    const remap = new Map(), frames = [], variants = [], frameKeys = new Map();
    for (const oldRow of [...new Set(rows)].sort((a,b) => a-b)) {
      const original = this.variants[oldRow];
      if (!original) throw new Error('Retained geometry refers to an unknown variant');
      const sourceFrame = this.frames[original.frame], key = canonicalSurfaceJSON(sourceFrame);
      if (!frameKeys.has(key)) { frameKeys.set(key, frames.length); frames.push(sourceFrame); }
      remap.set(oldRow, variants.length);
      variants.push({ fields: original.fields, frame: frameKeys.get(key), materials: [...original.materials] });
    }
    this.frames = frames; this.variants = variants; this.frameKeys = frameKeys;
    this.variantKeys = new Map(variants.map((variant,row)=>[canonicalSurfaceJSON({ fields: variant.fields, frame: variant.frame }),row]));
    return remap;
  }
  finalize() {
    // Source programs, renderer semantic helpers, encodings and resource
    // bindings all contribute to the one identity checked by every VDN3 file.
    for (const material of this.materials) this.textureRefs(material.id);
    const value = { schema: 'vd-block-surfaces', version: 1, source: this.source, materialCount: this.materials.length, variantCount: this.variants.length,
      encoding: { layout: 1, stride: 52, color: 'linear-rgb-f16', grime: 'f16', normal: 'oct-snorm16', uv: 'float32', flags: { uv: 1, normal: 2, color: 4, grime: 8, weather: 16, weather4: 32 } },
      textures: this.textures, materials: this.materials, families: this.families, variants: this.variants, frames: this.frames, parameters: this.parameters,
      coverage: { complete: this.materials.length > 0 && this.unsupported.size === 0, unsupported: [...this.unsupported].map(([shaderSha256, reason]) => ({ shaderSha256, reason })) } };
    return { ...value, sha256: digest(value) };
  }
}
