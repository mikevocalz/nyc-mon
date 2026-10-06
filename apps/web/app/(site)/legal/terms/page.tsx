import type { Metadata } from 'next';
import { TermsPage } from '../../../../components/legal/TermsPage';
import { LEGAL_COPY } from '../../../../components/legal/copy';

export const metadata: Metadata = {
  title: { absolute: 'NYC-MON | Terms of use' },
  description: LEGAL_COPY.terms.description,
};

export default function Page() {
  return <TermsPage />;
}
