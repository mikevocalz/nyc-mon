import { HowItWorksPage } from '../../../components/how-it-works/HowItWorksPage';
import { W04_COPY } from '../../../components/how-it-works/copy';

import { websiteRoute } from '../../../lib/site-route';

const route = websiteRoute('/how-it-works', HowItWorksPage, {
  title: { absolute: 'NYC-MON | How it works' },
  description: W04_COPY.loop.body,
  alternates: { canonical: '/how-it-works' },
});
export const generateMetadata = route.generateMetadata;
export default route.Page;
