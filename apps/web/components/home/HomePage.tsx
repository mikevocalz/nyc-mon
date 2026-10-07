import { View } from '@acme/ui/tw';
import { CareSection } from './CareSection';
import { DistrictDivider } from './DistrictDivider';
import { HatchBand } from './HatchBand';
import { HLynkSection } from './HLynkSection';
import { HomeHero } from './HomeHero';
import { MotionRoot } from './MotionRoot';
import { SignageBoard } from './SignageBoard';
import { StartersSection, starterCards } from './StartersSection';
import { WaitlistSection } from './WaitlistSection';
import { WorldSection } from './WorldSection';

/**
 * W01, the product site's home page. Contract: docs/design/screens/W01/08-handoff.md.
 * Order: hero → district board → world → H-Lynk → starters → care → hatch →
 * waitlist → footer. MotionRoot wraps the page in the Kinetrell clock; under reduced
 * motion it renders the same tree with no choreography.
 */
export function HomePage() {
  return (
    <MotionRoot>
      <View className="w-full flex-1 bg-bg">
        <HomeHero />
        <SignageBoard />
        <WorldSection />
        <DistrictDivider seed={3} />
        <HLynkSection />
        <StartersSection cards={starterCards()} />
        <DistrictDivider seed={11} />
        <CareSection />
        <HatchBand />
        <WaitlistSection />
      </View>
    </MotionRoot>
  );
}
