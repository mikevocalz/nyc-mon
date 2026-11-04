import { fetchPinnedTextures } from './fetch-pinned-textures.mjs';
await fetchPinnedTextures(new URL('./surface-global-pins.json', import.meta.url));
