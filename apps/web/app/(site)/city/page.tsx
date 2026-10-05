import type { Metadata } from 'next';
import { CityPage } from '../../../components/city/CityPage';
import { W03_COPY } from '../../../components/city/copy';

export const metadata: Metadata = {
  title: { absolute: 'NYC-MON | The City' },
  description: W03_COPY.districts.body,
};

export default function Page() {
  return <CityPage />;
}
