import { ChildrensPrivacyPage } from '../../../../components/legal/ChildrensPrivacyPage';
import { LEGAL_COPY } from '@acme/app/features/legal/copy.ts';

import { websiteRoute } from '../../../../lib/site-route';

const route = websiteRoute('/legal/childrens-privacy', ChildrensPrivacyPage, {
  title: { absolute: "NYC-MON | Children's privacy" },
  description: LEGAL_COPY.childrens.description,
  alternates: { canonical: '/legal/childrens-privacy' },
});
export const generateMetadata = route.generateMetadata;
export default route.Page;
