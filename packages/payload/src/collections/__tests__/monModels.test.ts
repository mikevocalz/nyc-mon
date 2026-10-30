import type { CollectionBeforeChangeHook } from 'payload';
import { allSpecies } from '@acme/content';
import { describe, expect, it } from 'vitest';
import { readGlb } from '../glb.ts';
import { MonModels } from '../MonModels.ts';
import { fakeReq, staff } from './helpers.ts';

/** A minimal GLB: header + JSON chunk (padded to 4 bytes), no BIN chunk. */
function glb(json: object, overrides: { magic?: number; version?: number } = {}): Uint8Array {
  let text = JSON.stringify(json);
  while (text.length % 4) text += ' ';
  const body = new TextEncoder().encode(text);
  const out = new Uint8Array(20 + body.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, overrides.magic ?? 0x46546c67, true);
  view.setUint32(4, overrides.version ?? 2, true);
  view.setUint32(8, out.length, true);
  view.setUint32(12, body.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.set(body, 20);
  return out;
}

const yote = {
  asset: { version: '2.0' },
  animations: [{ name: 'Idle' }, {}],
  meshes: [{ extras: { targetNames: ['Smile', 'Blink'] }, primitives: [{ attributes: { POSITION: 0 } }] }],
  accessors: [{ bufferView: 0, min: [-0.2, 0, -0.1], max: [0.2, 0.45, 0.1] }],
};

describe('readGlb', () => {
  it('reads clips, morph targets and height', () => {
    expect(readGlb(glb(yote))).toEqual({ animationClips: ['Idle', 'animation_1'], morphTargets: ['Smile', 'Blink'], heightMeters: 0.45 });
  });

  it('rejects files that are not glTF 2.0 binaries', () => {
    expect(() => readGlb(glb(yote, { magic: 0x12345678 }))).toThrow(/not a GLB/);
    expect(() => readGlb(glb(yote, { version: 1 }))).toThrow(/glTF 2.0/);
    expect(() => readGlb(glb(yote).subarray(0, 30))).toThrow(/cut short/);
  });

  it('rejects what Viro cannot load and oversized clip lists', () => {
    expect(() => readGlb(glb({ ...yote, accessors: [{ min: [0, 0, 0], max: [1, 1, 1] }] }))).toThrow(/empty accessors/);
    expect(() => readGlb(glb({ ...yote, animations: [{ name: 'Idle', samplers: [{ input: 0, output: 0 }] }] }))).toThrow(/interpolation/);
    expect(() => readGlb(glb({ ...yote, animations: Array.from({ length: 201 }, () => ({})) }))).toThrow(/201 animation clips/);
  });

  it('reads a quantized mesh through its node scale, not as raw integers', () => {
    // KHR_mesh_quantization: normalized unsigned shorts, scaled back to metres by the node.
    const quantized = {
      ...yote,
      accessors: [{ bufferView: 0, normalized: true, componentType: 5123, min: [0, 0, 0], max: [65535, 65535, 65535] }],
      nodes: [{ children: [1], scale: [2, 2, 2] }, { mesh: 0, scale: [0.1, 0.0755, 0.1], translation: [0, 1, 0] }],
      scenes: [{ nodes: [0] }],
    };
    expect(readGlb(glb(quantized)).heightMeters).toBe(0.151);
  });

  it('has no height when the meshes declare no bounds', () => {
    expect(readGlb(glb({ asset: { version: '2.0' } })).heightMeters).toBeNull();
  });
});

describe('mon-models beforeChange', () => {
  const hook = MonModels.hooks!.beforeChange![0] as CollectionBeforeChangeHook;
  const species = allSpecies[0]!;
  const run = (data: Record<string, unknown>, file?: Uint8Array, originalDoc?: Record<string, unknown>, name = 'yote.glb') => {
    const { req } = fakeReq({ user: staff('content') });
    if (file) req.file = { data: Buffer.from(file), size: file.length, name, mimetype: 'model/gltf-binary' };
    return hook({ data, req, operation: originalDoc ? 'update' : 'create', context: {}, collection: {} as never, originalDoc: originalDoc as never });
  };

  it('fills stage and bloodline from the roster and facts from the file', async () => {
    const data = await run({ speciesId: species.speciesId, status: 'approved' }, glb(yote));
    expect(data).toMatchObject({ stage: species.stage, bloodlineId: species.bloodlineId, heightMeters: 0.45, status: 'in-review', animationClips: [{ name: 'Idle' }, { name: 'animation_1' }] });
  });

  it('gives each upload a fresh key and drops role mappings to clips the new file lacks', async () => {
    const data = await run({}, glb(yote), { speciesId: species.speciesId, animations: [{ role: 'idle', clip: 'Idle' }, { role: 'play', clip: 'Gone' }] });
    expect(data.filename).toMatch(new RegExp(`^${species.speciesId}-[a-z0-9]+\\.glb$`));
    expect(data.animations).toEqual([{ role: 'idle', clip: 'Idle' }]);
  });

  it('rejects an unknown form and a non-GLB file', async () => {
    await expect(run({ speciesId: species.speciesId }, glb(yote), undefined, 'yote.html')).rejects.toThrow(/Only .glb/);
    await expect(run({ speciesId: 'nope' })).rejects.toThrow(/roster/);
    await expect(run({ speciesId: species.speciesId }, glb(yote, { magic: 1 }))).rejects.toThrow(/not a GLB/);
  });

  it('only ops and content write; staff read everything; everyone else reads approved models', () => {
    const access = MonModels.access!;
    const reqFor = (role: string) => fakeReq({ user: staff(role as never) }).req;
    expect(access.update!({ req: reqFor('content') } as never)).toBe(true);
    expect(access.update!({ req: reqFor('support') } as never)).toBe(false);
    expect(access.read!({ req: reqFor('support') } as never)).toBe(true);
    expect(access.read!({ req: fakeReq({ user: null }).req } as never)).toEqual({ status: { equals: 'approved' } });
  });
});
