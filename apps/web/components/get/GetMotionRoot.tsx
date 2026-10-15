'use client';
/**
 * W05 choreography (Kinetrell documents on the home page's one GSAP clock;
 * see ../how-it-works/route-motion.tsx).
 *
 * - Signature: the key art and the form plate arrive together as one beat,
 *   the art settling from slightly large while the plate rises onto its
 *   orange plate; the title follows. Transform only: the form is never
 *   transparent and never blocked, and when hydration was slow the beat is
 *   skipped rather than replayed under a visitor already typing.
 * - The bento tiles stagger in as the night band arrives.
 */
import { compileMotion, defineMotion } from 'kinetrell/core';
// The inner routes run the home page's Kinetrell system (creator direction, 2026-10-13); the rule's
// ignore list names components/home/motion.ts only, so the adapter imports are allowed here.
import { createGsapTimeline } from 'kinetrell/web/gsap';
import { bindable, D, ms, OUT, reveal, RouteMotionRoot, S, Y, type RouteBinder } from '../how-it-works/route-motion';

const heroEnter = compileMotion(
  defineMotion({
    id: 'w05.hero.enter',
    initial: {
      'hero-get-art': { y: Y.rise, scale: S.enter },
      'hero-get-form': { y: Y.rise },
      'hero-get-title': { y: Y.step },
    },
    tracks: [
      { target: 'hero-get-art', to: { y: 0, scale: 1 }, atMs: 0, durationMs: ms(D.lg), ease: OUT },
      { target: 'hero-get-form', to: { y: 0 }, atMs: 0, durationMs: ms(D.lg), ease: OUT },
      { target: 'hero-get-title', to: { y: 0 }, atMs: 140, durationMs: ms(D.sm), ease: OUT },
    ],
  }),
);

const TILES = ['get-tile-0', 'get-tile-1', 'get-tile-2', 'get-tile-3'];
const bentoEnter = compileMotion(
  defineMotion({
    id: 'w05.bento.enter',
    initial: Object.fromEntries(TILES.map((t) => [t, { opacity: 0, y: Y.rise }])),
    tracks: TILES.map((t, i) => ({ target: t, to: { opacity: 1, y: 0 }, atMs: i * 110, durationMs: ms(D.sm), ease: OUT })),
  }),
);

const bind: RouteBinder = ({ all, triggers }) => {
  if (bindable(heroEnter, all) && performance.now() < 1800) {
    createGsapTimeline(heroEnter, all).play();
  }
  return reveal(bentoEnter, all, triggers['get-bento'], { start: 'top 80%' });
};

export default function GetMotionRoot() {
  return <RouteMotionRoot bind={bind} />;
}
