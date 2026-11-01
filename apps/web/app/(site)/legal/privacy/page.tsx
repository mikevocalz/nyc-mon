import { Suspense } from 'react';
import { getPublishedSitePage, siteMetadata, siteEmbedOrigins, siteOrigin } from '../../../../lib/site-content';
import type { Metadata } from 'next';
import { PrivacyPage } from '../../../../components/legal/PrivacyPage';
import { LEGAL_COPY } from '@acme/app/features/legal/copy.ts';

const originalMetadata: Metadata = {
  title: { absolute: 'NYC-MON | Privacy notice' },
  description: LEGAL_COPY.privacy.description,
  alternates: { canonical: '/legal/privacy' },
};

export function generateMetadata(): Promise<Metadata> { return siteMetadata('/legal/privacy', originalMetadata); }
async function PublishedPage() {
  const page = await getPublishedSitePage('/legal/privacy');
  return <PrivacyPage page={page} embedOrigins={siteEmbedOrigins()} siteOrigin={siteOrigin()} />;
}
export default function Page() { return <Suspense fallback={null}><PublishedPage /></Suspense>; }
