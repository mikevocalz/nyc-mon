import type { GLTFLoaderPlugin, GLTFParser } from 'three/addons/loaders/GLTFLoader.js';

/** Web: GLTFLoader's own image path (Blob URL + ImageBitmapLoader) works, so no plugin. */
export const eggTexturePlugin: ((parser: GLTFParser) => GLTFLoaderPlugin) | null = null;
