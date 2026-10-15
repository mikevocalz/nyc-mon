import type { Metadata } from 'next';
import { SpatialScreen } from '@acme/spatial';
import { NOINDEX } from '../../../lib/seo';

export const metadata: Metadata = {
  title: { absolute: 'NYC-MON | Walk the district' },
  description: 'Pick a New York district (Downtown, Midtown, Harlem or Mega City) and walk its streets.',
  // App shell, not marketing: kept out of search (lib/seo.ts).
  robots: NOINDEX,
};

export default function SpatialPage() {
  return <SpatialScreen />;
}
