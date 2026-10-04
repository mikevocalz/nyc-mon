'use client';
// The native fork of CollapsiblePane: the same contract, with the width tween
// on the UI thread.
//
// WHY A FORK. The shared file animates width through Legend Motion, which is
// RN `Animated` and JS-driven for width. When the JS thread is also driving a
// render loop (a three.js or Skia scene in a pane), a JS-driven tween runs
// only in the gaps and the panes open in steps. Reanimated applies a `width` style from the UI thread and commits the
// layout itself, so the neighbours still reflow frame by frame — the whole
// reason this is a width animation and not a slide — without waiting on JS.
// Web keeps the Legend Motion file: Reanimated is native-only in this kit
// (README, "Animation boundary").
//
// The measurement dance (`measured`, `grown`) is copied, not reinvented; read
// the shared file for why a fill pane must animate from the width it grew to.
// SOT: ./CollapsiblePane.tsx · ./README.md
// SOT-KEYWORDS: collapsible pane width animate reanimated ui thread native fork
import { useEffect } from 'react';
// `runOnJS` from Reanimated rather than `scheduleOnRN` from react-native-worklets:
// @acme/ui declares Reanimated, not Worklets, and Reanimated 4 still exports it.
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { css } from '../html/css';
import { View } from '../tw';
import { useInstanceStore, useStore } from '../use-instance-store';
import type { CollapsiblePaneProps, PaneMeasure } from './CollapsiblePane';
import { TRANSITIONS } from './transitions.ts';

const AnimatedPane = css(Animated.View, 'CollapsiblePane');

// The same token as the shared file, read once. Reanimated has no string
// easing names, so the tween's `easeInOut` is spelled with its own curve.
const PANE_WIDTH = {
  duration: TRANSITIONS.paneWidth.duration,
  easing: Easing.inOut(Easing.ease),
};

export function CollapsiblePane({ width, open, fill, children, className }: CollapsiblePaneProps) {
  const pane = useInstanceStore<PaneMeasure>(() => ({ measured: null, grownStored: false }));
  const measured = useStore(pane, (state) => state.measured);
  const grownStored = useStore(pane, (state) => state.grownStored);
  // Derived, then cleared after commit — see the shared file.
  const grown = grownStored && open && Boolean(fill);
  useEffect(() => {
    if (!(open && fill) && pane.getState().grownStored) pane.setState({ grownStored: false });
  }, [open, fill, pane]);
  const setMeasured = (value: number) => pane.setState({ measured: value });
  const contentWidth = fill ? (measured ?? width) : width;
  const target = open ? contentWidth : 0;

  const paneWidth = useSharedValue(target);
  useEffect(() => {
    const markGrown = () => pane.setState({ grownStored: true });
    paneWidth.value = withTiming(target, PANE_WIDTH, (finished) => {
      'worklet';
      // `grown` is React state; the callback runs on the UI thread.
      if (finished && open && fill) runOnJS(markGrown)();
    });
  }, [paneWidth, target, open, fill, pane]);

  // The animated width is the flex BASIS once grown, and `grow` absorbs the
  // remainder — the same handoff the shared file describes.
  const style = useAnimatedStyle(() => ({ width: paneWidth.value }));

  return (
    <AnimatedPane
      style={style}
      onLayout={
        fill
          ? (event: { nativeEvent: { layout: { width: number } } }) => {
              const laid = event.nativeEvent.layout.width;
              if (grown && Math.abs(laid - (measured ?? 0)) > 1) setMeasured(laid);
            }
          : undefined
      }
      // A fill pane may also SHRINK below its token: on a hinge-snapped row
      // the planner can leave the trailing pane less than the token (200 dp of
      // an 840 dp book fold), and a basis that cannot shrink ran off-screen.
      className={`overflow-hidden ${fill ? 'shrink' : ''} ${grown ? 'grow' : ''} ${className ?? ''}`}
    >
      <View
        style={grown ? undefined : { width: contentWidth }}
        className="flex-1"
        aria-hidden={!open}
        pointerEvents={open ? 'auto' : 'none'}
      >
        {children}
      </View>
    </AnimatedPane>
  );
}
