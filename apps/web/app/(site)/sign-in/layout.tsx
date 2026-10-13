import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { appPreviewEnabled } from '../../../lib/app-preview';
import { NOINDEX } from '../../../lib/seo';

// Web sign-in lands on /profile (sign-in-nav.web.ts), a template screen that
// 404s in production, so sign-in is gated the same way: kept out of search, a 404 in
// production unless NYCMON_APP_PREVIEW=1 (lib/app-preview.ts). The page is a
// client component and can't export metadata itself.
export const metadata: Metadata = { robots: NOINDEX };

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!appPreviewEnabled()) notFound();
  return children;
}
