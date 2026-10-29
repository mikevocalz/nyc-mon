// Tests and harnesses build the scene without load-game-scene.ts, so the block packs are read here from the files the
// bake wrote (EXPO_PUBLIC_WORLD_VD_BLOCKS=0 leaves them out, for an A/B).
import { readFileSync } from 'node:fs';
import { setVdBlockBytes } from './load.ts';
import { VD_BLOCKS } from './data/manifest.ts';
import { worldPresetWithoutCanvas } from '../../../perf/tier-presets.ts';

/** `level` defaults to what the env's preset draws (perf/tier-presets.ts worldPresetWithoutCanvas), as load.ts reads. */
export function loadVdBlocksFromDisk(level: 'near' | 'lite' = worldPresetWithoutCanvas().vdPort.blocksNear.level): boolean {
  if (process.env.EXPO_PUBLIC_WORLD_VD_BLOCKS?.trim() === '0') { setVdBlockBytes(null); return false; }
  const dir = new URL('./data/', import.meta.url);
  setVdBlockBytes({
    shell: new Uint8Array(readFileSync(new URL('shell.bin', dir))),
    near: new Map(VD_BLOCKS[level].map((c) => [c.key, new Uint8Array(readFileSync(new URL(`${level}/${c.key}.bin`, dir)))])),
    level,
  });
  return true;
}
