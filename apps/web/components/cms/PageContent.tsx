import type { ReactNode } from 'react';
import { Fragment } from 'react';
import { orderedSectionKeys, sectionFor, type SitePage } from '@acme/content/site-content';
import { SectionContent } from './SectionContent';

export interface WebsitePageProps { page?: SitePage | null; embedOrigins?: string[]; siteOrigin?: string }
export type PageProps = Pick<WebsitePageProps, 'page'>;

/** Keep original semantic sections and layout; a CMS record owns their order, visibility and appended blocks. */
export function PageSections({ page, embedOrigins = [], siteOrigin = '', sections }: WebsitePageProps & { sections: Record<string, ReactNode> }) {
  return orderedSectionKeys(page, Object.keys(sections)).map((key) => {
    const section = sectionFor(page, key);
    if (section?.hidden) return null;
    return <Fragment key={key}>{sections[key]}<SectionContent section={section} origins={embedOrigins} siteOrigin={siteOrigin} /></Fragment>;
  });
}
/** Fixed-timeline motion only runs against the exact original section structure. */
export function originalLayout(page: SitePage | null | undefined, keys: readonly string[]): boolean {
  return !page || (orderedSectionKeys(page, keys).join('|') === keys.join('|') && !page.sections.some((section) => section.hidden));
}
