import type { Metadata } from 'next';
import { TermsPage } from '../../../../components/legal/TermsPage';
import { LEGAL_COPY } from '@acme/app/features/legal/copy.ts';

export const metadata: Metadata = {
  title: { absolute: 'NYC-MON | Terms of use' },
  description: LEGAL_COPY.terms.description,
  alternates: { canonical: '/legal/terms' },
};

export default function Page() {
  return <TermsPage />;
}
