'use client';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { useResolveClassNames } from 'uniwind';
import { NIGHT_SCHEME, NightScope } from '../NightScope';
import { SafeArea } from '../SafeArea';
import { ScrollView, View } from '../tw';
import { planHLynkStageSplit } from './layout';
import { useHostPlacement } from './use-host-placement';

/**
 * The companion pane's visibility. Hidden below `md` (every phone in
 * portrait, which keeps today's layout); shown from `md` in both
 * orientations. Screens hide their in-screen copy of a pane's content with
 * the matching `md:hidden` on the whole container.
 */
export const HLYNK_STAGE_PANE_VISIBLE = 'hidden md:flex';

/**
 * The shell's slot while a pane is showing. Portrait: it takes the height the
 * pane below leaves. Landscape: one side of the open-foldable layout, never
 * wider than `HLYNK_STAGE_SHELL_MAX_PT` (592, under the brand pane's 600 pt
 * threshold), so the companion pane takes the brand pane's place instead of
 * becoming a third column.
 */
const SHELL_WITH_PANE = 'flex-1 md:landscape:flex-none md:landscape:w-[46%] md:landscape:max-w-[592px]';

/** The pane slot: under the shell in portrait (content height, capped), the other half in landscape. */
const PANE_SLOT = `${HLYNK_STAGE_PANE_VISIBLE} md:portrait:max-h-[45%] md:landscape:flex-1`;

export interface HLynkStageProps {
  /** The `HLynkShell`. */
  children: ReactNode;
  /** Companion content that leads the pane (M13: the name card and the Dex link). */
  leading?: ReactNode;
  /** Companion content that follows it (M14–M16 panels). */
  trailing?: ReactNode;
  testID?: string;
}

/**
 * The host for the companion loop's shell, and the open-foldable layout on
 * tablets. Decision H-2 struck the side panes on every window; Mike's
 * tablet instruction (2026-10-27) brings one companion pane back from `md`,
 * driven by breakpoint and orientation classes that update live on rotation:
 *
 * - Below `md` (phones in portrait): the shell alone, exactly as before.
 *   Screens draw the same content inside the H-Lynk screen.
 * - `md` portrait (tablet portrait): the shell on top, the pane below it at
 *   its content height (at most 45% of the window), leading and trailing
 *   side by side.
 * - `md` landscape (tablet landscape, phone landscape, desktop, the Quest
 *   window): the pane on the physical left, the shell on the right, each
 *   scrolling on its own. Physical, also in RTL, like the device in H-2.
 * - A fold that splits the stage overrides both: the pane ends where the
 *   first usable region ends (left of a vertical hinge, above a horizontal
 *   one) so nothing straddles it (`planHLynkStageSplit`).
 *
 * With no pane content the shell fills the stage and draws its own brand
 * pane, as in H-2. The tree never changes shape: the shell keeps one place,
 * so a route change or a rotation never remounts the device or the Mon
 * (foldable skill §6).
 */
export function HLynkStage({ children, leading, trailing, testID }: HLynkStageProps) {
  const { ref, onLayout, width, placement, isRTL } = useHostPlacement({ width: 375, height: 667 });
  const paneDisplay = useResolveClassNames(HLYNK_STAGE_PANE_VISIBLE) as { display?: string };
  const hasPane = leading != null || trailing != null;
  const paneShown = hasPane && paneDisplay.display !== 'none';
  const split = paneShown ? planHLynkStageSplit(placement.regions) : null;
  const direction = isRTL ? 'rtl' : 'ltr';
  const id = (part: string) => (testID ? `${testID}-${part}` : undefined);

  const rootStyle = { direction: 'ltr' as const, ...(split ? { flexDirection: split.axis === 'row' ? 'row-reverse' : 'column-reverse' } : null) };
  const shellStyle = split === null ? undefined
    : split.axis === 'row'
      ? { flexGrow: 1, flexShrink: 1, width: Math.max(0, width - split.panePt), maxWidth: Math.max(0, width - split.panePt) }
      : { flexGrow: 1, flexShrink: 1, width: '100%', maxWidth: '100%' };
  const paneStyle = split === null ? undefined
    : split.axis === 'row'
      ? { flexGrow: 0, flexShrink: 0, width: split.panePt }
      : { flexGrow: 0, flexShrink: 0, height: split.panePt, maxHeight: split.panePt };

  return (
    <View
      ref={ref as never}
      testID={testID}
      className="flex-1 bg-bg md:landscape:flex-row-reverse"
      style={rootStyle as object}
      onLayout={onLayout}
    >
      <View testID={id('shell')} className={hasPane ? SHELL_WITH_PANE : 'flex-1'} style={shellStyle as object}>
        {children}
      </View>
      <View testID={id('pane')} className={hasPane ? PANE_SLOT : 'hidden'} style={paneStyle as object}>
        <NightScope>
          <View className={`flex-1 bg-bg ${Platform.OS === 'web' ? NIGHT_SCHEME : ''}`} style={{ direction }}>
            <SafeArea className="flex-1" edges={['top', 'bottom', 'left', 'right']}>
              <ScrollView
                className="flex-1"
                contentContainerClassName="grow gap-6 p-6 md:portrait:flex-row md:portrait:justify-center md:landscape:justify-center"
              >
                {leading != null ? (
                  <View testID={id('leading')} className="w-full max-w-content-measure self-center md:portrait:flex-1 md:portrait:self-start">
                    {leading}
                  </View>
                ) : null}
                {trailing != null ? (
                  <View testID={id('trailing')} className="w-full max-w-content-measure self-center md:portrait:flex-1 md:portrait:self-start">
                    {trailing}
                  </View>
                ) : null}
              </ScrollView>
            </SafeArea>
          </View>
        </NightScope>
      </View>
    </View>
  );
}
