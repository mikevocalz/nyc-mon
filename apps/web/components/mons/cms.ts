import { copyFor, sectionFor, sectionText, type SitePage, type SiteSection } from '@acme/content/site-content';
import { placedArt } from '../cms/art';
import { monsArt } from './art';
import { W02_COPY } from './copy';
import type { MonsStarter } from './starters';
export function placedMonArt(section: SiteSection | undefined, slot: MonsStarter['slot']) {
  const original = monsArt(slot);
  return { ...original, baby: placedArt(section, `starter.${slot}.baby`, original.baby), egg: placedArt(section, `starter.${slot}.egg`, original.egg), street: placedArt(section, `starter.${slot}.street`, original.street) };
}
export function monDetailCopy(page: SitePage | null | undefined, key: string) {
  const section = sectionFor(page, key);
  return { ...copyFor(section, W02_COPY.detail),
    eyebrow: (bloodline: string) => sectionText(section, 'eyebrow', W02_COPY.detail.eyebrow(bloodline)),
    bloodlineBody: (bloodline: string) => sectionText(section, 'bloodlineBody', W02_COPY.detail.bloodlineBody(bloodline)),
    eggBody: (egg: string, baby: string) => sectionText(section, 'eggBody', W02_COPY.detail.eggBody(egg, baby)),
  };
}
