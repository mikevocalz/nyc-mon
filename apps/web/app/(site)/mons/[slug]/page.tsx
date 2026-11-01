import { Suspense } from 'react';
import { getPublishedSitePage, siteMetadata, siteEmbedOrigins, siteOrigin } from '../../../../lib/site-content';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MonsDetailPage } from '../../../../components/mons/MonsDetailPage';
import { W02_COPY } from '../../../../components/mons/copy';
import { monsSlugs, starterBySlug } from '../../../../components/mons/starters';

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return monsSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const starter = starterBySlug(slug);
  if (starter === undefined) notFound();
  return siteMetadata(`/mons/${starter.slug}`, {
    title: { absolute: W02_COPY.meta.detailTitle(starter.babyName) },
    description: W02_COPY.meta.detailDescription(starter.babyName, starter.bloodline),
    alternates: { canonical: `/mons/${starter.slug}` },
  });
}

async function PublishedPage({ params }: Props) {
  const { slug } = await params;
  const starter = starterBySlug(slug);
  if (starter === undefined) notFound();
  const page = await getPublishedSitePage(`/mons/${starter.slug}`);
  return <MonsDetailPage starter={starter} page={page} embedOrigins={siteEmbedOrigins()} siteOrigin={siteOrigin()} />;
}

export default function Page(props: Props) { return <Suspense fallback={null}><PublishedPage {...props} /></Suspense>; }
