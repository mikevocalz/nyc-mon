/**
 * Frees a parsed scene graph: every geometry, material and texture under
 * `root`, each once however many meshes share it, plus skeleton bone
 * textures. Duck-typed (no three import) so it runs in node tests and on
 * either three entry point.
 *
 * A texture's decoded image is closed too when it is an ImageBitmap. three
 * never closes one: `texture.dispose()` frees the GPU copy only, and on
 * native the bitmap (react-native-webgpu's createImageBitmap, RGBA in native
 * memory: 64 MB for Lil' Ratti's 4096² map) waits for a GC that does not see
 * its size. Only call this on a graph nothing will draw again.
 */

interface Disposable {
  dispose(): void;
}
interface TextureLike extends Disposable {
  readonly isTexture: true;
  image: unknown;
}
interface NodeLike {
  readonly geometry?: Disposable;
  readonly material?: object | readonly object[];
  readonly skeleton?: Disposable;
  traverse(visit: (node: NodeLike) => void): void;
}

export interface DisposeCount {
  readonly geometries: number;
  readonly materials: number;
  readonly textures: number;
  readonly images: number;
}

function isTexture(value: unknown): value is TextureLike {
  return typeof value === 'object' && value !== null && (value as { isTexture?: unknown }).isTexture === true;
}

function closeImage(image: unknown): boolean {
  const bitmap = image as { close?: unknown; width?: unknown } | null;
  if (bitmap === null || typeof bitmap !== 'object' || typeof bitmap.close !== 'function' || typeof bitmap.width !== 'number') return false;
  (bitmap.close as () => void).call(bitmap);
  return true;
}

export function disposeObjectTree(root: NodeLike): DisposeCount {
  const geometries = new Set<Disposable>();
  const materials = new Set<Disposable>();
  const textures = new Set<TextureLike>();
  const skeletons = new Set<Disposable>();
  root.traverse((node) => {
    if (node.geometry) geometries.add(node.geometry);
    if (node.skeleton) skeletons.add(node.skeleton);
    const list = node.material === undefined ? [] : Array.isArray(node.material) ? node.material : [node.material];
    for (const material of list as readonly Record<string, unknown>[]) {
      materials.add(material as unknown as Disposable);
      for (const value of Object.values(material)) if (isTexture(value)) textures.add(value);
    }
  });
  let images = 0;
  for (const g of geometries) g.dispose();
  for (const m of materials) m.dispose();
  for (const t of textures) {
    t.dispose();
    if (closeImage(t.image)) {
      images += 1;
      t.image = null;
    }
  }
  for (const s of skeletons) s.dispose();
  return { geometries: geometries.size, materials: materials.size, textures: textures.size, images };
}
