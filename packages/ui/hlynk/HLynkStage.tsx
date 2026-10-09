'use client';
import type { ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { View } from '../tw';

/**
 * Window width (dp) from which the stage opens its side panes: Material's
 * expanded class. The Quest 2D window defaults to 1280 and resizes from 360
 * to 1280, so the panes come and go with the window, never with the device.
 */
export const HLYNK_STAGE_WIDE_PT = 840;

/** True when the window is wide enough for {@linkcode HLynkStage} to show its side panes. */
export function useHLynkStageWide(): boolean {
  const { width } = useWindowDimensions();
  return width >= HLYNK_STAGE_WIDE_PT;
}

export interface HLynkStageProps {
  /** The `HLynkShell`. It keeps the flex centre column and caps itself at 440 pt. */
  children: ReactNode;
  /** Leading pane content on wide windows (M13: name card and the Dex link). Ignored on narrow windows. */
  leading?: ReactNode;
  /** Trailing pane content on wide windows (M14–M16 panels). Ignored on narrow windows. */
  trailing?: ReactNode;
  testID?: string;
}

/**
 * The H-Lynk shell with optional side panes (M13 "Quest 1280×800": shell 440
 * wide in the centre, panes either side). The centre column flexes; each pane
 * is a fixed `content-form` width, so the shell stays centred whether or not a
 * pane has content. Below {@linkcode HLYNK_STAGE_WIDE_PT} the panes are not
 * rendered and the screen draws the same content inside the shell. Width
 * comes from `useWindowDimensions`, so a user-resized window re-lays out live.
 */
export function HLynkStage({ children, leading, trailing, testID }: HLynkStageProps) {
  const wide = useHLynkStageWide();
  if (!wide) {
    return <View testID={testID} className="flex-1 bg-bg">{children}</View>;
  }
  return (
    <View testID={testID} className="flex-1 flex-row bg-bg">
      <View testID={testID ? `${testID}-leading` : undefined} className="w-content-form justify-center px-6">
        {leading}
      </View>
      <View className="flex-1">{children}</View>
      <View testID={testID ? `${testID}-trailing` : undefined} className="w-content-form justify-center px-6">
        {trailing}
      </View>
    </View>
  );
}
