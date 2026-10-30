import { Suspense } from 'react';
import { getPublishedSitePage, siteMetadata, siteEmbedOrigins, siteOrigin } from '../../../lib/site-content';
import type { Metadata } from 'next';
import { CityPage } from '../../../components/city/CityPage';
import { W03_COPY } from '../../../components/city/copy';

const originalMetadata: Metadata = {
  title: { absolute: 'NYC-MON | The City' },
  description: W03_COPY.districts.body,
  alternates: { canonical: '/city' },
};

export function generateMetadata(): Promise<Metadata> { return siteMetadata('/city', originalMetadata); }
async function PublishedPage() {
  const page = await getPublishedSitePage('/city');
  return <CityPage page={page} embedOrigins={siteEmbedOrigins()} siteOrigin={siteOrigin()} />;
}
export default function Page() { return <Suspense fallback={null}><PublishedPage /></Suspense>; }
