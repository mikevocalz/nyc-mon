import { PreviewBanner } from '../../components/cms/PreviewBanner';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SITE_DESCRIPTION } from '@acme/spatial/copy';
import { Document } from '../Document';
import { SiteChromeServer } from '../../components/site/SiteChromeServer';
import { CONTENT_ID } from '../../components/site/nav';
import '../rn-globals';
import '../globals.css';
import { Main } from '@acme/ui/html';
import { siteUrl } from '../../lib/site-url';

export const metadata: Metadata = {
  title: {
    default: 'NYC-MON',
    template: '%s | NYC-MON',
  },
  description: SITE_DESCRIPTION,
  // Resolves the relative canonicals and the opengraph-image URL; each page
  // sets its own `alternates.canonical` (a layout canonical would leak to every child).
  metadataBase: new URL(siteUrl()),
  applicationName: 'NYC-MON',
  // og:title / og:description fall back to each page's title and description;
  // the image comes from app/opengraph-image.tsx and twitter inherits it.
  openGraph: {
    siteName: 'NYC-MON',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <Document>
      <Suspense fallback={null}><PreviewBanner /></Suspense>
      <Suspense fallback={null}><SiteChromeServer part="header" /></Suspense>
      <Main id={CONTENT_ID} tabIndex={-1} className="min-h-screen flex-1 focus:outline-none">
        {children}
      </Main>
      <Suspense fallback={null}><SiteChromeServer part="footer" /></Suspense>
    </Document>
  );
}
