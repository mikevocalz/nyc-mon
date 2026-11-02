/**
 * MCP Apps does not grant WASM execution or decoder workers. Keep the
 * shared model components' explicit "no KTX2" path instead of bundling
 * Three's Basis WASM/JS defaults into every single-file view. PNG/JPEG GLBs
 * still render normally; a model requiring KHR_texture_basisu is rejected
 * by GLTFLoader and uses the components' existing still/error fallback.
 * This replacement is confined to build.ts; native and website decoding
 * continue to use the real shared loader.
 */
export function ktx2LoaderFor(_renderer: unknown): Promise<null> {
  return Promise.resolve(null);
}
