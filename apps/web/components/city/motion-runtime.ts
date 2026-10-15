import { createGsapTimeline, type GsapTargetMap } from 'kinetrell/web/gsap';
import { cityAtlasMotion } from './motion';

export function createCityTimeline(targets: GsapTargetMap) {
  return createGsapTimeline(cityAtlasMotion, targets);
}
