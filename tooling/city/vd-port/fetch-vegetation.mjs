import { fetchPinnedTextures } from './fetch-pinned-textures.mjs';
await fetchPinnedTextures(new URL('./vegetation-pins.json', import.meta.url));
