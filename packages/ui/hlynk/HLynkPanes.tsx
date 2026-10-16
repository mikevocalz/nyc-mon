'use client';
// The H-Lynk's two panes on either arrangement backend (foldable skill §9).
// `HLynkBox` is the box a pane gives its content: told its size by the
// fallback planner, or measuring itself inside a native Arrangement View pane.
// `HLynkFallbackPanes` is the existing planner path (Decision H-2) for web,
// SSR, XR and iOS before 27.1.
// SOT-KEYWORDS: hlynk arrangement pane box fallback brand device duo centre
import type { ReactNode } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { View } from '../tw';
import { useInstanceStore, useStore } from '../use-instance-store';
import type { HLynkRect, ShellLayout } from './layout';
import { useHostPlacement } from './use-host-placement';

export interface HLynkBoxSize {
  width: number;
  height: number;
}

/**
 * A pane's content box. With `size` (fallback planner) it draws at once; without
 * (native pane) it measures itself and draws nothing until the first layout,
 * so the device is never sized from a guess. The children get the box size.
 */
export function HLynkBox({ size, children, testID }: { size?: HLynkBoxSize; children: (size: HLynkBoxSize) => ReactNode; testID?: string }) {
  const store = useInstanceStore<HLynkBoxSize>(() => ({ width: 0, height: 0 }));
  const measured = useStore(store);
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const c = store.getState();
    if (c.width !== width || c.height !== height) store.setState({ width, height });
  };
  const box = size ?? measured;
  return (
    <View testID={testID} className="flex-1" style={{ alignSelf: 'stretch' }} onLayout={size ? undefined : onLayout}>
      {box.width > 0 && box.height > 0 ? children(box) : null}
    </View>
  );
}

export interface HLynkFallbackPanesProps {
  force?: ShellLayout;
  railRightPt: number;
  device: (size: HLynkBoxSize) => ReactNode;
  brand: (size: HLynkBoxSize) => ReactNode;
  testIDPrefix?: string;
}

/**
 * Brand left, device right, from the pure planner and `useReservedRegions`
 * (Decision H-2). Regions are physical, so the host lays out left-to-right
 * and each region restores the locale's direction. Stable keys: folding moves
 * the device region and adds or drops the brand pane, never remounting the
 * device (skill §6).
 */
export function HLynkFallbackPanes({ force, railRightPt, device, brand, testIDPrefix }: HLynkFallbackPanesProps) {
  const { ref, onLayout, placement, isRTL } = useHostPlacement({ width: 375, height: 667 }, force, railRightPt);
  const direction = isRTL ? 'rtl' : 'ltr';
  const rect = (r: HLynkRect) => ({ position: 'absolute' as const, left: r.x, top: r.y, width: r.width, height: r.height, direction });
  const id = (part: string) => (testIDPrefix ? `${testIDPrefix}-${part}` : undefined);
  return (
    <View ref={ref as never} className="flex-1" style={{ direction: 'ltr' }} onLayout={onLayout}>
      {placement.brand ? (
        <View key="brand" style={rect(placement.brand) as object}>
          {brand({ width: placement.brand.width, height: placement.brand.height })}
        </View>
      ) : null}
      <View key="device" testID={id('device-region')} style={rect(placement.device) as object}>
        <HLynkBox size={{ width: placement.device.width, height: placement.device.height }}>{device}</HLynkBox>
      </View>
    </View>
  );
}
