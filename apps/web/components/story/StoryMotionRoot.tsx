'use client';
/**
 * /story choreography. The generic beats (section reveals, photo drift, the
 * hero load) come from `useRouteMotion`; the page's one authored moment is
 * the pinned false-extinction chapter: on desktop the chapter holds the
 * screen while the scroll plays it like a film cut. The night photograph
 * pulls back and dims, the chapter number climbs, the two title plates slide
 * in from opposite edges and the report lands last. When the pin releases
 * every element is at its resting place, which is also the static
 * composition reduced motion and phones get.
 */
import { compileMotion, defineMotion } from 'kinetrell/core';
import { attachScrollTrigger, createGsapTimeline } from 'kinetrell/web/gsap';
import { pageMotion } from '@acme/theme';
import { RouteLenis } from './RouteLenis';
import { bindable, DESKTOP, LINEAR, SPAN_MS, useRouteMotion, type RouteTargets } from './route-motion';

const { scrub: SCRUB } = pageMotion;

const extinctionFilm = compileMotion(
  defineMotion({
    id: 'story.extinction.pin',
    initial: {
      'extinction-art': { scale: 1.18 },
      'extinction-scrim': { opacity: 0.35 },
      'extinction-num': { yPercent: 40, opacity: 0.2 },
      'extinction-line-0': { xPercent: -24, opacity: 0 },
      'extinction-line-1': { xPercent: 24, opacity: 0 },
      'extinction-body': { y: 48, opacity: 0 },
    },
    tracks: [
      { target: 'extinction-art', to: { scale: 1 }, atMs: 0, durationMs: SPAN_MS, ease: LINEAR },
      { target: 'extinction-scrim', to: { opacity: 1 }, atMs: 0, durationMs: 700, ease: LINEAR },
      { target: 'extinction-num', to: { yPercent: 0, opacity: 1 }, atMs: 0, durationMs: 450, ease: LINEAR },
      { target: 'extinction-line-0', to: { xPercent: 0, opacity: 1 }, atMs: 150, durationMs: 300, ease: LINEAR },
      { target: 'extinction-line-1', to: { xPercent: 0, opacity: 1 }, atMs: 300, durationMs: 300, ease: LINEAR },
      { target: 'extinction-body', to: { y: 0, opacity: 1 }, atMs: 550, durationMs: 300, ease: LINEAR },
    ],
  }),
);

function bindExtinction({ scrubs, media }: RouteTargets) {
  const frame = scrubs['extinction-frame'];
  if (!frame || !bindable(extinctionFilm, scrubs)) return;
  media.add(DESKTOP, () => {
    attachScrollTrigger(createGsapTimeline(extinctionFilm, scrubs), {
      trigger: frame,
      start: 'top top',
      end: '+=110%',
      pin: true,
      // RNW parents are flex boxes, where ScrollTrigger defaults pinSpacing to false.
      pinSpacing: true,
      scrub: SCRUB.base,
    });
  });
}

function StoryFrame() {
  useRouteMotion(bindExtinction);
  return null;
}

export default function StoryMotionRoot() {
  return (
    <RouteLenis>
      <StoryFrame />
    </RouteLenis>
  );
}
