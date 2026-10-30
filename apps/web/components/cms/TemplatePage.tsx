import type { WebsitePageProps } from './PageContent';
import { HomePage } from '../home/HomePage';
import { StoryPage } from '../story/StoryPage';
import { CityPage } from '../city/CityPage';
import { HowItWorksPage } from '../how-it-works/HowItWorksPage';
import { MonsIndexPage } from '../mons/MonsIndexPage';
import { MonsDetailPage } from '../mons/MonsDetailPage';
import { starterBySlug } from '../mons/starters';
import { GetPage } from '../get/GetPage';
import { PrivacyPage } from '../legal/PrivacyPage';
import { TermsPage } from '../legal/TermsPage';
import { ChildrensPrivacyPage } from '../legal/ChildrensPrivacyPage';
import { CustomPage } from './CustomPage';
export function TemplatePage(props: WebsitePageProps) {
  const route = props.page?.route;
  if (route === '/') return <HomePage {...props} />;
  if (route === '/story') return <StoryPage {...props} />;
  if (route === '/city') return <CityPage {...props} />;
  if (route === '/how-it-works') return <HowItWorksPage {...props} />;
  if (route === '/mons') return <MonsIndexPage {...props} />;
  if (route === '/get') return <GetPage {...props} />;
  if (route === '/legal/privacy') return <PrivacyPage {...props} />;
  if (route === '/legal/terms') return <TermsPage {...props} />;
  if (route === '/legal/childrens-privacy') return <ChildrensPrivacyPage {...props} />;
  if (route?.startsWith('/mons/')) { const starter = starterBySlug(route.slice(6)); if (starter) return <MonsDetailPage {...props} starter={starter} />; }
  return <CustomPage {...props} />;
}
