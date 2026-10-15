'use client';
/**
 * Kinetrell choreography for the editorial routes (/story, /city). Same
 * contract as the home layer (components/home/motion.ts): targets are marked
 * by `id` prefix (`mfx-` fade, `mpx-` transform-only, `trg-` section anchor),
 * timelines are Kinetrell `defineMotion` documents bound with
 * `createGsapTimeline` + `attachScrollTrigger`, and the one frame clock is the
 * GSAP ticker that RouteMotionFrame wires Lenis into.
 *
 * What this module adds is a generic binder, so a route marks its markup and
 * gets authored beats without a hand-written timeline per section:
 *   - every `mfx-*` inside a `trg-*` section resolves once, in DOM order, on a
 *     fixed stagger as the section arrives;
 *   - every `mpx-*-drift` image layer drifts inside its frame on desktop;
 *   - `mfx-hero-*` is the route's load beat: transform-only, never pre-hidden
 *     (globals.css), because the hero holds the LCP image.
 * A route's one standout moment (the /story pinned chapter, the /city board
 * flip) is passed in as `special` and binds against the same target maps.
 *
 * Reduced motion never reaches this file: the frame renders nothing, the
 * `motion-armed` class is never set, and every target stays at rest.
 */
import { useGSAP } from '@gsap/react';
import { createMediaScope, showUnbound, type MediaScope } from '../../lib/media-scope';
import { compileMotion, defineMotion, type CompiledMotion } from 'kinetrell/core';
import { attachScrollTrigger, createGsapTimeline, ensureScrollTrigger, type GsapTargetMap } from 'kinetrell/web/gsap';
import { breakpoints, pageMotion } from '@acme/theme';
import { MOTION_MARKER_SELECTOR, parseMotionMarker } from '../home/motion-markers';

const { duration: D, ease: E, distance: Y, parallax: P, scale: S, scrub: SCRUB } = pageMotion;
export const ms = (seconds: number) => Math.round(seconds * 1000);
export const OUT = E.out.gsap;
export const LINEAR = E.scrub.gsap;
/** A scrubbed track spans the whole trigger range; ScrollTrigger maps it to scroll. */
export const SPAN_MS = 1000;
export const DESKTOP = `(min-width: ${breakpoints.md})`;
/** Same entrance point as the home page: the section's top clears the bottom tenth. */
export const REVEAL_START = 'top 90%';
/** Gap between beats inside one section: tight enough that no copy waits on a long chain. */
const STAGGER_MS = 90;
const MAX_STAGGER_MS = 420;

const ARMED_CLASS = 'motion-armed';

export interface RouteTargets {
  fades: Record<string, HTMLElement>;
  scrubs: Record<string, HTMLElement>;
  triggers: Record<string, HTMLElement>;
  /** Desktop/phone media scopes; reverted with the page. */
  media: MediaScope;
}

/** A motion binds only when every named target exists; logs the missing ids in dev. */
export function bindable(motion: CompiledMotion, map: GsapTargetMap): boolean {
  const ids = new Set([...motion.tracks.map((t) => t.target), ...Object.keys(motion.initial)]);
  const missing = [...ids].filter((id) => !(id in map));
  if (missing.length && process.env.NODE_ENV !== 'production') {
    console.warn(`[kinetrell] ${motion.id}: missing targets ${missing.join(', ')}; skipped`);
  }
  return missing.length === 0;
}

function collect(): Omit<RouteTargets, 'media'> {
  const fades: Record<string, HTMLElement> = {};
  const scrubs: Record<string, HTMLElement> = {};
  const triggers: Record<string, HTMLElement> = {};
  for (const el of document.querySelectorAll<HTMLElement>(MOTION_MARKER_SELECTOR)) {
    const marker = parseMotionMarker(el.id);
    if (!marker) continue;
    if (marker.kind === 'fade') fades[marker.name] = el;
    else if (marker.kind === 'scrub') scrubs[marker.name] = el;
    else triggers[marker.name] = el;
  }
  return { fades, scrubs, triggers };
}

