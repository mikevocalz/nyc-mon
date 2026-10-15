import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { appPreviewEnabled } from '../../../lib/app-preview';
import { NOINDEX } from '../../../lib/seo';

// A template app screen with demo data: kept out of search, and a 404 in
// production unless NYCMON_APP_PREVIEW=1 (lib/app-preview.ts). The page is a
// client component and can't export metadata itself.
export const metadata: Metadata = { robots: NOINDEX };

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!appPreviewEnabled()) notFound();
  return children;
}
