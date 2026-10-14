'use client';
/**
 * The W02 (/mons, /mons/[slug]) motion layer. Same system as the home page
 * (../home/motion.ts, spec docs/design/site/PREMIUM_SITE_MOTION.md): Kinetrell
 * `defineMotion` documents bound with `createGsapTimeline` +
 * `attachScrollTrigger`, on the one GSAP ticker that MonsMotionRoot shares
 * with Lenis. Targeting is by id prefix (../home/motion-markers.ts):
 *
 *   `trg-<beat>`               a beat's ScrollTrigger anchor (a section or a bento row)
 *   `mfx-<beat>-<part>`        an entrance target of that beat, pre-hidden while armed
 *   `mfx-hero-<part>`          an above-the-fold target: transform only, never pre-hidden
 *   `mpx-<beat>-<part>-<rate>` a scrubbed drift inside a fixed frame (`near`, `mid`, `far`, `max`)
 *
 * The beats are read from the page, not listed here, so the roster and the
 * Mon pages share one binder: every `mfx-<beat>-*` under a `trg-<beat>` plays
 * as one staggered entrance in DOM order. The part name picks the move:
 * `dex` slides in from behind the portrait (the roster's standout), `portrait`
 * rises and settles from slightly large, everything else rises.
 *
 * Reduced motion never reaches this file: MonsMotionRoot renders nothing, the
 * page root is never armed, and every target stays at rest and visible. With
 * no JavaScript the same is true.
 */
// The W02 routes run the home page's Kinetrell system (creator direction, 2026-10-13); the rule's
// ignore list names components/home/motion.ts only, so the two adapter imports are allowed here.
import { useGSAP } from '@gsap/react';
import { createMediaScope } from '../../lib/media-scope';
import { compileMotion, defineMotion, type CompiledMotion } from 'kinetrell/core';
import { attachScrollTrigger, createGsapTimeline, ensureScrollTrigger, type GsapTargetMap } from 'kinetrell/web/gsap';
import { breakpoints, pageMotion } from '@acme/theme';
import { MOTION_MARKER_SELECTOR, parseMotionMarker } from '../home/motion-markers';

const { duration: D, ease: E, distance: Y, parallax: P, scale: S, scrub: SCRUB } = pageMotion;
const ms = (seconds: number) => Math.round(seconds * 1000);
const OUT = E.out.gsap;
const LINEAR = E.scrub.gsap;
const SPAN_MS = 1000;
/** Gap between two entrances of one beat. Five parts finish inside 300 ms of the first (Phase 7 critique). */
const STAGGER_MS = 70;
/** How far a giant Dex number travels out from behind its portrait, as a share of its own width. */
const DEX_SLIDE = 28;
const REVEAL_START = 'top 85%';
const DESKTOP = `(min-width: ${breakpoints.md})`;
const RATES = { near: P.near, mid: P.mid, far: P.far, max: P.max } as const;

export const ARMED_CLASS = 'motion-armed';

type Move = { from: Record<string, number>; to: Record<string, number>; durationMs: number };

function moveFor(part: string): Move {
  if (part.endsWith('dex')) return { from: { opacity: 0, xPercent: -DEX_SLIDE }, to: { opacity: 1, xPercent: 0 }, durationMs: ms(D.lg) };
  if (part.endsWith('portrait')) return { from: { opacity: 0, y: Y.rise, scale: S.enter }, to: { opacity: 1, y: 0, scale: 1 }, durationMs: ms(D.md) };
  return { from: { opacity: 0, y: Y.reveal }, to: { opacity: 1, y: 0 }, durationMs: ms(D.sm) };
}

/** One beat's entrance: its parts in DOM order, staggered. */
function entrance(beat: string, parts: readonly string[]): CompiledMotion {
  const initial: Record<string, Record<string, number>> = {};
  // The number sits before its portrait in the DOM (it paints behind it), but
  // it moves second: it slides out from behind a portrait that is already there.
  const dex = parts.filter((n) => n.endsWith('dex'));
  const ordered = parts.filter((n) => !n.endsWith('dex'));
  ordered.splice(ordered.findIndex((n) => n.endsWith('portrait')) + 1, 0, ...dex);
  const tracks = ordered.map((name, i) => {
    const move = moveFor(name);
    initial[name] = move.from;
    return { target: name, to: move.to, atMs: i * STAGGER_MS, durationMs: move.durationMs, ease: OUT };
  });
  return compileMotion(defineMotion({ id: `w02.${beat}.enter`, initial, tracks }));
}

