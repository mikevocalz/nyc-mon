import { copyFor, sectionFor, blockImage, type SitePage } from '@acme/content/site-content';
import { FOOTER_DESCRIPTION, FOOTER_GROUPS, NAV_CTA, PAGES } from './nav';
export const HEADER_DEFAULTS = { items: PAGES, cta: { label: NAV_CTA.label, href: NAV_CTA.href ?? '/get' } };
export const FOOTER_DEFAULTS = { description: FOOTER_DESCRIPTION, tagline: 'Every block has a legend.', copyright: `© ${new Date().getFullYear()} NYC-MON`, groups: FOOTER_GROUPS };
export function chromeContent(page?: SitePage | null) {
  const header = sectionFor(page, 'header'), footer = sectionFor(page, 'footer');
  return { header: copyFor(header, HEADER_DEFAULTS), footer: copyFor(footer, FOOTER_DEFAULTS),
    headerLogo: blockImage(header?.content.find((block) => block.blockType === 'image' && block.slot === 'logo')),
    footerLogo: blockImage(footer?.content.find((block) => block.blockType === 'image' && block.slot === 'logo')),
  };
}
