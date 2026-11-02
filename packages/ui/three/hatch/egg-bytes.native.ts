import { Image } from 'react-native';
import { binaryFetch } from '../../net/index.native';
import { fetchBytesWithDeadline } from '../../net/deadline';
import { readWithProgress } from '../mon/load-progress';

/**
 * Native: Metro registers `.glb` as an asset (apps/mobile/metro.config.js
 * assetExts), so `require()` gives a numeric id. React Native resolves it to
 * the dev server URL in development and a bundled file in release, the same
 * route packages/spatial/audio takes for its files. A release Android build
 * stores non-image assets as raw resources whose "uri" is a bare name; that
 * fetch fails and the caller falls back to the static egg art.
 */
export async function fetchEggBytes(
  source: string | number,
  onProgress?: (loaded: number, total: number | null) => void,
): Promise<ArrayBuffer> {
  const uri = typeof source === 'string' ? source : Image.resolveAssetSource(source)?.uri;
  if (!uri) throw new Error(`no URI for egg GLB asset ${String(source)}`);
  if (!/^[a-z][a-z0-9+.-]*:/i.test(uri)) throw new Error(`egg GLB resolved to "${uri}", which is not a fetchable URI`);
  // A stalled dev-server asset request used to hold the game's load forever
  // (the Promise.all in load-game-scene never resolved — A12X iPad): the
  // deadline turns a hang into a reject, and the caller's catch resolves null.
  const buf = await fetchBytesWithDeadline(uri, undefined, undefined, binaryFetch as never);
  if (!onProgress) return buf;
  onProgress(buf.byteLength, buf.byteLength);
  return buf;
}
