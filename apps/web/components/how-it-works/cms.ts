import { copyFor, sectionFor, sectionText, type SitePage } from '@acme/content/site-content';
import { W04_COPY } from './copy';
export function howCopy(page?: SitePage | null) {
  const journey = sectionFor(page, 'journey');
  return {
    loop: { ...copyFor(sectionFor(page, 'hero'), W04_COPY.loop), steps: copyFor(journey, W04_COPY.loop.steps, 'steps') },
    hlynk: copyFor(journey, W04_COPY.hlynk, 'hlynk'),
    incubation: copyFor(journey, W04_COPY.incubation, 'incubation'),
    hatchClosing: sectionText(journey, 'hatchClosing', W04_COPY.hatchClosing),
    care: copyFor(journey, W04_COPY.care, 'care'),
    city: copyFor(journey, W04_COPY.city, 'city'),
    cta: copyFor(sectionFor(page, 'cta'), W04_COPY.cta),
  };
}
