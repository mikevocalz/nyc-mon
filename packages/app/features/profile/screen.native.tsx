'use client';
import { ScrollView, View } from '@acme/ui/tw';
import { Container, SafeArea } from '@acme/ui';
import { ProfileDetails, ProfileSummary } from './profile-content';

/*
  Two arrangements, both mounted, switched by class only (no JS width checks;
  Uniwind's landscape: updates live on rotation):

  - Phones and tablets in portrait: one top-aligned column, identity first,
    the way into Settings below it. From md the column widens to
    content-wide. Below md nothing changes.
  - Landscape from md: two panes like an open foldable. Identity on the left,
    the details on the right; each pane scrolls on its own.
*/
export function ProfileScreen() {
  return (
    <SafeArea edges={['top']} className="flex-1 bg-surface">
      <View className="flex-1 md:landscape:hidden">
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <Container width="detail" className="py-4 pb-48 md:max-w-content-wide md:py-8">
            <View className="gap-6 md:gap-10 lg:gap-12">
              <ProfileSummary />
              <ProfileDetails />
            </View>
          </Container>
        </ScrollView>
      </View>

      <View className="hidden flex-1 flex-row md:landscape:flex">
        <ScrollView
          className="w-content-form shrink-0 border-r-2 border-border"
          showsVerticalScrollIndicator={false}
        >
          <View className="px-6 py-8 pb-48">
            <ProfileSummary />
          </View>
        </ScrollView>
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <Container width="screen" className="py-8 pb-48">
            <ProfileDetails />
          </Container>
        </ScrollView>
      </View>
    </SafeArea>
  );
}
