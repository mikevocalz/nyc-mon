import type { Metadata } from 'next';
import { ChildrensPrivacyPage } from '../../../../components/legal/ChildrensPrivacyPage';
import { LEGAL_COPY } from '@acme/app/features/legal/copy.ts';

export const metadata: Metadata = {
  title: { absolute: "NYC-MON | Children's privacy" },
  description: LEGAL_COPY.childrens.description,
  alternates: { canonical: '/legal/childrens-privacy' },
};

export default function Page() {
  return <ChildrensPrivacyPage />;
}
