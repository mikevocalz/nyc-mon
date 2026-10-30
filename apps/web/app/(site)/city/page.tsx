import { CityPage } from '../../../components/city/CityPage';
import { W03_COPY } from '../../../components/city/copy';

import { websiteRoute } from '../../../lib/site-route';

const route = websiteRoute('/city', CityPage, {
  title: { absolute: 'NYC-MON | The City' },
  description: W03_COPY.districts.body,
  alternates: { canonical: '/city' },
});
export const generateMetadata = route.generateMetadata;
export default route.Page;
