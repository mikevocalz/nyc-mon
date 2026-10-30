import { copyFor, sectionFor, type SitePage } from '@acme/content/site-content';
import { W05_COPY } from './copy';
export function getCopy(page?: SitePage | null) {
  const hero = sectionFor(page, 'hero');
  return { hero: copyFor(hero, W05_COPY.hero), stores: copyFor(hero, W05_COPY.stores, 'stores'), form: copyFor(hero, W05_COPY.form, 'form'), bento: copyFor(sectionFor(page, 'features'), W05_COPY.bento) };
}
