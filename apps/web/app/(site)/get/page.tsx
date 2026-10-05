import type { Metadata } from 'next';
import { GetPage } from '../../../components/get/GetPage';
import { W05_COPY } from '../../../components/get/copy';

export const metadata: Metadata = {
  title: { absolute: 'NYC-MON | Get NYC-MON' },
  description: W05_COPY.hero.body,
};

export default function Page() {
  return <GetPage />;
}
