'use client';
/**
 * The W01 home page motion layer — the single place Kinetrell meets the DOM
 * on this site (spec: docs/design/site/PREMIUM_SITE_MOTION.md).
 *
 * Targeting is by `id` prefix, because @acme/ui resolves `className` to
 * inline style on web (no classes reach the DOM) while `id` attributes pass
 * through untouched:
 *   `mfx-<name>`  fade-in target — pre-hidden by CSS while `motion-armed` is
 *                 on the page root, then brought in by a timeline.
 *   `mpx-<name>`  transform-only target — parallax/scrub, never pre-hidden.
 *   `trg-<name>`  ScrollTrigger anchor — the section root itself.
 *
 * Timelines are declared as Kinetrell `defineMotion` documents (data, not
 * calls), compiled once, then bound to elements via `createGsapTimeline` +
 * `attachScrollTrigger`. Reduced motion never reaches this file: MotionRoot
 * renders the static composition instead, and `motion-armed` is never set.
 */
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { compileMotion, defineMotion, type CompiledMotion } from 'kinetrell/core';
import {
  attachScrollTrigger,
  createGsapTimeline,
  ensureScrollTrigger,
  type GsapTargetMap,
} from 'kinetrell/web/gsap';
import { breakpoints, pageMotion } from '@acme/theme';
import { MOTION_MARKER_SELECTOR, parseMotionMarker } from './motion-markers';

const { duration: D, ease: E, distance: Y, parallax: P, scale: S, tilt: T, scrub: SCRUB } = pageMotion;
const ms = (seconds: number) => Math.round(seconds * 1000);
const OUT = E.out.gsap;
const LINEAR = E.scrub.gsap;
/** A scrubbed track spans the whole trigger range; ScrollTrigger maps it to scroll. */
const SPAN_MS = 1000;

export const ARMED_CLASS = 'motion-armed';

interface Targets {
  fades: GsapTargetMap;
  scrubs: GsapTargetMap;
  triggers: Record<string, Element>;
}

function collectTargets(root: ParentNode): Targets {
  const fades: Record<string, gsap.TweenTarget> = {};
  const scrubs: Record<string, gsap.TweenTarget> = {};
  const triggers: Record<string, Element> = {};
  for (const el of root.querySelectorAll<HTMLElement>(MOTION_MARKER_SELECTOR)) {
    const marker = parseMotionMarker(el.id);
    if (!marker) continue;
    if (marker.kind === 'fade') fades[marker.name] = el;
    else if (marker.kind === 'scrub') scrubs[marker.name] = el;
    else triggers[marker.name] = el;
  }
  return { fades, scrubs, triggers };
}

/** A motion only binds if every named target exists — logs the missing ids in dev. */
function bindable(motion: CompiledMotion, map: GsapTargetMap): boolean {
  const ids = new Set([...motion.tracks.map((t) => t.target), ...Object.keys(motion.initial)]);
  const missing = [...ids].filter((id) => !(id in map));
  if (missing.length && process.env.NODE_ENV !== 'production') {
    console.warn(`[kinetrell] ${motion.id}: missing targets ${missing.join(', ')} — skipped`);
  }
  return missing.length === 0;
}

// ---------------------------------------------------------------------------
// Authored motions (PREMIUM_SITE_MOTION §3): each is one beat, not a blanket
// fade. Transform/opacity only.
// ---------------------------------------------------------------------------

/**
 * Hero load, one composed beat in four steps: the poster photograph settles
 * (the environment), the headline plates resolve as one block, the seal lands
 * like a stamp, then the CTA and district control are in place. No per-line
 * stagger. Transform-only on purpose: the photograph is the LCP element, so
 * nothing in the hero ever goes transparent, and a late bind skips the beat
 * (globals.css keeps hero markers out of the pre-hide).
 */
