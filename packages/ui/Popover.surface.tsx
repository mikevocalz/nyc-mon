'use client';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from './tw';

/** Neutral source-owned instrument face; document pixels are never tinted. */
export function PopoverSurface({
  title, children, width = 344, maxHeight = 520,
}: {
  title?: string;
  children: ReactNode;
  width?: number;
  maxHeight?: number;
}) {
  return (
    <View
      style={{ width, maxHeight }}
      className="rounded-sm border border-border bg-surface-raised"
    >
      {title ? (
        <View className="min-h-11 justify-center border-b border-border px-4 py-2">
          <Text className="text-sm font-semibold text-text" accessibilityRole="header">
            {title}
          </Text>
        </View>
      ) : null}
      <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: title ? maxHeight - 44 : maxHeight }}>
        <View className="p-4">{children}</View>
      </ScrollView>
    </View>
  );
}

/** Trigger is intentionally owned by /ui, never supplied as an interactive child. */
export function PopoverTrigger({
  label, expanded, children, onPress,
}: {
  label: string;
  expanded: boolean;
  children: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded }}
      onPress={onPress}
      className="min-h-12 min-w-12 items-center justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-primary"
    >
      {children}
    </Pressable>
  );
}
