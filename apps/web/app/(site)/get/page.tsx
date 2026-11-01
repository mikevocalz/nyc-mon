import { Suspense } from 'react';
import { getPublishedSitePage, siteMetadata, siteEmbedOrigins, siteOrigin } from '../../../lib/site-content';
import type { Metadata } from 'next';
import { GetPage } from '../../../components/get/GetPage';
import { W05_COPY } from '../../../components/get/copy';

const originalMetadata: Metadata = {
  title: { absolute: 'NYC-MON | Get NYC-MON' },
  description: W05_COPY.hero.body,
  alternates: { canonical: '/get' },
};

export function generateMetadata(): Promise<Metadata> { return siteMetadata('/get', originalMetadata); }
async function PublishedPage() {
  const page = await getPublishedSitePage('/get');
  return <GetPage page={page} embedOrigins={siteEmbedOrigins()} siteOrigin={siteOrigin()} />;
}
export default function Page() { return <Suspense fallback={null}><PublishedPage /></Suspense>; }