const heroEntrance = compileMotion(
  defineMotion({
    id: 'w01.hero.enter',
    initial: {
      'hero-art': { y: Y.reveal, scale: S.enter },
      'hero-title': { y: Y.rise },
      'hero-body': { y: Y.step },
      'hero-seal': { y: Y.step, rotate: -T.stamp },
      'hero-actions': { y: Y.step },
    },
    tracks: [
      { target: 'hero-art', to: { y: 0, scale: 1 }, atMs: 0, durationMs: ms(D.lg), ease: OUT },
      { target: 'hero-title', to: { y: 0 }, atMs: 160, durationMs: ms(D.sm), ease: OUT },
      { target: 'hero-body', to: { y: 0 }, atMs: 160, durationMs: ms(D.sm), ease: OUT },
      { target: 'hero-seal', to: { y: 0, rotate: 0 }, atMs: 420, durationMs: ms(D.sm), ease: OUT },
      { target: 'hero-actions', to: { y: 0 }, atMs: 560, durationMs: ms(D.xs), ease: OUT },
    ],
  }),
);

/** World story tile resolves once as the section arrives. */
const worldEntrance = compileMotion(
  defineMotion({
    id: 'w01.world.enter',
    initial: { 'world-story': { opacity: 0, y: Y.reveal } },
    tracks: [{ target: 'world-story', to: { opacity: 1, y: 0 }, durationMs: ms(D.md), ease: OUT }],
  }),
);

/**
 * World parallax (spatial context): the two photographs' image layers drift
 * inside fixed frames at two rates, vertical only, transform only. The layer
 * overhangs its frame by `parallax.max` (WorldSection.tsx), so neither rate
 * can show an edge. The frames themselves never move, so the grid holds.
 */
const worldDrift = compileMotion(
  defineMotion({
    id: 'w01.world.drift',
    initial: {
      'world-a': { yPercent: P.mid },
      'world-b': { yPercent: P.near },
    },
    tracks: [
      { target: 'world-a', to: { yPercent: -P.mid }, durationMs: SPAN_MS, ease: LINEAR },
      { target: 'world-b', to: { yPercent: -P.near }, durationMs: SPAN_MS, ease: LINEAR },
    ],
  }),
);

/**
 * H-Lynk (PS-018): one entrance, played once, never scrubbed. The stage is
 * not a target: the three.js scene owns the object's motion (settle, turn,
 * scanner flare, screen on), so ScrollTrigger and the render loop never both
 * move it. The name block lands first; the two proof rows follow while the
 * object finishes its turn, and all copy is in place by ~1.9 s.
 */
const hlynkReveal = compileMotion(
  defineMotion({
    id: 'w01.hlynk.reveal',
    initial: {
      'hlynk-head': { opacity: 0, y: Y.reveal },
      'hlynk-proof-0': { opacity: 0, y: Y.step },
      'hlynk-proof-1': { opacity: 0, y: Y.step },
    },
    tracks: [
      { target: 'hlynk-head', to: { opacity: 1, y: 0 }, atMs: 200, durationMs: ms(D.sm), ease: OUT },
      { target: 'hlynk-proof-0', to: { opacity: 1, y: 0 }, atMs: 1100, durationMs: ms(D.xs), ease: OUT },
      { target: 'hlynk-proof-1', to: { opacity: 1, y: 0 }, atMs: 1400, durationMs: ms(D.xs), ease: OUT },
    ],
  }),
);

/** Starters: header, then the three cards as a staggered first-entrance. */
const startersEntrance = compileMotion(
  defineMotion({
    id: 'w01.starters.enter',
    initial: {
      'starters-head': { opacity: 0, y: Y.reveal },
      'starter-0': { opacity: 0, y: Y.rise },
      'starter-1': { opacity: 0, y: Y.rise },
      'starter-2': { opacity: 0, y: Y.rise },
    },
    tracks: [
      { target: 'starters-head', to: { opacity: 1, y: 0 }, atMs: 0, durationMs: ms(D.sm), ease: OUT },
      { target: 'starter-0', to: { opacity: 1, y: 0 }, atMs: 160, durationMs: ms(D.sm), ease: OUT },
      { target: 'starter-1', to: { opacity: 1, y: 0 }, atMs: 300, durationMs: ms(D.sm), ease: OUT },
      { target: 'starter-2', to: { opacity: 1, y: 0 }, atMs: 440, durationMs: ms(D.sm), ease: OUT },
    ],
  }),
);

