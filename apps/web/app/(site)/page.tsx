import { Suspense } from 'react';
import type { Metadata } from 'next';
import { sectionFor, sectionText } from '@acme/content/site-content';
import { HomePage } from '../../components/home/HomePage';
import { W01_COPY } from '../../components/home/copy';
import { getSitePage, siteEmbedOrigins } from '../../lib/site-content';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getSitePage('/');
  const hero = sectionFor(page, 'hero');
  return {
    title: { absolute: page?.seo.title ?? `NYC-MON | ${sectionText(hero, 'title', W01_COPY.hero.title)}` },
    description: page?.seo.description ?? sectionText(hero, 'body', W01_COPY.hero.body),
    alternates: { canonical: '/' },
  };
}
async function PublishedHome() {
  const page = await getSitePage('/');
  return <HomePage page={page} embedOrigins={siteEmbedOrigins()} siteOrigin={process.env.NEXT_PUBLIC_SITE_URL ?? ''} />;
}
export default function Page() {
  // Required for uncached content in this app's cacheComponents configuration.
  return <Suspense fallback={<HomePage />}><PublishedHome /></Suspense>;
}
