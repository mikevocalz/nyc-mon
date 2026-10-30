import { copyFor, sectionFor, type SitePage } from '@acme/content/site-content';
import { placedArt } from '../cms/art';
import { STORY_COPY } from './copy';
import { STORY_PHOTOS } from './art';
export const STORY_SECTION_MAP = { hero: 'hero', cleanCity: 'clean-city', projectZero: 'project-zero', vale: 'vale', extinction: 'extinction', cascade: 'cascade', returned: 'returned', enginex: 'enginex', footer: 'outro' } as const;
export function storyCopy(page?: SitePage | null) {
  return {
    hero: copyFor(sectionFor(page, 'hero'), STORY_COPY.hero),
    cleanCity: copyFor(sectionFor(page, 'clean-city'), STORY_COPY.cleanCity),
    projectZero: copyFor(sectionFor(page, 'project-zero'), STORY_COPY.projectZero),
    vale: copyFor(sectionFor(page, 'vale'), STORY_COPY.vale),
    extinction: copyFor(sectionFor(page, 'extinction'), STORY_COPY.extinction),
    cascade: copyFor(sectionFor(page, 'cascade'), STORY_COPY.cascade),
    returned: copyFor(sectionFor(page, 'returned'), STORY_COPY.returned),
    enginex: copyFor(sectionFor(page, 'enginex'), STORY_COPY.enginex),
    footer: copyFor(sectionFor(page, 'outro'), STORY_COPY.footer),
  };
}
export const STORY_IMAGE_SECTIONS = { hero: 'hero', cleanCity: 'clean-city', sunset: 'sunset', vale: 'vale', extinction: 'extinction', rooftops: 'cascade', water: 'cascade', returned: 'returned' } as const;
export function storyPhotos(page?: SitePage | null) {
  return Object.fromEntries(Object.entries(STORY_PHOTOS).map(([key, image]) => [key, placedArt(sectionFor(page, STORY_IMAGE_SECTIONS[key as keyof typeof STORY_IMAGE_SECTIONS]), key.toLowerCase(), image)])) as Record<keyof typeof STORY_PHOTOS, import('../home/art').ArtEntry>;
}
