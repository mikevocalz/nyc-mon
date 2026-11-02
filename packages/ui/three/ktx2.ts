import type { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

/**
 * KTX2 (KHR_texture_basisu) support for the GLTFLoader sites. One loader per
 * renderer: `detectSupport` reads that renderer's compressed-format support
 * (WebGPU features, or the WebGL extension list), and three keeps a transcode
 * worker pool per KTX2Loader — it warns when several are live — so a format
 * config detected on one renderer must not serve another.
 *
 * On web the Basis transcoder (basis_transcoder.js/.wasm) is served from
 * /basis/: tooling/copy-basis-assets.mjs copies it into each app's public dir,
 * the same route the Viro and CanvasKit sidecars take. The path is only read
 * when a BasisU file actually transcodes, so it is inert until then.
 *
 * Native (Hermes) has no WebAssembly, so a BasisU texture can never transcode
 * there: native GLBs must ship vkFormat-only KTX2, which KTX2Loader parses raw
 * (createRawTexture) without touching the transcoder or a worker. The dynamic
 * import keeps KTX2Loader's module-scope `new URL(..., import.meta.url)` off
 * the module graph until a renderer asks for it, and any failure becomes "no
 * KTX2" — what the loaders had before — instead of a broken rig.
 */
export type Ktx2Renderer = Parameters<KTX2Loader['detectSupport']>[0];

/** One loader per renderer: its worker pool and format config belong to that renderer. */
const loaders = new WeakMap<Ktx2Renderer, Promise<KTX2Loader | null>>();

/**
 * The shared KTX2Loader for `renderer`, or null where KTX2 cannot run. The
 * renderer must be initialised — `renderer.init()` awaited — because WebGPU's
 * `hasFeature` throws before the backend exists. ThreeCanvas hands scenes a
 * post-init renderer; the WebGL stage's context is live at construction.
 */
export function ktx2LoaderFor(renderer: Ktx2Renderer): Promise<KTX2Loader | null> {
  let pending = loaders.get(renderer);
  if (pending === undefined) {
    pending = import('three/addons/loaders/KTX2Loader.js')
      .then(({ KTX2Loader }) => new KTX2Loader().setTranscoderPath('/basis/').detectSupport(renderer))
      .catch((error: unknown) => {
        console.warn('[three] KTX2Loader unavailable; KHR_texture_basisu textures stay unloaded.', error);
        return null;
      });
    loaders.set(renderer, pending);
  }
  return pending;
}
