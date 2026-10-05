import { starterBloodlines, walkChain } from '@acme/content';
import { starterCards, type StarterCard } from '../home/StartersSection';

/**
 * The W02 route segment for each starter. Stable URL ids keyed by the
 * roster's BloodlineId (the mon file names: hood-ratti, bodega-cee, yotes) —
 * not derived from `bloodlineName`, which is prose ("Bodega Baddiee Cee").
 */
const SLUG_BY_BLOODLINE_ID: Readonly<Record<string, string>> = {
  F01: 'hood-ratti',
  F02: 'bodega-cee',
  F12: 'yotes',
};

/** One node of the chain, flattened for the "Evolution line" list. */
export interface MonsLineStep {
  key: string;
  stage: string;
  name: string | null;
  dexId: number | null;
}

/** A starter card plus everything its /mons/[slug] page renders. */
export interface MonsStarter extends StarterCard {
  slug: string;
  /** The Baby form's species-card culture note — TODO(canon) when null. */
  cultureNote: string | null;
  line: readonly MonsLineStep[];
}

/** The /mons slug for a starter card (`card.key` is its BloodlineId). */
export function slugFor(card: Pick<StarterCard, 'key'>): string {
  const slug = SLUG_BY_BLOODLINE_ID[card.key];
  if (slug === undefined) throw new Error(`No /mons slug registered for bloodline ${card.key}`);
  return slug;
}

/** The three starters in slot order, each with its slug and full chain. */
export function monsStarters(): readonly MonsStarter[] {
  const cards = starterCards();
  return starterBloodlines.map((starter) => {
    const card = cards.find((c) => c.key === starter.bloodline.bloodlineId);
    if (card === undefined) throw new Error(`No starter card for ${starter.bloodline.bloodlineId}`);
    const baby = starter.bloodline.chain.evolvesTo[0];
    const babyForm = baby === undefined ? undefined : starter.forms.find((f) => f.speciesId === baby.speciesId);
    return {
      ...card,
      slug: slugFor(card),
      cultureNote: babyForm?.cultureNote ?? null,
      line: walkChain(starter.bloodline.chain).map((node) => ({
        key: node.speciesId,
        stage: node.stage,
        name: node.formName,
        dexId: node.dexId,
      })),
    };
  });
}

/** Every generated /mons/[slug] segment, for generateStaticParams. */
export function monsSlugs(): readonly string[] {
  return monsStarters().map((starter) => starter.slug);
}

/** The starter for one slug, or undefined for anything else (→ notFound). */
export function starterBySlug(slug: string): MonsStarter | undefined {
  return monsStarters().find((starter) => starter.slug === slug);
}
