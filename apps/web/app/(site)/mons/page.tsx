import { Suspense } from 'react';
import { getPublishedSitePage, siteMetadata, siteEmbedOrigins, siteOrigin } from '../../../lib/site-content';
import type { Metadata } from 'next';
import { MonsIndexPage } from '../../../components/mons/MonsIndexPage';
import { W02_COPY } from '../../../components/mons/copy';

const originalMetadata: Metadata = {
  title: { absolute: 'NYC-MON | The Mons' },
  description: W02_COPY.meta.indexDescription,
  alternates: { canonical: '/mons' },
};

export function generateMetadata(): Promise<Metadata> { return siteMetadata('/mons', originalMetadata); }
async function PublishedPage() {
  const page = await getPublishedSitePage('/mons');
  return <MonsIndexPage page={page} embedOrigins={siteEmbedOrigins()} siteOrigin={siteOrigin()} />;
}
export default function Page() { return <Suspense fallback={null}><PublishedPage /></Suspense>; }
