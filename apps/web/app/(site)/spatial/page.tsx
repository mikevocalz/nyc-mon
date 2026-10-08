import type { Metadata } from 'next';
import { SpatialScreen } from '@acme/spatial';

export const metadata: Metadata = {
  title: { absolute: 'NYC-MON | Walk the district' },
  description: 'Pick a New York district (Downtown, Midtown, Harlem or Mega City) and walk its streets.',
};

export default function SpatialPage() {
  return <SpatialScreen />;
}
