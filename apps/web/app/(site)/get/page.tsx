import { GetPage } from '../../../components/get/GetPage';
import { W05_COPY } from '../../../components/get/copy';

import { websiteRoute } from '../../../lib/site-route';

const route = websiteRoute('/get', GetPage, {
  title: { absolute: 'NYC-MON | Get NYC-MON' },
  description: W05_COPY.hero.body,
  alternates: { canonical: '/get' },
});
export const generateMetadata = route.generateMetadata;
export default route.Page;
