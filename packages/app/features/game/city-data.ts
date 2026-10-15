// The one bundled tile (PR #30: Harlem around the Apollo Theater), parsed once
// per JS runtime. A parse failure is a build defect (the JSON ships in the
// binary), so the screen shows data-error rather than retrying.
//
// Static import: Metro inlines JSON, and the shared tsconfig has
// resolveJsonModule. The tile is ~1000 lines; if bundle cost matters later,
// move it behind the scene's dynamic import.
import raw from './data/harlem-apollo.json';
import { parseCityDataset, type CityDataset } from './city-dataset.ts';
import { cityDatasetBounds, type CityBounds } from './city-bounds.ts';

export type BundledCity =
  | { ok: true; dataset: CityDataset; bounds: CityBounds }
  | { ok: false; error: Error };

let cached: BundledCity | null = null;

export function bundledCity(): BundledCity {
  if (cached) return cached;
  try {
    const dataset = parseCityDataset(raw as unknown);
    cached = { ok: true, dataset, bounds: cityDatasetBounds(dataset) };
  } catch (error) {
    cached = { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
  return cached;
}

/** Shown in the HUD and spoken; the place, not the file name. */
export const BUNDLED_CITY_NAME = 'Harlem, around the Apollo Theater';
