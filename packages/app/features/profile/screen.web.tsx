'use client';
import { brand } from '@acme/theme';
import { View } from '@acme/ui/tw';
import { Container, GridFloor, SceneSection, SolidPanel } from '@acme/ui';
import { ProfileDetails, ProfileIdentity, ProfileOverview } from './profile-content';

/**
 * Web Profile: the Caller's identity on an ink plate over Harlem's street
 * grid (your block, the brownstone rows on the horizon), then tags, stats
 * and the account fields on the page surface.
 */
export function ProfileScreen() {
  return (
    <View className="mx-auto min-h-screen w-full flex-1 bg-surface pb-24">
      <SceneSection
        className="min-h-[480px] md:min-h-[520px]"
        placeholderColor={brand.night}
        scene={({ paused }) => (
          <GridFloor district="harlem" skyline horizon={0.36} speed={0.3} paused={paused} className="absolute inset-0" />
        )}
      >
        <Container width="detail" className="flex-1 justify-end py-10 md:py-14">
          <SolidPanel tone="ink" depth="lg" className="px-5 py-6 md:px-8 md:py-8">
            <ProfileIdentity surface="night" />
          </SolidPanel>
        </Container>
      </SceneSection>
      <Container width="detail" className="py-10 md:py-14">
        <View className="gap-6 md:gap-10 lg:gap-12">
          <ProfileOverview showEdit />
          <ProfileDetails />
        </View>
      </Container>
    </View>
  );
}
