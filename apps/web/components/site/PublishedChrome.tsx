import { getSitePage, siteEditorEnabled } from '../../lib/site-content';
import { SiteNavBar, SiteFooterBar } from './SiteChrome';
export async function PublishedNav() {
  const page = await getSitePage('/site-chrome', false);
  return siteEditorEnabled() && !page ? null : <SiteNavBar page={page} />;
}
export async function PublishedFooter() {
  const page = await getSitePage('/site-chrome', false);
  return siteEditorEnabled() && !page ? null : <SiteFooterBar page={page} />;
}
