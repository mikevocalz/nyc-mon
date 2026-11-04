import { bindShellCollisionPack, ShellCollisionPackError, type ShellCollisionManifest } from './shell-collision-pack.ts';
import { VD_SHELL_COLLISION } from './data-collision/manifest.ts';

// Generated exact CPU collision data is a bundled Metro asset, just like the
// original shell packs. It introduces no network or renderer dependency.
export async function preloadShellCollisionPack(sources: readonly { ring: number; bytes: Uint8Array }[]) {
  // Keep binary require and platform IO inside production preload; generic
  // Node geometry producers may inject their bytes without a Metro runtime.
  try {
    const [{ platformIo }, { fetchAssetBytes }] = await Promise.all([
      import('#cell-source-platform'), import('@acme/ui/three/asset-bytes'),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const asset: number = require('./data-collision/shell-collision.bin');
    const payload = await fetchAssetBytes(asset);
    return await bindShellCollisionPack(VD_SHELL_COLLISION as ShellCollisionManifest, new Uint8Array(payload), sources, platformIo().sha256Hex);
  } catch (cause) {
    if (cause instanceof ShellCollisionPackError) throw cause;
    throw new ShellCollisionPackError(`required bundled asset could not load: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
}
