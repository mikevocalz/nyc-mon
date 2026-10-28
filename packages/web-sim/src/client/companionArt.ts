/**
 * Creature art for the companion page, copied from packages/assets/creatures
 * (same files, same alt text) so web-sim stays free of app code. Keyed by
 * roster v11.1 Dex number. A form with no picture yet gets none: the page shows
 * the name and meters without inventing art.
 */
import cornerEgg from './art/corner-egg.webp';
import kitteeCee from './art/kittee-cee.webp';
import lilRatti from './art/lil-ratti.webp';
import metroEgg from './art/metro-egg.webp';
import prismEgg from './art/prism-egg.webp';
import squeaklet from './art/squeaklet.webp';
import yotito from './art/yotito.webp';

/** Vite resolves a .webp import to its URL; the shared webp.d.ts also allows native asset shapes. */
const url = (asset: unknown) => asset as string;

export interface CompanionArt { src: string; alt: string; width: number; height: number; /** A transparent cut-out, drawn straight on the page. */ cutout: boolean }

const ART: Readonly<Record<number, CompanionArt>> = {
  1: { src: url(metroEgg), alt: 'The Metro Egg, glossy red with white diagonal stripes and a gold inset, on a Harlem brownstone step.', width: 960, height: 1200, cutout: false },
  2: { src: url(squeaklet), alt: 'Squeaklet, a charcoal-furred rat Mon with pink ears and tail, sitting on a sunny Harlem brownstone stoop.', width: 960, height: 1200, cutout: false },
  3: { src: url(lilRatti), alt: 'Lil’ Ratti, a charcoal rat Mon with big pink ears, in a red hoodie, black shorts and red high-tops.', width: 960, height: 1200, cutout: true },
  8: { src: url(cornerEgg), alt: 'The Corner Egg, glossy pink with a white fur band and tiny gold heart, resting on a bodega step.', width: 960, height: 1200, cutout: false },
  9: { src: url(kitteeCee), alt: 'Kittee Cee, a calico cat Mon with soft paws, sitting on a Harlem bodega step beside a fruit stand.', width: 960, height: 1200, cutout: false },
  61: { src: url(prismEgg), alt: 'The Prism Egg, glossy black with painted flames and a clear crystal inset, on a Times Square ledge.', width: 960, height: 1200, cutout: false },
  62: { src: url(yotito), alt: 'Yotito, a sandy-gray coyote Mon with tall ears and big paws, standing on a bright Times Square sidewalk.', width: 960, height: 1200, cutout: false },
};

/** Lil' Ratti stands on the signed-out page, as on the sign-in page and the signed-out simulator. */
export const STARTER_ART = ART[3]!;

export function artForDex(dexId: number | null): CompanionArt | null {
  return dexId === null ? null : ART[dexId] ?? null;
}
