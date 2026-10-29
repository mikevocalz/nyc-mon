// Native: Metro registers `.bin` as an asset (apps/mobile/metro.config.js assetExts), so a cell package's `require()`
// is a numeric id that React Native resolves to the dev server URL in development and a bundled file in release (the
// route packages/ui/three/hatch/egg-bytes.native.ts takes for the egg GLBs). Fetched when the streamer asks for it.
// The non-visual asset resolver behind Image.resolveAssetSource (react-native/Libraries/Image/resolveAssetSource.js):
// lane code may not import the Image primitive (packages/config/eslint/boundaries.mjs), and it draws nothing here.
// @ts-expect-error React Native ships this module untyped
import resolveAssetSource from 'react-native/Libraries/Image/resolveAssetSource';
import { VD_CELL_ASSETS, VD_PBR_ALBEDO_ASSET, VD_PBR_ORM_ASSET, VD_PROTOS_ASSET, VD_SIGN_ATLAS_ASSET, VD_VK_TEXTURES_ASSET } from './cells/index.ts';
import type { FurnitureAssets } from './structures.ts';

/* eslint-disable @typescript-eslint/no-require-imports -- Metro bundles an asset only through a literal require() */
async function bytesOf(id: number): Promise<ArrayBuffer> {
  const uri = (resolveAssetSource as (id: number) => { uri?: string } | null)(id)?.uri;
  if (!uri) throw new Error(`vd structures: no URI for asset ${id}`);
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`vd structures: GET ${uri} answered ${response.status}`);
  return response.arrayBuffer();
}

export const FURNITURE_ASSETS: FurnitureAssets | null = {
  pools: () => bytesOf(require('./assets/pools.bin') as number),
  panelAtlas: () => bytesOf(require('./assets/panel-atlas.bin') as number),
  cell: (key) => { const f = VD_CELL_ASSETS[key]; if (!f) throw new Error(`vd structures: no cell ${key}`); return bytesOf(f()); },
  protos: () => bytesOf(VD_PROTOS_ASSET()),
  signAtlas: () => bytesOf(VD_SIGN_ATLAS_ASSET()),
  pbrAlbedo: () => bytesOf(VD_PBR_ALBEDO_ASSET()),
  pbrOrm: () => bytesOf(VD_PBR_ORM_ASSET()),
  vkTextures: () => bytesOf(VD_VK_TEXTURES_ASSET()),
};
