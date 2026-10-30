import type { SiteSection } from '@acme/content/site-content';
import { babyArt, eggArt, hatchNightArt, hlynkArt, photoArt } from '../how-it-works/art';
import { placedRouteArt } from './art';

/** Slots are semantic and stable; changing layout size never changes the media relationship. */
export function routeArtFor(section: SiteSection | undefined, prefix = '') {
  const slot = (name: string) => prefix ? `${prefix}.${name}` : name;
  return {
    babyArt: (...args: Parameters<typeof babyArt>) => placedRouteArt(section, slot(`baby.${args[0]}`), babyArt(...args)),
    eggArt: (...args: Parameters<typeof eggArt>) => placedRouteArt(section, slot(`egg.${args[0]}`), eggArt(...args)),
    hlynkArt: (...args: Parameters<typeof hlynkArt>) => placedRouteArt(section, slot('hlynk'), hlynkArt(...args)),
    hatchNightArt: (...args: Parameters<typeof hatchNightArt>) => placedRouteArt(section, slot('hatch-night'), hatchNightArt(...args)),
    photoArt: (...args: Parameters<typeof photoArt>) => placedRouteArt(section, slot(`photo.${args[0]}`), photoArt(...args)),
  };
}
