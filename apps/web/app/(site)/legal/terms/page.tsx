import { TermsPage } from '../../../../components/legal/TermsPage';
import { LEGAL_COPY } from '@acme/app/features/legal/copy.ts';

import { websiteRoute } from '../../../../lib/site-route';

const route = websiteRoute('/legal/terms', TermsPage, {
  title: { absolute: 'NYC-MON | Terms of use' },
  description: LEGAL_COPY.terms.description,
  alternates: { canonical: '/legal/terms' },
});
export const generateMetadata = route.generateMetadata;
export default route.Page;
