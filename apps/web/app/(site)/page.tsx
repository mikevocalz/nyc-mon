import type { Metadata } from 'next';
import { HomePage } from '../../components/home/HomePage';
import { W01_COPY } from '../../components/home/copy';

export const metadata: Metadata = {
  title: { absolute: 'NYC-MON | Every block has a legend.' },
  description: W01_COPY.hero.body,
};

export default function Page() {
  return <HomePage />;
}
