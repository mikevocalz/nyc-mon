'use client';
// The device plus its companion pane, for every screen that shows the 3D
// H-Lynk: the persistent `(home)` stage and M08, M10, M11 with their own
// DeviceStage. Policy in companion-layout.ts (pure, tested).
// SOT: docs/design/foldable-arrangements.md ("Companion pane on the persistent stage")
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { I18nManager, Platform, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { useInstanceStore, useStore } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { foldLayoutsFromRegions, useAdaptiveNavigationPlacement, useReservedRegions } from '@acme/ui/adaptive-panes/parts';
import { hostFolds, planCompanion, stageFrameFor } from './companion-layout';
import type { StageFrame } from './home-stage.store';

/** Tailwind's md on native (rem 14: 48rem = 672 pt). Below it the stage keeps the phone layout. */
export const COMPANION_MIN_WINDOW_PT = 672;

/**
 * Whether this window gets the companion pane, and the glass canvas scale.
 * Native: only rail hardware (tablet, foldable, headset; never a phone, so a
 * landscape phone keeps its single device) at md width or more. Web: md width.
 * The glass renders at 2x on that hardware for crisp text at the larger size.
 */
export function useTabletClass(): { companion: boolean; glassScale: number } {
  const { width } = useWindowDimensions();
  const placement = useAdaptiveNavigationPlacement();
  const web = Platform.OS === 'web';
  const hardware = web ? width >= COMPANION_MIN_WINDOW_PT : placement.rail;
  return { companion: hardware && width >= COMPANION_MIN_WINDOW_PT, glassScale: hardware ? 2 : 1 };
}

/**
 * The stage host: the device alone (phones), or the device beside its
 * companion pane (landscape: pane on the physical left, device on the right;
 * portrait: device in a band on top, pane below), split at a hinge when one
 * runs through the host. The pane, gap and device slots keep their places in
 * the tree in every arrangement, so rotating, folding or resizing never
 * remounts the device (foldable skill §6); only their sizes and the flex
 * direction change. Reports the device's box to the store for overlays.
 */
export function CompanionStageHost({ enabled, device, pane, onFrame }: {
  readonly enabled: boolean;
  readonly device: ReactNode;
  /** The companion pane; rendered only while the plan shows it. */
  readonly pane: ReactNode;
  /** Gets the device's box (relative to this host's parent) or null when the device has the whole host. */
  readonly onFrame?: (frame: StageFrame | null) => void;
}) {
  const geometry = useInstanceStore(() => ({ x: 0, y: 0, width: null as number | null, height: null as number | null }));
  const size = useStore(geometry, useShallow((g) => ({ width: g.width, height: g.height, x: g.x, y: g.y })));
  const hostRef = useRef<{ measureInWindow?: (cb: (x: number, y: number) => void) => void } | null>(null);
  const regions = useReservedRegions();
  const folds = size.width === null || size.height === null
    ? []
    : hostFolds(foldLayoutsFromRegions(regions), { x: size.x, y: size.y }, { width: size.width, height: size.height });
  const plan = planCompanion({ enabled, width: size.width, height: size.height, folds });
  const frame = plan.kind === 'single' || size.width === null || size.height === null ? null : stageFrameFor(plan, size.width, size.height);
  // The route overlay layer covers the whole stage host, which starts at the
  // SafeArea's outer edge; the frame is shifted by this host's own offset in it.
  const offset = useInstanceStore(() => ({ x: 0, y: 0 }));
  const frameRef = useInstanceStore(() => ({ onFrame }));
  useLayoutEffect(() => {
    frameRef.setState({ onFrame });
    if (onFrame === undefined) return;
    if (frame === null) onFrame(null);
    else {
      const o = offset.getState();
      onFrame({ x: frame.x + o.x, y: frame.y + o.y, width: frame.width, height: frame.height });
    }
  });
  useLayoutEffect(() => () => frameRef.getState().onFrame?.(null), [frameRef]);
  const onLayout = (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    offset.setState({ x, y });
    geometry.setState({ width, height });
    // Folds arrive in window coordinates; the host's window origin turns them host-local.
    hostRef.current?.measureInWindow?.((wx, wy) => geometry.setState({ x: wx, y: wy }));
  };
  const rtl = I18nManager.isRTL;
  const direction = plan.kind === 'column' ? 'flex-col-reverse' : rtl ? 'flex-row-reverse' : 'flex-row';
  const paneStyle = plan.kind === 'row' ? { width: plan.paneWidth } : undefined;
  const gapStyle = plan.kind === 'row' ? { width: plan.gap } : plan.kind === 'column' ? { height: plan.gap } : undefined;
  const deviceStyle = plan.kind === 'column' ? { height: plan.stageHeight } : undefined;
  const showPane = plan.kind !== 'single';
  return (
    <View ref={hostRef as never} onLayout={onLayout} className={`min-h-0 flex-1 ${direction}`} testID="home-stage-host">
      <View
        testID="home-companion-pane"
        className={showPane ? `min-h-0 bg-bg ${plan.kind === 'column' ? 'flex-1' : ''}` : 'hidden'}
        style={paneStyle}
      >
        {showPane ? pane : null}
      </View>
      <View className={showPane ? '' : 'hidden'} style={gapStyle} aria-hidden />
      <View className={`relative min-h-0 ${plan.kind === 'column' ? '' : 'flex-1'}`} style={deviceStyle}>
        {device}
      </View>
    </View>
  );
}