/** Transform-only load beat for the above-the-fold markers: nothing goes transparent. */
function heroEntrance(parts: readonly string[]): CompiledMotion {
  const initial: Record<string, Record<string, number>> = {};
  const tracks = parts.map((name, i) => {
    const art = name.endsWith('portrait') || name.endsWith('art');
    initial[name] = art ? { y: Y.reveal, scale: S.enter } : { y: Y.step };
    const to: Record<string, number> = art ? { y: 0, scale: 1 } : { y: 0 };
    return { target: name, to, atMs: art ? 0 : 120 + i * STAGGER_MS, durationMs: ms(art ? D.lg : D.sm), ease: OUT };
  });
  return compileMotion(defineMotion({ id: 'w02.hero.enter', initial, tracks }));
}

/** A scrubbed drift: `rate` from the marker name; `-rev` drifts the other way. */
function drift(name: string): CompiledMotion | null {
  const match = /-(near|mid|far|max)(-rev)?$/.exec(name);
  if (!match) return null;
  const amount = RATES[match[1] as keyof typeof RATES] * (match[2] ? -1 : 1);
  return compileMotion(
    defineMotion({
      id: `w02.${name}.drift`,
      initial: { [name]: { yPercent: amount } },
      tracks: [{ target: name, to: { yPercent: -amount }, durationMs: SPAN_MS, ease: LINEAR }],
    }),
  );
}

/** The beat a marker belongs to: the longest trigger name its own name starts with. */
function beatOf(name: string, beats: readonly string[]): string | undefined {
  return beats.filter((b) => name.startsWith(`${b}-`)).sort((a, b) => b.length - a.length)[0];
}

/**
 * Binds every W02 beat on the page once. Runs inside MonsMotionRoot's
 * ReactLenis tree, so ScrollTrigger and Lenis share the GSAP ticker.
 */
export function useMonsMotion() {
  useGSAP(() => {
    if (!ensureScrollTrigger()) return;
    const host = document.documentElement;
    host.classList.add(ARMED_CLASS);

    const fades: Record<string, Element> = {};
    const fadeOrder: string[] = [];
    const scrubs: Record<string, Element> = {};
    const triggers: Record<string, Element> = {};
    for (const el of document.querySelectorAll<HTMLElement>(MOTION_MARKER_SELECTOR)) {
      const marker = parseMotionMarker(el.id);
      if (!marker) continue;
      if (marker.kind === 'fade') {
        fades[marker.name] = el;
        fadeOrder.push(marker.name);
      } else if (marker.kind === 'scrub') scrubs[marker.name] = el;
      else triggers[marker.name] = el;
    }
    const beats = Object.keys(triggers);

    // Above the fold: one composed load beat, only when hydration was fast (as on home).
    const heroParts = fadeOrder.filter((n) => n.startsWith('hero-'));
    if (heroParts.length && performance.now() < 1800) {
      createGsapTimeline(heroEntrance(heroParts), fades as GsapTargetMap).play();
    }

    // Every other beat: one staggered entrance when its anchor arrives.
    for (const beat of beats) {
      if (beat === 'hero') continue;
      const parts = fadeOrder.filter((n) => !n.startsWith('hero-') && beatOf(n, beats) === beat);
      if (!parts.length) continue;
      attachScrollTrigger(createGsapTimeline(entrance(beat, parts), fades as GsapTargetMap), {
        trigger: triggers[beat]!,
        start: REVEAL_START,
      });
    }

    // Drifts: desktop only, scrubbed across their beat's anchor.
    const media = createMediaScope();
    media.add(DESKTOP, () => {
      for (const [name, el] of Object.entries(scrubs)) {
        const motion = drift(name);
        const beat = beatOf(name, beats);
        if (!motion) continue;
        attachScrollTrigger(createGsapTimeline(motion, { [name]: el } as GsapTargetMap), {
          trigger: beat ? triggers[beat]! : el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: SCRUB.loose,
        });
      }
    });

    return () => {
      media.revert();
      host.classList.remove(ARMED_CLASS);
    };
  });
}
