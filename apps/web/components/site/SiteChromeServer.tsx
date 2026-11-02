import { bootstrapContent, getSitePage, siteEditorEnabled } from '../../lib/site-content';
import { SiteFooterBar, SiteNavBar } from './SiteChrome';
/** Shared settings are a named, versioned document, never a public page route. */
export async function SiteChromeServer({ part }: { part: 'header' | 'footer' }) {
  const content = await getSitePage('/website-shell');
  if (!content && siteEditorEnabled() && !bootstrapContent()) return null;
  return part === 'header' ? <SiteNavBar content={content} /> : <SiteFooterBar content={content} />;
}
