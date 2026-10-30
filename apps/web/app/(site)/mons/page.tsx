import { MonsIndexPage } from '../../../components/mons/MonsIndexPage';
import { W02_COPY } from '../../../components/mons/copy';

import { websiteRoute } from '../../../lib/site-route';

const route = websiteRoute('/mons', MonsIndexPage, {
  title: { absolute: 'NYC-MON | The Mons' },
  description: W02_COPY.meta.indexDescription,
  alternates: { canonical: '/mons' },
});
export const generateMetadata = route.generateMetadata;
export default route.Page;
