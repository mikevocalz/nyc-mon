'use client';
/**
 * /city choreography. Section reveals, photo drift and the hero beat come
 * from the shared route binder (../story/route-motion.ts). The page's one
 * authored moment is the district board: as it arrives, the route discs
 * light in order north to south and each district name flips down onto its
 * plate like a split-flap departures board, one after the other. Phones get
 * the same flip; reduced motion gets the board at rest.
 */
import { compileMotion, defineMotion, type MotionTrack } from 'kinetrell/core';
import { attachScrollTrigger, createGsapTimeline } from 'kinetrell/web/gsap';
import { pageMotion } from '@acme/theme';
import { RouteLenis } from '../story/RouteLenis';
import { bindable, ms, OUT, REVEAL_START, useRouteMotion, type RouteTargets } from '../story/route-motion';
import { BOARD_ROUTE } from './board';

const { duration: D, perspective } = pageMotion;
/** Gap between two names flipping, so the board reads as a sequence, not a fade. */
const FLIP_GAP_MS = 180;

const boardFlip = compileMotion(
  defineMotion({
    id: 'city.board.flip',
    initial: Object.fromEntries(
      BOARD_ROUTE.flatMap((_, i) => [
        [`board-disc-${i}`, { scale: 0 }],
        [`board-name-${i}`, { rotateX: -90, transformPerspective: perspective, transformOrigin: '50% 0%' }],
      ]),
    ),
    tracks: BOARD_ROUTE.flatMap((_, i): MotionTrack[] => [
      { target: `board-disc-${i}`, to: { scale: 1 }, atMs: i * FLIP_GAP_MS, durationMs: ms(D.xs), ease: OUT },
      { target: `board-name-${i}`, to: { rotateX: 0 }, atMs: 80 + i * FLIP_GAP_MS, durationMs: ms(D.sm), ease: OUT },
    ]),
  }),
);

function bindBoard({ scrubs, triggers }: RouteTargets) {
  const board = triggers.board;
  if (!board || !bindable(boardFlip, scrubs)) return;
  attachScrollTrigger(createGsapTimeline(boardFlip, scrubs), { trigger: board, start: REVEAL_START });
}

function CityFrame() {
  useRouteMotion(bindBoard);
  return null;
}

export default function CityMotionRoot() {
  return (
    <RouteLenis>
      <CityFrame />
    </RouteLenis>
  );
}
