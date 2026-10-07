import { View } from '@acme/ui/tw';
import { CareSection } from './CareSection';
import { DistrictDivider } from './DistrictDivider';
import { HatchBand } from './HatchBand';
import { HLynkSection } from './HLynkSection';
import { HomeHero } from './HomeHero';
import { MarqueeBand } from './MarqueeBand';
import { MotionRoot } from './MotionRoot';
import { StartersSection, starterCards } from './StartersSection';
import { WorldSection } from './WorldSection';

/**
 * W01, the product site's home page. Contract: docs/design/screens/W01/08-handoff.md.
 * Storyboard (§05): hero → signage band → world → H-Lynk → starters → care →
 * hatch → footer. MotionRoot wraps the whole page in the Kinetrell clock —
 * under reduced motion it renders the same tree with no choreography.
 */
export function HomePage() {
  const cards = starterCards();
  return (
    <MotionRoot>
      <View className="w-full flex-1 bg-bg">
        <HomeHero starters={cards.map((c) => c.babyName)} />
        <MarqueeBand />
        <WorldSection />
        <DistrictDivider seed={3} />
        <HLynkSection />
        <StartersSection cards={cards} />
        <DistrictDivider seed={11} />
        <CareSection />
        <HatchBand />
      </View>
    </MotionRoot>
  );
}