/** One section's reveal: each fade target rises into place on a short stagger. */
function sectionReveal(section: string, names: readonly string[]): CompiledMotion {
  return compileMotion(
    defineMotion({
      id: `route.${section}.reveal`,
      initial: Object.fromEntries(names.map((n) => [n, { opacity: 0, y: Y.reveal }])),
      tracks: names.map((n, i) => ({
        target: n,
        to: { opacity: 1, y: 0 },
        atMs: Math.min(i * STAGGER_MS, MAX_STAGGER_MS),
        durationMs: ms(i === 0 ? D.sm : D.xs),
        ease: OUT,
      })),
    }),
  );
}

/** The image layer drifts inside its fixed frame; the layer overhangs by `parallax.max`. */
function drift(name: string, rate: number): CompiledMotion {
  return compileMotion(
    defineMotion({
      id: `route.${name}`,
      initial: { [name]: { yPercent: rate } },
      tracks: [{ target: name, to: { yPercent: -rate }, durationMs: SPAN_MS, ease: LINEAR }],
    }),
  );
}

/** The hero's load beat, transform-only (the hero holds the LCP image). */
function heroEntrance(names: readonly string[]): CompiledMotion {
  return compileMotion(
    defineMotion({
      id: 'route.hero.enter',
      initial: Object.fromEntries(
        names.map((n): [string, Record<string, number>] => [n, n.endsWith('art') ? { y: Y.reveal, scale: S.enter } : { y: Y.rise }]),
      ),
      tracks: names.map((n, i) => ({
        target: n,
        to: (n.endsWith('art') ? { y: 0, scale: 1 } : { y: 0 }) as Record<string, number>,
        atMs: n.endsWith('art') ? 0 : 120 + i * 80,
        durationMs: ms(n.endsWith('art') ? D.lg : D.sm),
        ease: OUT,
      })),
    }),
  );
}

const DRIFT_RATES = [P.mid, P.near, P.far] as const;

/**
 * Binds the route's choreography once. `special` receives the same target
 * maps for the route's one authored moment; names it consumes must use the
 * `mpx-` prefix so the generic reveal leaves them alone.
 */
export function useRouteMotion(special?: (targets: RouteTargets) => void) {
  useGSAP(() => {
    if (!ensureScrollTrigger()) return;
    const host = document.documentElement;
    host.classList.add(ARMED_CLASS);
    const { fades, scrubs, triggers } = collect();
    const media = createMediaScope();

    // Group every fade by the section anchor it sits in, in DOM order.
    const groups = new Map<string, string[]>();
    const orphans: HTMLElement[] = [];
    const hero: string[] = [];
    for (const [name, el] of Object.entries(fades)) {
      if (name.startsWith('hero-')) {
        hero.push(name);
        continue;
      }
      const section = el.closest<HTMLElement>('[id^="trg-"]');
      const marker = section ? parseMotionMarker(section.id) : null;
      if (!marker) {
        orphans.push(el);
        continue;
      }
      groups.set(marker.name, [...(groups.get(marker.name) ?? []), name]);
    }
    // Nothing marked may stay hidden: a fade outside any section just shows.
    showUnbound(orphans);

    if (hero.length && performance.now() < 1800) {
      const enter = heroEntrance(hero);
      if (bindable(enter, fades)) createGsapTimeline(enter, fades).play();
    }

    for (const [section, names] of groups) {
      const trigger = triggers[section];
      if (!trigger) continue;
      const motion = sectionReveal(section, names);
      if (bindable(motion, fades)) {
        attachScrollTrigger(createGsapTimeline(motion, fades), { trigger, start: REVEAL_START });
      }
    }

    // Photo parallax, desktop only (bound for the viewport the page mounts in).
    const drifts = Object.keys(scrubs).filter((n) => n.endsWith('-drift'));
    media.add(DESKTOP, () => {
      drifts.forEach((name, i) => {
        const frame = scrubs[name]?.parentElement;
        if (!frame) return;
        const motion = drift(name, DRIFT_RATES[i % DRIFT_RATES.length]!);
        attachScrollTrigger(createGsapTimeline(motion, scrubs), {
          trigger: frame,
          start: 'top bottom',
          end: 'bottom top',
          scrub: SCRUB.loose,
        });
      });
    });

    special?.({ fades, scrubs, triggers, media });

    return () => {
      media.revert();
      host.classList.remove(ARMED_CLASS);
    };
  });
}
