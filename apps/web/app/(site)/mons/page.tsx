import type { Metadata } from 'next';
import { MonsIndexPage } from '../../../components/mons/MonsIndexPage';
import { W02_COPY } from '../../../components/mons/copy';

export const metadata: Metadata = {
  title: { absolute: 'NYC-MON | The Mons' },
  description: W02_COPY.meta.indexDescription,
};

export default function Page() {
  return <MonsIndexPage />;
}
