import { Suspense } from 'react';
import { getPublishedSitePage, siteMetadata, siteEmbedOrigins, siteOrigin } from '../../../lib/site-content';
import type { Metadata } from 'next';
import { StoryPage } from '../../../components/story/StoryPage';
import { STORY_COPY } from '../../../components/story/copy';

const originalMetadata: Metadata = {
  title: { absolute: 'NYC-MON | The Story' },
  description: STORY_COPY.hero.body,
  alternates: { canonical: '/story' },
};

export function generateMetadata(): Promise<Metadata> { return siteMetadata('/story', originalMetadata); }
async function PublishedPage() {
  const page = await getPublishedSitePage('/story');
  return <StoryPage page={page} embedOrigins={siteEmbedOrigins()} siteOrigin={siteOrigin()} />;
}
export default function Page() { return <Suspense fallback={null}><PublishedPage /></Suspense>; }
