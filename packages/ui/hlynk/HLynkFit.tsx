'use client';
import { useEffect, type ReactNode } from 'react';
import { useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { View } from '../tw';
import { useInstanceStore, useStore } from '../use-instance-store';
import { fitHLynkContent, type FitBlock, type FitResult, type FitStepIndex } from './content-fit';

/** What a fitted screen knows about its space when it describes and draws its content. */
export interface HLynkFitContext {
  widthPt: number;
  heightPt: number;
  fontScale: number;
}

export interface HLynkFitProps {
  ramp: 'mobile' | 'xr';
  /** The step's content, top to bottom, as the fit sees it. */
  blocks: (ctx: HLynkFitContext) => readonly FitBlock[];
  /** @default 'stack' */
  arrangement?: (ctx: HLynkFitContext) => 'stack' | 'side';
  /** Draws the content with the chosen ladder step and media size. */
  children: (fit: FitResult, ctx: HLynkFitContext) => ReactNode;
  testID?: string;
}

interface FitState {
  width: number;
  height: number;
  natural: number;
  minStep: FitStepIndex;
}

function isDev(): boolean {
  const g = globalThis as { __DEV__?: boolean; process?: { env?: { NODE_ENV?: string } } };
  return typeof g.__DEV__ === 'boolean' ? g.__DEV__ : g.process?.env?.NODE_ENV !== 'production';
}

/**
 * The H-Lynk screen's content without scrolling (Decision H-3,
 * docs/design/hlynk/ADAPTIVE.md). Measures the space the screen gives it,
 * asks {@linkcode fitHLynkContent} for the largest ladder step that fits,
 * and draws `children` with that step. A measured check backs the estimate:
 * if the drawn content is still taller than the screen it steps down again,
 * and at the last step it warns in development with the exact sizes (a layout
 * finding), never adding a scroll view. A new screen size starts over at the
 * authored step.
 */
export function HLynkFit({ ramp, blocks, arrangement, children, testID }: HLynkFitProps) {
  const { fontScale } = useWindowDimensions();
  const store = useInstanceStore<FitState>(() => ({ width: 0, height: 0, natural: 0, minStep: 0 }));
  const { width, height, natural, minStep } = useStore(store);

  const ctx: HLynkFitContext = { widthPt: width, heightPt: height, fontScale };
  const fit = fitHLynkContent({
    widthPt: width,
    heightPt: height,
    fontScale,
    ramp,
    blocks: blocks(ctx),
    arrangement: arrangement?.(ctx) ?? 'stack',
    minStep,
  });

  const onArea = (event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    const c = store.getState();
    if (c.width !== w || c.height !== h) store.setState({ width: w, height: h, natural: 0, minStep: 0 });
  };
  const onContent = (event: LayoutChangeEvent) => {
    const h = event.nativeEvent.layout.height;
    if (store.getState().natural !== h) store.setState({ natural: h });
  };

  // Measured overflow: step down once per pass until it fits or the ladder ends.
  const overflow = height > 0 && natural > height + 0.5;
  useEffect(() => {
    if (!overflow) return;
    if (fit.step < 2) {
      store.setState({ minStep: (fit.step + 1) as FitStepIndex });
    } else if (isDev()) {
      console.warn(`HLynkFit${testID ? ` ${testID}` : ''}: content ${Math.round(natural)} pt > screen ${Math.round(width)}×${Math.round(height)} pt at the minimum step (font scale ${fontScale})`);
    }
  }, [overflow, fit.step, natural, width, height, fontScale, testID, store]);

  return (
    <View testID={testID} className="flex-1 overflow-hidden" onLayout={onArea}>
      {width > 0 ? (
        <View onLayout={onContent} style={{ flexGrow: 1, flexShrink: 0, padding: fit.type.padPt }}>
          {children(fit, ctx)}
        </View>
      ) : null}
    </View>
  );
}
