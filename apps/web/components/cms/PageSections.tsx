import { Fragment, type ReactNode } from 'react';
import { orderedSectionKeys, sectionFor, type SitePage } from '@acme/content/site-content';
import { SectionContent } from './SectionContent';

export interface CmsPageProps { page?: SitePage | null; embedOrigins?: string[]; siteOrigin?: string }
export interface NativeSection { key: string; node: ReactNode }
export function defaultSectionOrder(page: SitePage | null | undefined, keys: readonly string[], ignored: readonly string[] = []): boolean {
  return orderedSectionKeys(page, keys).filter(key => !ignored.includes(key) && !sectionFor(page, key)?.hidden).join('|') === keys.join('|');
}
/** Fragments preserve the existing layout; stored ordering and visibility own the sections. */
export function PageSections({ page, sections, embedOrigins = [], siteOrigin = '', nestedKeys = [] }: CmsPageProps & { sections: NativeSection[]; nestedKeys?: readonly string[] }) {
  const native = new Map(sections.map(section => [section.key, section.node]));
  return <>{orderedSectionKeys(page, sections.map(section => section.key)).map(key => {
    const section = sectionFor(page, key);
    if (nestedKeys.includes(key) || section?.hidden) return null;
    return <Fragment key={key}>{native.get(key)}<SectionContent section={section} origins={embedOrigins} siteOrigin={siteOrigin} /></Fragment>;
  })}</>;
}
