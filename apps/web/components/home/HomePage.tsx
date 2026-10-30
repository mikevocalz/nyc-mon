import { Fragment, type ReactNode } from 'react';
import { orderedSectionKeys, sectionFor, type SitePage } from '@acme/content/site-content';
import { View } from '@acme/ui/tw';
import { SectionContent } from '../cms/SectionContent';
import { CareSection } from './CareSection';
import { DistrictDivider } from './DistrictDivider';
import { GridBand } from './GridBand';
import { HatchBand } from './HatchBand';
import { HLynkSection } from './HLynkSection';
import { HomeHero } from './HomeHero';
import { HomeMotion } from './HomeMotion';
import { SignageBoard } from './SignageBoard';
import { StartersSection, starterCards } from './StartersSection';
import { WaitlistSection } from './WaitlistSection';
import { WorldSection } from './WorldSection';

export const HOME_SECTION_KEYS = ['hero', 'signage', 'world', 'district-divider', 'hlynk', 'starters', 'grid', 'care', 'hatch', 'waitlist'] as const;

/** Original markup is the bootstrap fallback. No CMS record mutates gameplay or shared copy constants. */
export function HomePage({ page, embedOrigins = [], siteOrigin = '' }: { page?: SitePage | null; embedOrigins?: string[]; siteOrigin?: string } = {}) {
  const native: Record<string, ReactNode> = {
    hero: <HomeHero cms={sectionFor(page, 'hero')} />,
    signage: <SignageBoard cms={sectionFor(page, 'signage')} />,
    world: <WorldSection cms={sectionFor(page, 'world')} />,
    'district-divider': <DistrictDivider seed={3} />,
    hlynk: <HLynkSection cms={sectionFor(page, 'hlynk')} />,
    starters: <StartersSection cards={starterCards()} cms={sectionFor(page, 'starters')} />,
    grid: <GridBand cms={sectionFor(page, 'grid')} />,
    care: <CareSection cms={sectionFor(page, 'care')} />,
    hatch: <HatchBand cms={sectionFor(page, 'hatch')} />,
    waitlist: <WaitlistSection cms={sectionFor(page, 'waitlist')} />,
  };
  const order = orderedSectionKeys(page, HOME_SECTION_KEYS);
  // The authored timeline assumes all original targets and their order. A custom layout remains visible but does not run that timeline.
  const customLayout = order.filter((key) => HOME_SECTION_KEYS.includes(key as typeof HOME_SECTION_KEYS[number])).join('|') !== HOME_SECTION_KEYS.join('|') || page?.sections.some((section) => section.hidden);
  return <>
    {customLayout ? null : <HomeMotion />}
    <View className="w-full flex-1 bg-bg">
      {order.map((key) => {
        const section = sectionFor(page, key);
        return section?.hidden ? null : <Fragment key={key}>
          {Object.hasOwn(native, key) ? native[key] : null}
          <SectionContent section={section} origins={embedOrigins} siteOrigin={siteOrigin} />
        </Fragment>;
      })}
    </View>
  </>;
}
