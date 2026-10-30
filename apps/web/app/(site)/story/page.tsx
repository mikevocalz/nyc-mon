import { StoryPage } from '../../../components/story/StoryPage';
import { STORY_COPY } from '../../../components/story/copy';

import { websiteRoute } from '../../../lib/site-route';

const route = websiteRoute('/story', StoryPage, {
  title: { absolute: 'NYC-MON | The Story' },
  description: STORY_COPY.hero.body,
  alternates: { canonical: '/story' },
});
export const generateMetadata = route.generateMetadata;
export default route.Page;
