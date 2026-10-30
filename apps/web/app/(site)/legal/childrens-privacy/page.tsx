import { Suspense } from 'react';
import { getPublishedSitePage, siteMetadata, siteEmbedOrigins, siteOrigin } from '../../../../lib/site-content';
import type { Metadata } from 'next';
import { ChildrensPrivacyPage } from '../../../../components/legal/ChildrensPrivacyPage';
import { LEGAL_COPY } from '@acme/app/features/legal/copy.ts';

const originalMetadata: Metadata = {
  title: { absolute: "NYC-MON | Children's privacy" },
  description: LEGAL_COPY.childrens.description,
  alternates: { canonical: '/legal/childrens-privacy' },
};

export function generateMetadata(): Promise<Metadata> { return siteMetadata('/legal/childrens-privacy', originalMetadata); }
async function PublishedPage() {
  const page = await getPublishedSitePage('/legal/childrens-privacy');
  return <ChildrensPrivacyPage page={page} embedOrigins={siteEmbedOrigins()} siteOrigin={siteOrigin()} />;
}
export default function Page() { return <Suspense fallback={null}><PublishedPage /></Suspense>; }
