import type { Metadata } from 'next';
import { StoryPage } from '../../../components/story/StoryPage';
import { STORY_COPY } from '../../../components/story/copy';

export const metadata: Metadata = {
  title: { absolute: 'NYC-MON | The Story' },
  description: STORY_COPY.hero.body,
};

export default function Page() {
  return <StoryPage />;
}
