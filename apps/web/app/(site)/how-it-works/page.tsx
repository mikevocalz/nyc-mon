import type { Metadata } from 'next';
import { HowItWorksPage } from '../../../components/how-it-works/HowItWorksPage';
import { W04_COPY } from '../../../components/how-it-works/copy';

export const metadata: Metadata = {
  title: { absolute: 'NYC-MON | How it works' },
  description: W04_COPY.loop.body,
};

export default function Page() {
  return <HowItWorksPage />;
}
