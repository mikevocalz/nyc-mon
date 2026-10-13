/**
 * `w01.hero.enter` as data (PS-035). Kept out of motion.ts so it can be
 * unit-tested without GSAP or a DOM: it imports only Kinetrell's pure core
 * and the page-motion tokens.
 *
 * The headline and the support line are the LCP candidates (on phones
 * Lighthouse names the support line), so they are not motion targets at all:
 * they carry plain ids (`HERO_LCP_TEXT_IDS` in motion-markers.ts), not `mfx-`
 * markers, and paint in their final place from the server HTML. The entrance moves only what sits around them:
 * the poster photograph settles, the seal stamps, then the CTA and district
 * control step into place. Transform only, nothing goes transparent, and a
 * late bind skips the beat (motion.ts).
 */
import { compileMotion, defineMotion } from 'kinetrell/core';
import { pageMotion } from '@acme/theme';

const { duration: D, ease: E, distance: Y, scale: S, tilt: T } = pageMotion;
const ms = (seconds: number) => Math.round(seconds * 1000);
const OUT = E.out.gsap;

/**
 * The entrance replays only when the motion layer binds within this many ms
 * of navigation start; later, the static composition stands.
 */
export const HERO_ENTRANCE_BIND_BUDGET_MS = 1800;

export const heroEntrance = compileMotion(
  defineMotion({
    id: 'w01.hero.enter',
    initial: {
      'hero-art': { y: Y.reveal, scale: S.enter },
      'hero-seal': { y: Y.step, rotate: -T.stamp },
      'hero-actions': { y: Y.step },
    },
    tracks: [
      { target: 'hero-art', to: { y: 0, scale: 1 }, atMs: 0, durationMs: ms(D.lg), ease: OUT },
      { target: 'hero-seal', to: { y: 0, rotate: 0 }, atMs: 300, durationMs: ms(D.sm), ease: OUT },
      { target: 'hero-actions', to: { y: 0 }, atMs: 420, durationMs: ms(D.xs), ease: OUT },
    ],
  }),
);
