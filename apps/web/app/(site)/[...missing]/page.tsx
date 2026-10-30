import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { safeRoute } from '@acme/content/site-content';
import { CustomPage } from '../../../components/cms/CustomPage';
import { LoadingContent } from '../../../components/cms/LoadingContent';
import { getSitePage, siteEditorEnabled, siteEmbedOrigins } from '../../../lib/site-content';
type Props = { params: Promise<{ missing: string[] }> };
async function content(props: Props) {
  const { missing } = await props.params;
  const route = safeRoute(`/${missing.join('/')}`);
  if (!siteEditorEnabled() || !route || route === '/site-chrome' || route.startsWith('/cms-preview')) notFound();
  return getSitePage(route);
}
export async function generateMetadata(props: Props): Promise<Metadata> {
  const page = await content(props);
  return { title: page?.seo.title ?? page?.title, description: page?.seo.description, alternates: { canonical: page?.route } };
}
async function PublishedPage(props: Props) {
  const page = await content(props);
  return <CustomPage page={page} embedOrigins={siteEmbedOrigins()} siteOrigin={process.env.NEXT_PUBLIC_SITE_URL ?? ''} />;
}
export default function Page(props: Props) { return <Suspense fallback={<LoadingContent />}><PublishedPage {...props} /></Suspense>; }
