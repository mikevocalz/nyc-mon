'use client';
import { brand } from '@acme/theme';
import { Main, View } from '@acme/ui/tw';
import { Container, GridFloor, SceneSection, SkylineDivider, SolidPanel } from '@acme/ui';
import { ExploreFeatured, ExploreLead, ExploreResources } from './explore-content';

/**
 * Web Explore: the lead (title, search, categories) on an ink plate over the
 * GridFloor, the street grid running towards a skyline, because exploring is
 * moving through the city. A Midtown skyline divides the featured rail from
 * the resource grid.
 */
export function ExploreScreen() {
  return (
    <Main className="min-h-screen w-full flex-1 bg-surface pb-24">
      <SceneSection
        className="min-h-[560px] md:min-h-[600px]"
        placeholderColor={brand.night}
        scene={({ paused }) => (
          <GridFloor district="midtown" skyline horizon={0.4} speed={0.4} paused={paused} className="absolute inset-0" />
        )}
      >
        <Container width="detail" className="flex-1 justify-end py-10 md:py-14">
          <SolidPanel tone="ink" depth="lg" className="px-5 py-6 md:px-8 md:py-8">
            <ExploreLead surface="night" />
          </SolidPanel>
        </Container>
      </SceneSection>
      <Container width="detail" className="py-10 md:py-14">
        <ExploreFeatured />
      </Container>
      <SkylineDivider district="midtown" seed={7} />
      <View className="py-10 md:py-14">
        <Container width="detail">
          <ExploreResources />
        </Container>
      </View>
    </Main>
  );
}
