import { describe, expect, it } from 'vitest';
import { checkGlbHeader, checkMonModelFile, MON_MODEL_FILE_MESSAGES, MON_MODEL_MAX_BYTES } from '../monModelFile.ts';

function header(magic: number, version: number, length: number): Uint8Array {
  const out = new Uint8Array(12);
  const view = new DataView(out.buffer);
  view.setUint32(0, magic, true);
  view.setUint32(4, version, true);
  view.setUint32(8, length, true);
  return out;
}
const GLTF = 0x46546c67;

describe('checkMonModelFile', () => {
  it('accepts a .glb of any case up to 25 MB', () => {
    expect(checkMonModelFile({ name: 'squeaklet.glb', size: 1024 })).toEqual({ ok: true });
    expect(checkMonModelFile({ name: 'RATTI.GLB', size: MON_MODEL_MAX_BYTES })).toEqual({ ok: true });
  });
  it('rejects other extensions, empty files and files over the cap', () => {
    expect(checkMonModelFile({ name: 'ratti.gltf', size: 10 })).toEqual({ ok: false, problem: 'type' });
    expect(checkMonModelFile({ name: 'ratti.glb.zip', size: 10 })).toEqual({ ok: false, problem: 'type' });
    expect(checkMonModelFile({ name: 'ratti.glb', size: 0 })).toEqual({ ok: false, problem: 'empty' });
    expect(checkMonModelFile({ name: 'ratti.glb', size: MON_MODEL_MAX_BYTES + 1 })).toEqual({ ok: false, problem: 'size' });
  });
});

describe('checkGlbHeader', () => {
  it('accepts glTF 2.0 whose declared length is the file size', () => {
    expect(checkGlbHeader(header(GLTF, 2, 4096), 4096)).toEqual({ ok: true });
  });
  it('names what is wrong with a bad header', () => {
    expect(checkGlbHeader(new Uint8Array(4), 4)).toEqual({ ok: false, problem: 'header' });
    expect(checkGlbHeader(header(0x12345678, 2, 64), 64)).toEqual({ ok: false, problem: 'header' });
    expect(checkGlbHeader(header(GLTF, 1, 64), 64)).toEqual({ ok: false, problem: 'version' });
    expect(checkGlbHeader(header(GLTF, 2, 64), 80)).toEqual({ ok: false, problem: 'length' });
  });
  it('has a message for every problem', () => {
    for (const problem of ['type', 'empty', 'size', 'header', 'version', 'length'] as const) {
      expect(MON_MODEL_FILE_MESSAGES[problem]).toMatch(/\.$/);
    }
  });
});
