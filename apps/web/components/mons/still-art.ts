/**
 * A Mon form's still picture, in one order everywhere on the site:
 *
 *   1. the approved still uploaded in the console (Payload `mon-art`),
 *   2. the bundled still in `@acme/assets/creatures`,
 *   3. none, and the page draws Coming Soon.
 *
 * The console's stills are read once per request on the server (lib/mon-art.ts
 * `loadMonArt`) and kept in a request-scoped holder (React `cache`), so the
 * art maps stay synchronous and every page reads the same list. Outside a
 * server render (unit tests, the seed export) the holder is empty and the
 * bundled art is used.
 */
import { cache } from 'react';
import { starterBloodlines, type StarterBloodline } from '@acme/content';

export interface AdminStill {
  speciesId: string;
  src: string;
  width: number;
  height: number;
  alt: string;
}

const holder = cache((): { stills: Map<string, AdminStill> } => ({ stills: new Map() }));

/** Store this request's approved console stills; called by `loadMonArt` before a page renders. */
export function provideAdminStills(stills: readonly AdminStill[]): void {
  const map = holder().stills;
  map.clear();
  for (const still of stills) map.set(still.speciesId, still);
}

/** The approved console still for a form, if one was uploaded. */
export function adminStill(speciesId: string | null | undefined): AdminStill | undefined {
  return speciesId ? holder().stills.get(speciesId) : undefined;
}

/** The species id of a starter slot's Egg or Baby form (`dex-021` for Fye Dot). */
export function starterSpeciesId(slot: StarterBloodline['slot'], stage: 'Egg' | 'Baby'): string | null {
  return starterBloodlines.find((starter) => starter.slot === slot)?.forms.find((form) => form.stage === stage)?.speciesId ?? null;
}
