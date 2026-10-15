'use client';
/**
 * W04 choreography (Kinetrell documents on the home page's one GSAP clock;
 * see ./route-motion.tsx). Transform and opacity only.
 *
 * - Hero: one composed load beat, transform only, played when hydration was
 *   fast (as home's `w01.hero.enter`).
 * - The route, the page's signature: each stop's stretch of line draws down
 *   from its bullet, scrubbed by scroll from the moment the bullet reaches
 *   the reading line until the next bullet does, and each bullet's orange
 *   plate lights as the line arrives. Copy and art for a stop rise in as the
 *   stop enters the view.
 * - The care bento, the city tiles and the waitlist band stagger in.
 */
import { compileMotion, defineMotion } from 'kinetrell/core';
// The inner routes run the home page's Kinetrell system (creator direction, 2026-10-13); the rule's
// ignore list names components/home/motion.ts only, so the adapter imports are allowed here.
import { createGsapTimeline } from 'kinetrell/web/gsap';
import {
  bindable,
  D,
  LINEAR,
  ms,
  OUT,
  reveal,
  RouteMotionRoot,
  S,
  SPAN_MS,
  Y,
  type RouteBinder,
} from './route-motion';

/** Where the line's front sits in the view: a stop lights when its bullet crosses it. */
const READING_LINE = 'top 62%';
const STOPS = 5;
const CARE_TILES = 6;

const heroEnter = compileMotion(
  defineMotion({
    id: 'w04.hero.enter',
    initial: {
      'hero-hiw-copy': { y: Y.rise },
      'hero-hiw-art': { y: Y.reveal, scale: S.enter },
    },
    tracks: [
      { target: 'hero-hiw-art', to: { y: 0, scale: 1 }, atMs: 0, durationMs: ms(D.lg), ease: OUT },
      { target: 'hero-hiw-copy', to: { y: 0 }, atMs: 120, durationMs: ms(D.sm), ease: OUT },
    ],
  }),
);

const lineDraw = (i: number) =>
  compileMotion(
    defineMotion({
      id: `w04.route.line-${i}`,
      initial: { [`hiw-line-${i}`]: { scaleY: 0 } },
      tracks: [{ target: `hiw-line-${i}`, to: { scaleY: 1 }, durationMs: SPAN_MS, ease: LINEAR }],
    }),
  );

const stopLight = (i: number) =>
  compileMotion(
    defineMotion({
      id: `w04.route.light-${i}`,
      initial: { [`hiw-lit-${i}`]: { scale: 0, transformOrigin: 'top left' } },
      tracks: [{ target: `hiw-lit-${i}`, to: { scale: 1 }, durationMs: ms(D.xs), ease: OUT }],
    }),
  );

const stopEnter = (i: number) =>
  compileMotion(
    defineMotion({
      id: `w04.route.stop-${i}`,
      initial: { [`hiw-stop-${i}`]: { opacity: 0, y: Y.rise } },
      tracks: [{ target: `hiw-stop-${i}`, to: { opacity: 1, y: 0 }, durationMs: ms(D.md), ease: OUT }],
    }),
  );

/** A staggered entrance over named tiles, `step` ms apart. */
const stagger = (id: string, names: readonly string[], step = 90) =>
  compileMotion(
    defineMotion({
      id,
      initial: Object.fromEntries(names.map((n) => [n, { opacity: 0, y: Y.reveal }])),
      tracks: names.map((n, i) => ({ target: n, to: { opacity: 1, y: 0 }, atMs: i * step, durationMs: ms(D.sm), ease: OUT })),
    }),
  );

const careEnter = stagger(
  'w04.care.enter',
  ['hiw-care-0', 'hiw-care-head', ...Array.from({ length: CARE_TILES - 2 }, (_, i) => `hiw-care-${i + 1}`)],
);
const cityEnter = stagger('w04.city.enter', ['hiw-city-0', 'hiw-city-1', 'hiw-city-2'], 120);
const ctaEnter = stagger('w04.cta.enter', ['hiw-cta-copy', 'hiw-cta-art'], 160);

const terminusLight = compileMotion(
  defineMotion({
    id: 'w04.route.terminus',
    initial: { 'hiw-terminus': { scale: 0.4 } },
    tracks: [{ target: 'hiw-terminus', to: { scale: 1 }, durationMs: ms(D.sm), ease: OUT }],
  }),
);

const bind: RouteBinder = ({ all, triggers }) => {
  const bound: string[] = [];
  if (bindable(heroEnter, all) && performance.now() < 1800) {
    createGsapTimeline(heroEnter, all).play();
  }
  for (let i = 0; i < STOPS; i += 1) {
    const bullet = triggers[`hiw-stop-${i}`];
    const next = triggers[i + 1 < STOPS ? `hiw-stop-${i + 1}` : 'hiw-terminus'];
    bound.push(...reveal(stopEnter(i), all, bullet, { start: 'top 88%' }));
    bound.push(...reveal(stopLight(i), all, bullet, { start: READING_LINE }));
    if (next) {
      bound.push(
        ...reveal(lineDraw(i), all, bullet, { start: READING_LINE, endTrigger: next, end: READING_LINE, scrub: true }),
      );
    }
  }
  bound.push(...reveal(terminusLight, all, triggers['hiw-terminus'], { start: READING_LINE }));
  bound.push(...reveal(careEnter, all, all['hiw-care-0'] as Element | undefined, { start: 'top 85%' }));
  bound.push(...reveal(cityEnter, all, triggers['hiw-city'], { start: 'top 85%' }));
  bound.push(...reveal(ctaEnter, all, triggers['hiw-cta'], { start: 'top 80%' }));
  return bound;
};

export default function HowItWorksMotionRoot() {
  return <RouteMotionRoot bind={bind} />;
}
