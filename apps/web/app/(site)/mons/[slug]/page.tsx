import { Suspense } from 'react';
import { LoadingContent } from '../../../../components/cms/LoadingContent';
import { getSitePage, siteEmbedOrigins } from '../../../../lib/site-content';
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
  const page = await getSitePage(`/mons/${slug}`);
  return {
    title: { absolute: page?.seo.title ?? W02_COPY.meta.detailTitle(starter.babyName) },
    description: page?.seo.description ?? W02_COPY.meta.detailDescription(starter.babyName, starter.bloodline),
    alternates: { canonical: `/mons/${starter.slug}` },
  };
}

async function PublishedMon({ params }: Props) {
  const { slug } = await params;
  const starter = starterBySlug(slug);
  if (starter === undefined) notFound();
  const page = await getSitePage(`/mons/${slug}`);
  return <MonsDetailPage starter={starter} page={page} embedOrigins={siteEmbedOrigins()} siteOrigin={process.env.NEXT_PUBLIC_SITE_URL ?? ''} />;
}

export default function Page(props: { params: Promise<{ slug: string }> }) {
  return <Suspense fallback={<LoadingContent />}><PublishedMon {...props} /></Suspense>;
}
