import { Suspense } from 'react';
import { getPublishedSitePage, siteMetadata, siteEmbedOrigins, siteOrigin } from '../../../lib/site-content';
import type { Metadata } from 'next';
import { HowItWorksPage } from '../../../components/how-it-works/HowItWorksPage';
import { W04_COPY } from '../../../components/how-it-works/copy';

const originalMetadata: Metadata = {
  title: { absolute: 'NYC-MON | How it works' },
  description: W04_COPY.loop.body,
  alternates: { canonical: '/how-it-works' },
};

export function generateMetadata(): Promise<Metadata> { return siteMetadata('/how-it-works', originalMetadata); }
async function PublishedPage() {
  const page = await getPublishedSitePage('/how-it-works');
  return <HowItWorksPage page={page} embedOrigins={siteEmbedOrigins()} siteOrigin={siteOrigin()} />;
}
export default function Page() { return <Suspense fallback={null}><PublishedPage /></Suspense>; }
