import type { Metadata } from 'next';
import { NOINDEX } from '../../../lib/seo';

// The page is a client component and can't export metadata; this server
// layout keeps the app-shell route out of search (lib/seo.ts).
export const metadata: Metadata = { robots: NOINDEX };

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
