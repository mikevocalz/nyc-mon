import { CREATURE_ART, type CreatureArt } from '@acme/assets/creatures';

/**
 * Art for a form by Dex number and kind; undefined when the bundle has none.
 * Kept out of mon-identity.ts so the Alexa Mon card can draw a still without
 * importing `@acme/content` and its full roster.
 */
export function artFor(kind: 'baby' | 'egg', dexId: number | null): CreatureArt | undefined {
  if (dexId === null) return undefined;
  return CREATURE_ART.find((a) => a.kind === kind && a.dexId === dexId);
}
