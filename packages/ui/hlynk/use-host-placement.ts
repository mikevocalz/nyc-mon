'use client';
// Live host geometry for the H-Lynk chrome: the host's measured size, its
// window origin, and every reserved region converted to host-local x AND y.
// Feeds the pure planHLynkPlacement (layout.ts). Folds are converted once,
// on both axes (useFoldLayouts converts x only). Until the first layout pass
// the host reports the phone default and no folds: snapping to a fold before
// the origin is known would be worse than not snapping.
// SOT-KEYWORDS: hlynk shell fold hinge placement duo brand pane
import { useRef, type RefObject } from 'react';
import { I18nManager, type LayoutChangeEvent } from 'react-native';
import { foldLayoutsFromRegions } from '../adaptive-panes/fold-layout';
import { useReservedRegions } from '../reserved-regions';
import { useInstanceStore, useStore } from '../use-instance-store';
import { planHLynkPlacement, type HLynkPlacement, type ShellLayout } from './layout';

interface HostGeometry {
  width: number;
  height: number;
  originX: number;
  originY: number;
  measured: boolean;
}

interface Measurable {
  measureInWindow?: (callback: (x: number, y: number) => void) => void;
}

export interface HostPlacement {
  /** Spread onto the host view (cast: the kit View's ref type is the web element). */
  ref: RefObject<Measurable | null>;
  onLayout: (event: LayoutChangeEvent) => void;
  width: number;
  height: number;
  placement: HLynkPlacement;
  /** For each region's inner text direction only; placement is physical. */
  isRTL: boolean;
}

/** Measure a host view and plan where the device and brand pane go inside it. */
export function useHostPlacement(initial: { width: number; height: number }, force?: ShellLayout, railRightPt = 0): HostPlacement {
  const regions = useReservedRegions();
  const geometry = useInstanceStore<HostGeometry>(() => ({ ...initial, originX: 0, originY: 0, measured: false }));
  const { width, height, originX, originY, measured } = useStore(geometry);
  const ref = useRef<Measurable | null>(null);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    const apply = (x: number, y: number) => {
      const c = geometry.getState();
      if (!c.measured || c.width !== w || c.height !== h || c.originX !== x || c.originY !== y) {
        geometry.setState({ width: w, height: h, originX: x, originY: y, measured: true });
      }
    };
    if (ref.current?.measureInWindow) ref.current.measureInWindow(apply);
    else apply(0, 0);
  };

  const folds = measured ? foldLayoutsFromRegions(regions, originX).map((f) => ({ ...f, y: f.y - originY })) : [];
  const isRTL = I18nManager.isRTL;
  const placement = planHLynkPlacement({ widthPt: width, heightPt: height, folds, railRightPt, force });
  return { ref, onLayout, width, height, placement, isRTL };
}
