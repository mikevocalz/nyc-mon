import { Image } from 'react-native';

/**
 * Native: Metro registers `.glb` as an asset (apps/mobile/metro.config.js
 * assetExts), so `require()` gives a numeric id. React Native resolves it to
 * the dev server URL in development and a bundled file in release, the same
 * route packages/spatial/audio takes for its files. A release Android build
 * stores non-image assets as raw resources whose "uri" is a bare name; that
 * fetch fails and the caller falls back to the static egg art.
 */
export async function fetchEggBytes(source: string | number): Promise<ArrayBuffer> {
  const uri = typeof source === 'string' ? source : Image.resolveAssetSource(source)?.uri;
  if (!uri) throw new Error(`no URI for egg GLB asset ${String(source)}`);
  if (!/^[a-z][a-z0-9+.-]*:/i.test(uri)) throw new Error(`egg GLB resolved to "${uri}", which is not a fetchable URI`);
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`GET ${uri} answered ${response.status}`);
  return response.arrayBuffer();
}
