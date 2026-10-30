import { PrivacyPage } from '../../../../components/legal/PrivacyPage';
import { LEGAL_COPY } from '@acme/app/features/legal/copy.ts';

import { websiteRoute } from '../../../../lib/site-route';

const route = websiteRoute('/legal/privacy', PrivacyPage, {
  title: { absolute: 'NYC-MON | Privacy notice' },
  description: LEGAL_COPY.privacy.description,
  alternates: { canonical: '/legal/privacy' },
});
export const generateMetadata = route.generateMetadata;
export default route.Page;
