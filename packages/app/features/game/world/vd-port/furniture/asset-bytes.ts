// Web and Node: no asset route for the structure packages here (the web build bundles no `.bin` asset loader for them),
// so lane C's pools and structures stay unloaded (the web build renders no city). Tests pass their own FurnitureAssets to createStructures.
import type { FurnitureAssets } from './structures.ts';

export const FURNITURE_ASSETS: FurnitureAssets | null = null;
