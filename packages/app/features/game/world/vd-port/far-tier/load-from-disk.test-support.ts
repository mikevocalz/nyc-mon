// Tests and harnesses build the scene without load-game-scene.ts, so the far tier's bytes are read here from the
// bundled home chunks (data/chunks, committed) and, where the bake cache is present, the rest of the set
// (tooling/city/.cache/vd-lod16, gitignored). EXPO_PUBLIC_WORLD_VD_FAR=0 leaves the tier out, for an A/B.
import { readFileSync } from 'node:fs';
import { setVdFarBytes } from './load.ts';
import { VD_FAR } from './data/manifest.ts';

const DIRS = [new URL('./data/chunks/', import.meta.url), new URL('../../../../../../../tooling/city/.cache/vd-lod16/', import.meta.url)];

const read = (f: string): Uint8Array | null => {
  for (const dir of DIRS) {
    try {
      return new Uint8Array(readFileSync(new URL(f, dir)));
    } catch { /* next root */ }
  }
  return null;
};

export function loadVdFarFromDisk(): boolean {
  if (process.env.EXPO_PUBLIC_WORLD_VD_FAR?.trim() === '0') { setVdFarBytes(null); return false; }
  const chunks = new Map<string, Uint8Array>();
  for (const c of VD_FAR.chunks) {
    const b = read(c.f);
    if (b) chunks.set(c.f, b);
  }
  const landmarks = VD_FAR.landmarks ? read(VD_FAR.landmarks.f) : null;
  setVdFarBytes({ chunks, landmarks });
  return chunks.size > 0;
}
