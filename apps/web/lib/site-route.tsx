import 'server-only';
import type { ComponentType } from 'react';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import type { WebsitePageProps } from '../components/cms/PageContent';
import { LoadingContent } from '../components/cms/LoadingContent';
import { getSitePage, siteEmbedOrigins } from './site-content';

export function websiteRoute(route: string, Component: ComponentType<WebsitePageProps>, fallback: Metadata) {
  async function Content() {
    const page = await getSitePage(route);
    return <Component page={page} embedOrigins={siteEmbedOrigins()} siteOrigin={process.env.NEXT_PUBLIC_SITE_URL ?? ''} />;
  }
  return {
    async generateMetadata(): Promise<Metadata> {
      const page = await getSitePage(route);
      return { ...fallback, ...(page?.seo.title ? { title: { absolute: page.seo.title } } : {}), ...(page?.seo.description !== undefined ? { description: page.seo.description } : {}), alternates: { canonical: route } };
    },
    Page: function Page() { return <Suspense fallback={<LoadingContent />}><Content /></Suspense>; },
  };
}
