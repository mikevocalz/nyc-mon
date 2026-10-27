'use client';
import type { ReactNode } from 'react';
import { ScrollView, View } from '@acme/ui/tw';
import { Container, SafeArea } from '@acme/ui';
import { SETTINGS_GRID, SettingsAccountCards, SettingsDeviceCards, SettingsHeader } from './settings-content';

/*
  Two arrangements, both mounted, switched by class only (no JS width checks;
  Uniwind's landscape: updates live on rotation):

  - Phones and tablets in portrait: one top-aligned column in reading order.
    From md the column widens to content-wide and the cards pair into two
    columns (Preferences | Appearance, Graphics | Game); Legal & credits and
    Session span the width below them. Below md nothing changes.
  - Landscape from md: two panes like an open foldable. The device settings
    (Preferences, Appearance, Graphics, Game) on the left, the account cards
    (Legal & credits, Session) on the right; each pane scrolls on its own.

  Every value lives in a store, so rotating between the trees loses nothing.

  `leading` sits above both arrangements: the Settings glass's 2D fallback
  puts its Back control there, since the (home) group has no stack header.
*/
export function SettingsScreen({ leading }: { leading?: ReactNode } = {}) {
  return (
    <SafeArea edges={['top']} className="flex-1 bg-surface">
      {leading}
      <View className="flex-1 md:landscape:hidden">
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <Container width="detail" className="py-4 pb-48 md:max-w-content-wide md:py-8">
            <View className="gap-6 md:gap-10 lg:gap-12">
              <SettingsHeader />
              <View className={SETTINGS_GRID}>
                <SettingsDeviceCards grid />
                <SettingsAccountCards grid />
              </View>
            </View>
          </Container>
        </ScrollView>
      </View>

      <View className="hidden flex-1 flex-row md:landscape:flex">
        <ScrollView className="flex-1 border-r-2 border-border" showsVerticalScrollIndicator={false}>
          <View className="gap-6 px-6 py-8 pb-48 lg:gap-10">
            <SettingsHeader />
            <SettingsDeviceCards />
          </View>
        </ScrollView>
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="gap-6 px-6 py-8 pb-48 lg:gap-10">
            <SettingsAccountCards />
          </View>
        </ScrollView>
      </View>
    </SafeArea>
  );
}
