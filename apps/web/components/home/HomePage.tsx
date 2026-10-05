import { Main } from '@acme/ui/html';
import { CareSection } from './CareSection';
import { DistrictDivider } from './DistrictDivider';
import { HatchBand } from './HatchBand';
import { HLynkSection } from './HLynkSection';
import { HomeHero } from './HomeHero';
import { MarqueeBand } from './MarqueeBand';
import { StartersSection, starterCards } from './StartersSection';

/** W01, the product site's home page. Contract: docs/design/screens/W01/08-handoff.md. */
export function HomePage() {
  const cards = starterCards();
  return (
    <Main className="w-full flex-1 bg-bg">
      <HomeHero starters={cards.map((c) => c.babyName)} />
      <MarqueeBand />
      <DistrictDivider seed={3} />
      <HLynkSection />
      <StartersSection cards={cards} />
      <DistrictDivider seed={11} />
      <CareSection />
      <HatchBand />
    </Main>
  );
}
