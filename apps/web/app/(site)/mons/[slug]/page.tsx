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
  return {
    title: { absolute: W02_COPY.meta.detailTitle(starter.babyName) },
    description: W02_COPY.meta.detailDescription(starter.babyName, starter.bloodline),
  };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const starter = starterBySlug(slug);
  if (starter === undefined) notFound();
  return <MonsDetailPage starter={starter} />;
}
