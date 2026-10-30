import { breakpoints } from '@acme/theme';
import { placePhoto } from './editorial';
const MD_UP = `(min-width: ${breakpoints.md})`;
const XL_UP = `(min-width: ${breakpoints.xl})`;
const cols = (n: number) => `${XL_UP} ${Math.round(80*n/12)}rem, ${MD_UP} ${Math.round(100*n/12)}vw, 100vw`;
export const STORY_ART = {
  hero: placePhoto('megacity-brooklyn-bridge-night', '100vw', { x: 0.5, y: 0.6 }),
  cleanCity: placePhoto('harlem-brownstone-stoops', cols(5), { x: 0.5, y: 0.5 }),
  sunset: placePhoto('midtown-empire-sunset', '100vw', { x: 0.5, y: 0.45 }),
  vale: placePhoto('harlem-apollo', cols(5), { x: 0.5, y: 0.4 }),
  extinction: placePhoto('megacity-bridge-deck', '100vw', { x: 0.5, y: 0.5 }),
  rooftops: placePhoto('midtown-chrysler-spire', cols(5), { x: 0.5, y: 0.3 }),
  water: placePhoto('downtown-one-wtc', cols(4), { x: 0.5, y: 0.35 }),
  returned: placePhoto('midtown-times-square', '100vw', { x: 0.5, y: 0.5 }),
} as const;
