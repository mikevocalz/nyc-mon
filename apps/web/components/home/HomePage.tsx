import { View } from '@acme/ui/tw';
import { CareSection } from './CareSection';
import { DistrictDivider } from './DistrictDivider';
import { HatchBand } from './HatchBand';
import { HLynkSection } from './HLynkSection';
import { HomeHero } from './HomeHero';
import { HomeMotion } from './HomeMotion';
import { SignageBoard } from './SignageBoard';
import { StartersSection, starterCards } from './StartersSection';
import { WaitlistSection } from './WaitlistSection';
import { WorldSection } from './WorldSection';

/**
 * W01, the product site's home page. Contract: docs/design/screens/W01/08-handoff.md.
 * Order: hero → district board → world → H-Lynk → starters → care → hatch →
 * waitlist → footer. The sections are server HTML; HomeMotion loads the
 * Kinetrell clock after hydration and binds the choreography to them by id.
 */
export function HomePage() {
  return (
    <>
      <HomeMotion />
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
    </>
  );
}
