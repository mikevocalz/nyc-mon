'use client';
import { ScrollView, View } from '@acme/ui/tw';
import { Container, SafeArea } from '@acme/ui';
import { NotificationsList, NotificationsSummary } from './notifications-content';

/*
  Two arrangements, both mounted, switched by class only (no JS width checks;
  Uniwind's landscape: updates live on rotation):

  - Phones and tablets in portrait: one top-aligned column. From md the
    column widens to content-wide and each group's rows pair into two
    columns. Below md nothing changes.
  - Landscape from md (iPad 11 and Pro, a phone in landscape): two panes
    like an open foldable. The summary (title, unread, Mark all read, the
    notifications-off status) on the left, the Today/Earlier list on the
    right; each pane scrolls on its own.

  The store owns read state, so rotating between the trees loses nothing.
*/
export function NotificationsScreen() {
  return (
    <SafeArea edges={['top']} className="flex-1 bg-surface">
      <View className="flex-1 md:landscape:hidden">
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <Container width="detail" className="py-4 pb-48 md:max-w-content-wide md:py-8">
            <View className="gap-6 md:gap-10 lg:gap-12">
              <NotificationsSummary />
              <NotificationsList grid />
            </View>
          </Container>
        </ScrollView>
      </View>

      <View className="hidden flex-1 flex-row md:landscape:flex">
        <ScrollView
          className="w-content-form shrink-0 border-r-2 border-border"
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-6 px-6 py-8 pb-48 lg:gap-10">
            <NotificationsSummary />
          </View>
        </ScrollView>
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <Container width="screen" className="py-8 pb-48">
            <View className="gap-6 md:gap-10 lg:gap-12">
              <NotificationsList />
            </View>
          </Container>
        </ScrollView>
      </View>
    </SafeArea>
  );
}
