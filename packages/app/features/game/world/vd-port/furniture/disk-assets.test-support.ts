// The lane's binary assets read from disk, for the Node tests (the app fetches them as Metro assets: asset-bytes.native.ts).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FurnitureAssets } from './structures.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
export const readAsset = (rel: string): ArrayBuffer => {
  const b = readFileSync(join(HERE, rel));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

export function diskAssets(log?: string[]): FurnitureAssets {
  const get = async (rel: string) => { log?.push(rel); return readAsset(rel); };
  return {
    pools: () => get('assets/pools.bin'),
    panelAtlas: () => get('assets/panel-atlas.bin'),
    protos: () => get('assets/protos.bin'),
    signAtlas: () => get('assets/sign-atlas.bin'),
    pbrAlbedo: () => get('assets/pbr-albedo.bin'),
    pbrOrm: () => get('assets/pbr-orm.bin'),
    vkTextures: () => get('assets/vk-textures.bin'),
    cell: (key) => get(`cells/${key}.bin`),
  };
}
