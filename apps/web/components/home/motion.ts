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
 *   ids in MAGNETIC_TARGETS get a ≤6px pointer-fine magnetic pull (CTAs).
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
import { MOTION_MARKER_SELECTOR, parseMotionMarker } from './motion-markers';

export const ARMED_CLASS = 'motion-armed';

/** Elements that get the small pointer-fine pull — the page's two CTAs. */
const MAGNETIC_TARGETS = ['mfx-hero-cta', 'mfx-hatch-cta'] as const;

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
 * Hero load: city art settles → headline resolves → seal stamps → CTA follows.
 * Transform-only on purpose: the hero holds the LCP surface, so no element
 * here ever goes transparent — a late hydration bind shifts geometry, never
 * paint timing (see globals.css: hero markers are excluded from the pre-hide).
 */
const heroEntrance = compileMotion(
  defineMotion({
    id: 'w01.hero.enter',
    initial: {
      'hero-art': { y: 24, scale: 1.045 },
      'hero-seal': { y: 18, rotate: -2 },
      'hero-eyebrow': { y: 10 },
      'hero-title': { y: 34 },
      'hero-body': { y: 20 },
      'hero-starters': { y: 8 },
      'hero-cta': { y: 14 },
      'hero-districts': { y: 12 },
    },
    tracks: [
      { target: 'hero-art', to: { y: 0, scale: 1 }, atMs: 0, durationMs: 950, ease: 'power2.out' },
      { target: 'hero-eyebrow', to: { y: 0 }, atMs: 140, durationMs: 420, ease: 'power2.out' },
      { target: 'hero-title', to: { y: 0 }, atMs: 240, durationMs: 640, ease: 'power2.out' },
      { target: 'hero-body', to: { y: 0 }, atMs: 360, durationMs: 560, ease: 'power2.out' },
      { target: 'hero-seal', to: { y: 0, rotate: 0 }, atMs: 400, durationMs: 620, ease: 'power2.out' },
      { target: 'hero-starters', to: { y: 0 }, atMs: 500, durationMs: 480, ease: 'power2.out' },
      { target: 'hero-cta', to: { y: 0 }, atMs: 580, durationMs: 480, ease: 'power2.out' },
      { target: 'hero-districts', to: { y: 0 }, atMs: 680, durationMs: 480, ease: 'power2.out' },
    ],
  }),
);

/** Hero scroll-out: the plate and the art cluster drift at different rates. */
const heroDrift = compileMotion(
  defineMotion({
    id: 'w01.hero.drift',
    initial: { 'hero-cluster': { yPercent: 0 }, 'hero-panel': { yPercent: 0 } },
    tracks: [
      { target: 'hero-cluster', to: { yPercent: -9 }, durationMs: 1000, ease: 'linear' },
      { target: 'hero-panel', to: { yPercent: -4 }, durationMs: 1000, ease: 'linear' },
    ],
  }),
);

/** World header reveal on entry. */
const worldEntrance = compileMotion(
  defineMotion({
    id: 'w01.world.enter',
    initial: { 'world-head': { opacity: 0, y: 26 } },
    tracks: [{ target: 'world-head', to: { opacity: 1, y: 0 }, durationMs: 700, ease: 'power2.out' }],
  }),
);

/**
 * World parallax: four frames at four rates, all vertical, transform only.
 * Smaller frames travel further — depth comes from rate difference, never
 * from lateral movement.
 */
const worldDrift = compileMotion(
  defineMotion({
    id: 'w01.world.drift',
    initial: {
      'world-a': { yPercent: 3 },
      'world-b': { yPercent: 7 },
      'world-c': { yPercent: 5 },
      'world-d': { yPercent: 9 },
    },
    tracks: [
      { target: 'world-a', to: { yPercent: -3 }, durationMs: 1000, ease: 'linear' },
      { target: 'world-b', to: { yPercent: -6 }, durationMs: 1000, ease: 'linear' },
      { target: 'world-c', to: { yPercent: -4 }, durationMs: 1000, ease: 'linear' },
      { target: 'world-d', to: { yPercent: -7 }, durationMs: 1000, ease: 'linear' },
    ],
  }),
);

/** H-Lynk reveal: device settles into place, scan line sweeps, lines resolve. */
const hlynkReveal = compileMotion(
  defineMotion({
    id: 'w01.hlynk.reveal',
    initial: {
      'hlynk-copy': { opacity: 0, y: 24 },
      'hlynk-device': { opacity: 0, y: 56, rotationY: 8, transformPerspective: 800, scale: 0.97 },
      'hlynk-scan': { opacity: 0, scaleX: 0 },
      'hlynk-feat-0': { opacity: 0, y: 16 },
      'hlynk-feat-1': { opacity: 0, y: 16 },
      'hlynk-feat-2': { opacity: 0, y: 16 },
    },
    tracks: [
      { target: 'hlynk-copy', to: { opacity: 1, y: 0 }, atMs: 0, durationMs: 620, ease: 'power2.out' },
      {
        target: 'hlynk-device',
        to: { opacity: 1, y: 0, rotationY: 0, scale: 1 },
        atMs: 120,
        durationMs: 900,
        ease: 'power2.out',
      },
      { target: 'hlynk-scan', to: { opacity: 1, scaleX: 1 }, atMs: 780, durationMs: 420, ease: 'power2.inOut' },
      { target: 'hlynk-feat-0', to: { opacity: 1, y: 0 }, atMs: 420, durationMs: 440, ease: 'power2.out' },
      { target: 'hlynk-feat-1', to: { opacity: 1, y: 0 }, atMs: 540, durationMs: 440, ease: 'power2.out' },
      { target: 'hlynk-feat-2', to: { opacity: 1, y: 0 }, atMs: 660, durationMs: 440, ease: 'power2.out' },
    ],
  }),
);

