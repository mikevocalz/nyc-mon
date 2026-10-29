// Tests and harnesses build the scene without load-game-scene.ts, so the block packs are read here from the files the
// bake wrote (EXPO_PUBLIC_WORLD_VD_BLOCKS=0 leaves them out, for an A/B).
import { readFileSync } from 'node:fs';
import { setVdBlockBytes } from './load.ts';
import { VD_BLOCKS } from './data/manifest.ts';

export function loadVdBlocksFromDisk(): boolean {
  if (process.env.EXPO_PUBLIC_WORLD_VD_BLOCKS?.trim() === '0') { setVdBlockBytes(null); return false; }
  const dir = new URL('./data/', import.meta.url);
  setVdBlockBytes({
    shell: new Uint8Array(readFileSync(new URL('shell.bin', dir))),
    near: new Map(VD_BLOCKS.near.map((c) => [c.key, new Uint8Array(readFileSync(new URL(`near/${c.key}.bin`, dir)))])),
  });
  return true;
}
