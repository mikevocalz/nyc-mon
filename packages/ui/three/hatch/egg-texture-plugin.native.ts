import * as THREE from 'three/webgpu';
import type { GLTFLoaderPlugin, GLTFParser } from 'three/addons/loaders/GLTFLoader.js';

interface TextureJson {
  readonly textures?: readonly { readonly source?: number; readonly sampler?: number; readonly name?: string }[];
  readonly images?: readonly { readonly bufferView?: number; readonly name?: string }[];
  readonly samplers?: readonly { readonly magFilter?: number; readonly minFilter?: number; readonly wrapS?: number; readonly wrapT?: number }[];
}

const FILTERS: Record<number, THREE.TextureFilter> = {
  9728: THREE.NearestFilter,
  9729: THREE.LinearFilter,
  9984: THREE.NearestMipmapNearestFilter,
  9985: THREE.LinearMipmapNearestFilter,
  9986: THREE.NearestMipmapLinearFilter,
  9987: THREE.LinearMipmapLinearFilter,
};
const WRAPS: Record<number, THREE.Wrapping> = {
  33071: THREE.ClampToEdgeWrapping,
  33648: THREE.MirroredRepeatWrapping,
  10497: THREE.RepeatWrapping,
};

/**
 * Native: GLTFLoader turns an embedded image into a Blob URL, and React
 * Native's Blob cannot be built from an ArrayBuffer. This plugin decodes
 * the image bytes with react-native-webgpu's `createImageBitmap(ArrayBuffer)`
 * extension instead and applies the glTF sampler the way GLTFParser does.
 * Images with an external URI fall through to the default path.
 */
export function eggTexturePlugin(parser: GLTFParser): GLTFLoaderPlugin {
  const json = parser.json as TextureJson;
  return {
    name: 'NYC_native_embedded_images',
    loadTexture(textureIndex: number) {
      const def = json.textures?.[textureIndex];
      const image = def?.source === undefined ? undefined : json.images?.[def.source];
      if (!def || image?.bufferView === undefined) return null;
      return (parser.getDependency('bufferView', image.bufferView) as Promise<ArrayBuffer>).then(async (bytes) => {
        const bitmap = await createImageBitmap(bytes);
        const texture = new THREE.Texture(bitmap);
        texture.flipY = false;
        texture.name = def.name ?? image.name ?? '';
        const sampler = (def.sampler === undefined ? undefined : json.samplers?.[def.sampler]) ?? {};
        texture.magFilter = (sampler.magFilter === undefined ? undefined : FILTERS[sampler.magFilter]) as THREE.MagnificationTextureFilter ?? THREE.LinearFilter;
        texture.minFilter = (sampler.minFilter === undefined ? undefined : FILTERS[sampler.minFilter]) ?? THREE.LinearMipmapLinearFilter;
        texture.wrapS = (sampler.wrapS === undefined ? undefined : WRAPS[sampler.wrapS]) ?? THREE.RepeatWrapping;
        texture.wrapT = (sampler.wrapT === undefined ? undefined : WRAPS[sampler.wrapT]) ?? THREE.RepeatWrapping;
        texture.generateMipmaps = texture.minFilter !== THREE.NearestFilter && texture.minFilter !== THREE.LinearFilter;
        texture.needsUpdate = true;
        parser.associations.set(texture, { textures: textureIndex });
        return texture;
      });
    },
  };
}
