import { Suspense } from 'react';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Heading, Paragraph, Section } from '@acme/ui/html';
import { readPreview } from '../../../../lib/site-preview';
import { getSitePage, siteEmbedOrigins } from '../../../../lib/site-content';
import { TemplatePage } from '../../../../components/cms/TemplatePage';
import { LoadingContent } from '../../../../components/cms/LoadingContent';
import { RefreshPreview } from '../../../../components/cms/RefreshPreview';
import { SiteNavBar, SiteFooterBar } from '../../../../components/site/SiteChrome';
export const metadata: Metadata = { title: 'Private website preview', robots: { index: false, follow: false } };
type Props = { params: Promise<{ token: string }> };
async function Preview(props: Props) {
  await connection();
  const { token } = await props.params;
  const preview = await readPreview(token);
  if (!preview) return <Section className="mx-auto max-w-screen-xl gap-4 px-4 py-16"><Heading level={1}>Preview expired or unavailable</Heading><Paragraph>Reopen Preview from the page in Payload. Public visitors never see this draft.</Paragraph></Section>;
  const { page, adminOrigin } = preview;
  const shared = page.route === '/site-chrome' ? page : await getSitePage('/site-chrome', false);
  return <><RefreshPreview adminOrigin={adminOrigin} /><Section className="bg-signage-black px-4 py-3"><Paragraph className="text-signage-white">Draft preview — saved and autosaved changes only. This page is not public.</Paragraph></Section><SiteNavBar page={shared} previewPath={page.route === '/site-chrome' ? '/' : page.route} />{page.route === '/site-chrome' ? <Section className="px-4 py-16"><Heading level={1}>Shared header and footer preview</Heading></Section> : <TemplatePage page={page} embedOrigins={siteEmbedOrigins()} siteOrigin={process.env.NEXT_PUBLIC_SITE_URL ?? ''} />}<SiteFooterBar page={shared} previewPath={page.route === '/site-chrome' ? '/' : page.route} /></>;
}
export default function Page(props: Props) { return <Suspense fallback={<LoadingContent />}><Preview {...props} /></Suspense>; }
