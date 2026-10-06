'use client';
// Web fold geometry (04-components.md G13, 08-handoff.md P8): the shipped
// Viewport Segments API (`window.viewport.segments`, Chrome on Android 138+)
// plus the Device Posture API where present, normalized into the same
// ReservedRegion shape iOS and Android report. A `ReservedRegionsOverride`
// (Storybook, tests) still wins so stories can drive a fake hinge.
//
// When `window.viewport` is undefined the browser is hinge-blind: the hook
// answers the empty list and callers fall back to width classes (test matrix:
// "browser without window.viewport" is recorded hinge-blind, never a pass).
// SOT-KEYWORDS: reserved regions folding feature web fork viewport segments device posture
import { useSyncExternalStore } from 'react';
import { useReservedRegionsOverride } from './reserved-regions-override';
import type { FoldState, ReservedRegion } from './reserved-regions.types';

export type {
  FoldOcclusionType,
  FoldOrientation,
  FoldState,
  ReservedRegion,
} from './reserved-regions.types';

// The DOM lib does not yet ship ViewportSegments/DevicePosture types, so they
// are declared narrowly here — exactly the surface read below, nothing more.
interface ViewportSegmentRect {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}
interface ViewportWithSegments extends EventTarget {
  readonly segments: readonly ViewportSegmentRect[] | null;
}
interface DevicePostureLike extends EventTarget {
  readonly type: 'continuous' | 'folded' | 'flat';
}
interface FoldableWindow {
  viewport?: ViewportWithSegments;
}
interface FoldableNavigator {
  devicePosture?: DevicePostureLike;
}

const NONE: readonly ReservedRegion[] = [];

function viewportOf(): ViewportWithSegments | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as Window & FoldableWindow).viewport;
}

function postureOf(): DevicePostureLike | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & FoldableNavigator).devicePosture;
}

/**
 * Turn the segment list into division regions: the gap between consecutive
 * segments is the hinge, in CSS px (which the pane row measures the same way).
 * Side-by-side segments give a vertical hinge (book posture when folded),
 * stacked segments a horizontal one (tabletop).
 */
function snapshot(): readonly ReservedRegion[] {
  const viewport = viewportOf();
  const segments = viewport?.segments;
  if (!viewport || !segments || segments.length < 2) return NONE;
  const folded = postureOf()?.type === 'folded';
  const state: FoldState = folded ? 'halfOpened' : 'flat';
  const regions: ReservedRegion[] = [];
  for (let i = 0; i < segments.length - 1; i += 1) {
    const a = segments[i]!;
    const b = segments[i + 1]!;
    if (a.bottom <= b.top || b.bottom <= a.top) {
      // Stacked segments: a horizontal hinge across the window's width.
      const top = Math.min(a.bottom, b.bottom);
      const bottom = Math.max(a.bottom, b.bottom) === a.bottom ? b.top : a.top;
      regions.push({
        kind: 'division',
        x: Math.min(a.left, b.left),
        y: top,
        width: Math.max(a.right, b.right) - Math.min(a.left, b.left),
        height: Math.max(0, bottom - top),
        margins: { top: 0, left: 0, bottom: 0, right: 0 },
        active: folded,
        orientation: 'horizontal',
        state,
        // A flat (fully open) fold is one continuous surface: the division
        // exists but does not separate content.
        separating: folded,
      });
    } else {
      // Side-by-side segments: a vertical hinge across the window's height.
      const left = Math.min(a.right, b.right);
      const right = Math.max(a.right, b.right) === a.right ? b.left : a.left;
      regions.push({
        kind: 'division',
        x: left,
        y: Math.min(a.top, b.top),
        width: Math.max(0, right - left),
        height: Math.max(a.bottom, b.bottom) - Math.min(a.top, b.top),
        margins: { top: 0, left: 0, bottom: 0, right: 0 },
        active: folded,
        orientation: 'vertical',
        state,
        separating: folded,
      });
    }
  }
  return regions;
}

function subscribe(onChange: () => void): () => void {
  const viewport = viewportOf();
  const posture = postureOf();
  window.addEventListener('resize', onChange);
  // Viewport segments and posture are EventTargets on the shipped surface.
  viewport?.addEventListener?.('change', onChange);
  posture?.addEventListener?.('change', onChange);
  return () => {
    window.removeEventListener('resize', onChange);
    viewport?.removeEventListener?.('change', onChange);
    posture?.removeEventListener?.('change', onChange);
  };
}

/**
 * The window's reserved regions: fold divisions and camera occlusions, in
 * CSS px, window-relative. Empty when the browser has no `window.viewport`
 * (hinge-blind), when the fold reports a single segment, or when a
 * `ReservedRegionsOverride` is not mounted above.
 */
export function useReservedRegions(): readonly ReservedRegion[] {
  const override = useReservedRegionsOverride();
  const regions = useSyncExternalStore(subscribe, snapshot, () => NONE);
  return override ?? regions;
}
