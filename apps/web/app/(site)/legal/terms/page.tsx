import { Suspense } from 'react';
import { getPublishedSitePage, siteMetadata, siteEmbedOrigins, siteOrigin } from '../../../../lib/site-content';
import type { Metadata } from 'next';
import { TermsPage } from '../../../../components/legal/TermsPage';
import { LEGAL_COPY } from '@acme/app/features/legal/copy.ts';

const originalMetadata: Metadata = {
  title: { absolute: 'NYC-MON | Terms of use' },
  description: LEGAL_COPY.terms.description,
  alternates: { canonical: '/legal/terms' },
};

export function generateMetadata(): Promise<Metadata> { return siteMetadata('/legal/terms', originalMetadata); }
async function PublishedPage() {
  const page = await getPublishedSitePage('/legal/terms');
  return <TermsPage page={page} embedOrigins={siteEmbedOrigins()} siteOrigin={siteOrigin()} />;
}
export default function Page() { return <Suspense fallback={null}><PublishedPage /></Suspense>; }
