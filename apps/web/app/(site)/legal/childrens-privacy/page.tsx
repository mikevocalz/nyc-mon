import type { Metadata } from 'next';
import { ChildrensPrivacyPage } from '../../../../components/legal/ChildrensPrivacyPage';
import { LEGAL_COPY } from '../../../../components/legal/copy';

export const metadata: Metadata = {
  title: { absolute: "NYC-MON | Children's privacy" },
  description: LEGAL_COPY.childrens.description,
};

export default function Page() {
  return <ChildrensPrivacyPage />;
}
