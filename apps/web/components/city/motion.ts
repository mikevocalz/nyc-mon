import { compileMotion, defineMotion } from 'kinetrell/core';
import { pageMotion } from '@acme/theme';

/** The photographs settle into their atlas frames; captions and controls never move. */
export const CITY_MOTION_TARGETS = ['downtown', 'midtown', 'harlem'] as const;
export const cityAtlasMotion = compileMotion(defineMotion({
  id: 'w03.atlas.settle',
  initial: Object.fromEntries(CITY_MOTION_TARGETS.map((target) => [target, { scale: pageMotion.scale.enter }])),
  tracks: CITY_MOTION_TARGETS.map((target, index) => ({
    target,
    to: { scale: 1 },
    atMs: index * 80,
    durationMs: Math.round(pageMotion.duration.sm * 1000),
    ease: pageMotion.ease.out.gsap,
  })),
}));
