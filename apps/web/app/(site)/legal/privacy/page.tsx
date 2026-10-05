import type { Metadata } from 'next';
import { PrivacyPage } from '../../../../components/legal/PrivacyPage';
import { LEGAL_COPY } from '../../../../components/legal/copy';

export const metadata: Metadata = {
  title: { absolute: 'NYC-MON | Privacy notice' },
  description: LEGAL_COPY.privacy.description,
};

export default function Page() {
  return <PrivacyPage />;
}
