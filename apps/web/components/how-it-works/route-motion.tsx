'use client';
/**
 * The motion boundary for the product site's inner routes (/how-it-works,
 * /get). It is the home page's system (components/home/MotionRoot.tsx and
 * motion.ts) with the route's own choreography plugged in:
 *
 * - one frame clock: `gsap.ticker`. Lenis runs with `autoRaf: false` and
 *   `connectGsapLenis` (clock `'kinetrell'`) adds `lenis.raf` to the ticker,
 *   so there is never a second RAF loop;
 * - the same marker ids (`mfx-` fade target, `mpx-` transform-only target,
 *   `trg-` ScrollTrigger anchor), parsed by home's `motion-markers.ts`;
 * - timelines are Kinetrell `defineMotion` documents bound with
 *   `createGsapTimeline` + `attachScrollTrigger`.
 *
 * Each route loads this through its own `next/dynamic` island with
 * `ssr: false`, after hydration. Reduced motion mounts nothing: no Lenis, no
 * timelines, and every marked element stays as the server drew it, at rest
 * and visible. Without JavaScript the same is true.
 */
import { useEffect } from 'react';
// The inner routes run the home page's Kinetrell system (creator direction, 2026-10-13); the rule's
// ignore list names components/home/motion.ts only, so the adapter imports are allowed here.
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import type { CompiledMotion } from 'kinetrell/core';
import { attachScrollTrigger, createGsapTimeline, ensureScrollTrigger, type GsapTargetMap } from 'kinetrell/web/gsap';
import { ReactLenis, useKinetrellLenis } from 'kinetrell/web/lenis';
import { connectGsapLenis } from 'kinetrell/web/gsap-lenis';
import { useBrowserReducedMotion } from 'kinetrell/web/react';
import { pageMotion } from '@acme/theme';
import { MOTION_MARKER_SELECTOR, parseMotionMarker } from '../home/motion-markers';

export const ms = (seconds: number) => Math.round(seconds * 1000);
export const { duration: D, distance: Y, scale: S } = pageMotion;
export const OUT = pageMotion.ease.out.gsap;
export const LINEAR = pageMotion.ease.scrub.gsap;
/** A scrubbed track spans the whole trigger range; ScrollTrigger maps it to scroll. */
export const SPAN_MS = 1000;
/** Same as home: an entrance fires as a section's top clears the bottom tenth of the view. */
export const REVEAL_START = 'top 90%';

export interface RouteTargets {
  /** `mfx-` and `mpx-` elements by name. */
  all: GsapTargetMap;
  /** `trg-` section anchors by name. */
  triggers: Record<string, Element>;
}

/** The marked elements on the page, by marker name. */
export function collectTargets(root: ParentNode): RouteTargets {
  const all: Record<string, gsap.TweenTarget> = {};
  const triggers: Record<string, Element> = {};
  for (const el of root.querySelectorAll<HTMLElement>(MOTION_MARKER_SELECTOR)) {
    const marker = parseMotionMarker(el.id);
    if (!marker) continue;
    if (marker.kind === 'trigger') triggers[marker.name] = el;
    else all[marker.name] = el;
  }
  return { all, triggers };
}

/** A motion only binds if every target it names exists; logs the missing ids in dev. */
export function bindable(motion: CompiledMotion, map: GsapTargetMap): boolean {
  const ids = new Set([...motion.tracks.map((t) => t.target), ...Object.keys(motion.initial)]);
  const missing = [...ids].filter((id) => !(id in map));
  if (missing.length && process.env.NODE_ENV !== 'production') {
    console.warn(`[kinetrell] ${motion.id}: missing targets ${missing.join(', ')} - skipped`);
  }
  return missing.length === 0;
}

/** Binds a route's choreography; returns the names of the targets it bound. */
export type RouteBinder = (targets: RouteTargets, media: gsap.MatchMedia) => Iterable<string>;

/** Same class as home (globals.css pre-hides `mfx-*` under it, hero markers excepted). */
const ARMED_CLASS = 'motion-armed';

/** Binds one entrance to a section anchor; returns the target names it drives, or none if it could not bind. */
export function reveal(
  motion: CompiledMotion,
  all: GsapTargetMap,
  trigger: Element | undefined,
  config: Omit<Parameters<typeof attachScrollTrigger>[1], 'trigger'> = { start: REVEAL_START },
): string[] {
  if (!trigger || !bindable(motion, all)) return [];
  attachScrollTrigger(createGsapTimeline(motion, all), { trigger, ...config });
  return Object.keys(motion.initial);
}

/** Bridges the ReactLenis instance to ScrollTrigger once it exists. */
function GsapLenisBridge() {
  const lenis = useKinetrellLenis();
  useEffect(() => {
    if (!lenis) return;
    return connectGsapLenis(lenis, { clock: 'kinetrell', refreshOnConnect: true });
  }, [lenis]);
  return null;
}

function MotionFrame({ bind }: { bind: RouteBinder }) {
  useGSAP(() => {
    if (!ensureScrollTrigger()) return;
    const root = document.documentElement;
    root.classList.add(ARMED_CLASS);
    const media = gsap.matchMedia();
    const targets = collectTargets(document);
    const bound = new Set(bind(targets, media));
    // A fade target no motion took (a missing sibling, a renamed id) must not stay pre-hidden.
    for (const [name, el] of Object.entries(targets.all)) {
      if (!bound.has(name)) gsap.set(el, { opacity: 1 });
    }
    return () => {
      media.revert();
      root.classList.remove(ARMED_CLASS);
    };
  });
  return null;
}

/**
 * Renders nothing. Under reduced motion it mounts nothing at all, so the page
 * keeps native scroll and its static composition.
 */
export function RouteMotionRoot({ bind }: { bind: RouteBinder }) {
  const reduced = useBrowserReducedMotion();
  if (reduced) return null;
  return (
    <ReactLenis root options={{ autoRaf: false }}>
      <GsapLenisBridge />
      <MotionFrame bind={bind} />
    </ReactLenis>
  );
}