/** Care: the readout arrives once; meters stay live data, not decoration. */
const careEntrance = compileMotion(
  defineMotion({
    id: 'w01.care.enter',
    initial: {
      'care-head': { opacity: 0, y: Y.reveal },
      'care-readout': { opacity: 0, y: Y.rise },
    },
    tracks: [
      { target: 'care-head', to: { opacity: 1, y: 0 }, atMs: 0, durationMs: ms(D.sm), ease: OUT },
      { target: 'care-readout', to: { opacity: 1, y: 0 }, atMs: 160, durationMs: ms(D.sm), ease: OUT },
    ],
  }),
);

/** Hatch: quiet and slow — the room dims before the words land. */
const hatchReveal = compileMotion(
  defineMotion({
    id: 'w01.hatch.reveal',
    initial: {
      'hatch-art': { opacity: 0, scale: S.enter },
      'hatch-copy': { opacity: 0, y: Y.rise },
      'hatch-cta': { opacity: 0, y: Y.step },
    },
    tracks: [
      { target: 'hatch-art', to: { opacity: 1, scale: 1 }, atMs: 0, durationMs: ms(D.xl), ease: OUT },
      { target: 'hatch-copy', to: { opacity: 1, y: 0 }, atMs: 320, durationMs: ms(D.md), ease: OUT },
      { target: 'hatch-cta', to: { opacity: 1, y: 0 }, atMs: 640, durationMs: ms(D.sm), ease: OUT },
    ],
  }),
);

// ---------------------------------------------------------------------------

const DESKTOP = `(min-width: ${breakpoints.md})`;

/**
 * All W01 choreography, bound once for the home page. Marker ids are unique
 * to W01 sections, so the document is a safe query scope. Runs inside the
 * Kinetrell ReactLenis tree so ScrollTrigger and Lenis share the external
 * clock wired by `connectGsapLenis`.
 */
export function useHomeMotion() {
  useGSAP(
    () => {
      if (!ensureScrollTrigger()) return;
      const scope: ParentNode = document;
      const armedHost = document.documentElement;
      armedHost.classList.add(ARMED_CLASS);
      const { fades, scrubs, triggers } = collectTargets(scope);
      const all = { ...fades, ...scrubs };

      // Hero entrance — authored load sequence, plays once, no trigger. Hero
      // markers are never pre-hidden (see globals.css): the hero is the LCP
      // surface, so on a slow bind the static composition stays instead of a
      // flash-and-replay. Only replay the entrance when hydration was fast.
      if (bindable(heroEntrance, fades) && performance.now() < 1800) {
        createGsapTimeline(heroEntrance, fades).play();
      }

      // World header reveal + image parallax.
      if (triggers.world && bindable(worldEntrance, all)) {
        attachScrollTrigger(createGsapTimeline(worldEntrance, all), {
          trigger: triggers.world,
          start: 'top 78%',
        });
      }
      // gsap.matchMedia binds the drift when the desktop query starts matching
      // and reverts it when it stops, so a resize or rotation across md follows.
      const media = gsap.matchMedia();
      if (triggers.world && bindable(worldDrift, all)) {
        const world = triggers.world;
        media.add(DESKTOP, () => {
          attachScrollTrigger(createGsapTimeline(worldDrift, all), {
            trigger: world,
            start: 'top bottom',
            end: 'bottom top',
            scrub: SCRUB.loose,
          });
        });
      }

      // H-Lynk — copy entrance once; the object's motion lives in the scene (PS-018).
      if (triggers.hlynk && bindable(hlynkReveal, all)) {
        attachScrollTrigger(createGsapTimeline(hlynkReveal, all), {
          trigger: triggers.hlynk,
          start: 'top 70%',
        });
      }

      // Starters + care — one entrance each.
      if (triggers.starters && bindable(startersEntrance, all)) {
        attachScrollTrigger(createGsapTimeline(startersEntrance, all), {
          trigger: triggers.starters,
          start: 'top 78%',
        });
      }
      if (triggers.care && bindable(careEntrance, all)) {
        attachScrollTrigger(createGsapTimeline(careEntrance, all), {
          trigger: triggers.care,
          start: 'top 80%',
        });
      }

      // Hatch — the quiet climax.
      if (triggers.hatch && bindable(hatchReveal, all)) {
        attachScrollTrigger(createGsapTimeline(hatchReveal, all), {
          trigger: triggers.hatch,
          start: 'top 72%',
        });
      }

      return () => {
        media.revert();
        armedHost.classList.remove(ARMED_CLASS);
      };
    },
  );
}