/** Starters: header, then the three cards as a staggered first-entrance. */
const startersEntrance = compileMotion(
  defineMotion({
    id: 'w01.starters.enter',
    initial: {
      'starters-head': { opacity: 0, y: 26 },
      'starter-0': { opacity: 0, y: 40 },
      'starter-1': { opacity: 0, y: 40 },
      'starter-2': { opacity: 0, y: 40 },
    },
    tracks: [
      { target: 'starters-head', to: { opacity: 1, y: 0 }, atMs: 0, durationMs: 620, ease: 'power2.out' },
      { target: 'starter-0', to: { opacity: 1, y: 0 }, atMs: 160, durationMs: 620, ease: 'power2.out' },
      { target: 'starter-1', to: { opacity: 1, y: 0 }, atMs: 300, durationMs: 620, ease: 'power2.out' },
      { target: 'starter-2', to: { opacity: 1, y: 0 }, atMs: 440, durationMs: 620, ease: 'power2.out' },
    ],
  }),
);

/** Care: the readout arrives once; meters stay live data, not decoration. */
const careEntrance = compileMotion(
  defineMotion({
    id: 'w01.care.enter',
    initial: {
      'care-head': { opacity: 0, y: 24 },
      'care-readout': { opacity: 0, y: 30 },
    },
    tracks: [
      { target: 'care-head', to: { opacity: 1, y: 0 }, atMs: 0, durationMs: 620, ease: 'power2.out' },
      { target: 'care-readout', to: { opacity: 1, y: 0 }, atMs: 160, durationMs: 680, ease: 'power2.out' },
    ],
  }),
);

/** Hatch: quiet and slow — the room dims before the words land. */
const hatchReveal = compileMotion(
  defineMotion({
    id: 'w01.hatch.reveal',
    initial: {
      'hatch-art': { opacity: 0, scale: 1.06 },
      'hatch-copy': { opacity: 0, y: 30 },
      'hatch-cta': { opacity: 0, y: 16 },
    },
    tracks: [
      { target: 'hatch-art', to: { opacity: 1, scale: 1 }, atMs: 0, durationMs: 1300, ease: 'power2.out' },
      { target: 'hatch-copy', to: { opacity: 1, y: 0 }, atMs: 320, durationMs: 720, ease: 'power2.out' },
      { target: 'hatch-cta', to: { opacity: 1, y: 0 }, atMs: 640, durationMs: 560, ease: 'power2.out' },
    ],
  }),
);

// ---------------------------------------------------------------------------

const DESKTOP = '(min-width: 768px)';
const FINE_POINTER = '(pointer: fine)';

/** ≤6px pull toward the pointer on desktop CTAs. Native geometry untouched. */
function armMagnets(root: ParentNode): () => void {
  if (!window.matchMedia(FINE_POINTER).matches) return () => {};
  const off: Array<() => void> = [];
  for (const id of MAGNETIC_TARGETS) {
    const el = root.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    if (!el) continue;
    const moveX = gsap.quickTo(el, 'x', { duration: 0.25, ease: 'power2.out' });
    const moveY = gsap.quickTo(el, 'y', { duration: 0.25, ease: 'power2.out' });
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      moveX(gsap.utils.clamp(-6, 6, (e.clientX - (r.left + r.width / 2)) * 0.18));
      moveY(gsap.utils.clamp(-6, 6, (e.clientY - (r.top + r.height / 2)) * 0.18));
    };
    const onLeave = () => {
      moveX(0);
      moveY(0);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    off.push(() => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    });
  }
  return () => off.forEach((fn) => fn());
}

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
      const desktop = window.matchMedia(DESKTOP).matches;

      // Hero entrance — authored load sequence, plays once, no trigger. Hero
      // markers are never pre-hidden (see globals.css): the hero is the LCP
      // surface, so on a slow bind the static composition stays instead of a
      // flash-and-replay. Only replay the entrance when hydration was fast.
      if (bindable(heroEntrance, fades) && performance.now() < 1800) {
        createGsapTimeline(heroEntrance, fades).play();
      }

      // Hero scroll-out depth — desktop only.
      if (desktop && triggers.hero && bindable(heroDrift, all)) {
        attachScrollTrigger(createGsapTimeline(heroDrift, all), {
          trigger: triggers.hero,
          start: 'top top',
          end: 'bottom top',
          scrub: 0.6,
        });
      }

      // World header reveal + image parallax.
      if (triggers.world && bindable(worldEntrance, all)) {
        attachScrollTrigger(createGsapTimeline(worldEntrance, all), {
          trigger: triggers.world,
          start: 'top 78%',
        });
      }
      if (desktop && triggers.world && bindable(worldDrift, all)) {
        attachScrollTrigger(createGsapTimeline(worldDrift, all), {
          trigger: triggers.world,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.8,
        });
      }

      // H-Lynk device reveal — scrubbed so the hardware settles with scroll.
      if (triggers.hlynk && bindable(hlynkReveal, all)) {
        attachScrollTrigger(createGsapTimeline(hlynkReveal, all), {
          trigger: triggers.hlynk,
          start: 'top 82%',
          end: 'center 55%',
          scrub: 0.5,
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

      const offMagnets = armMagnets(scope);
      return () => {
        offMagnets();
        armedHost.classList.remove(ARMED_CLASS);
      };
    },
  );
}
