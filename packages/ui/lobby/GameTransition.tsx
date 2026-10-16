'use client';
// The opaque cover between the lobby and the first gameplay frame (Master
// Directive v2 §3 "Resume sequence"; G02 08-handoff.md § Motion). The host
// owns `phase` and writes it to `transition/phase`: `enter` when START
// resolves to a load, `hold` while the world builds, `reveal` once the
// resumed frame is ready, `done` after the cover has gone. The
// `game-transition` artboard draws the enter, hold and reveal; this host
// never advances a phase on its own, so an interrupted load can jump to
// `done` from anywhere. Reduced motion is the artboard's authored sibling
// (plain fades) chosen by `a11y/reducedMotion`; without the artboard the
// cover is a solid page face that drops at `done`.
import { useEffect } from 'react';
import { testIdProps } from '../hlynk/a11y';
import { View } from '../tw';
import { ProgressBar, percentLabel, progressFraction } from '../progress';
import { Text } from '../Text';
import type { ArcadeRiveSource } from '../game-controls/ArcadeRiveSurface.types.ts';
import type { ThemeVariant, TransitionPhase } from './lobby-contract.ts';
import { LobbyRiveSurface } from './LobbyRiveSurface';
import { useLobbyRiveBinding } from './use-lobby-rive-binding.ts';

/** Props of {@linkcode GameTransition}. */
export interface GameTransitionProps {
  readonly phase: TransitionPhase;
  readonly reducedMotion: boolean;
  /** Page scheme, written to `theme/variant`. @default 'night' */
  readonly scheme?: ThemeVariant;
  /** The `game-transition` artboard. Absent: a solid cover. */
  readonly rive?: ArcadeRiveSource;
  /** World load, 0..100, shown as the skyline bar with its percentage while the cover holds. Absent: no bar. */
  readonly progress?: number;
  /** What is loading, for the bar's label and screen readers. @default 'Loading' */
  readonly progressLabel?: string;
  readonly testID?: string;
}

/**
 * Full-bleed cover. Renders nothing at `done`; otherwise fills its parent
 * and swallows touches so nothing under it can be pressed mid-load.
 *
 * @see {@linkcode GameTransitionProps}
 */
export function GameTransition({ phase, reducedMotion, scheme = 'night', rive, progress, progressLabel = 'Loading', testID }: GameTransitionProps) {
  const binding = useLobbyRiveBinding((b) => {
    b.setTransitionPhase(phase);
    b.setTheme(scheme);
    b.setReducedMotion(reducedMotion);
  });
  useEffect(() => { binding.write((b) => b.setTransitionPhase(phase)); }, [binding, phase]);
  useEffect(() => { binding.write((b) => b.setTheme(scheme)); }, [binding, scheme]);
  useEffect(() => { binding.write((b) => b.setReducedMotion(reducedMotion)); }, [binding, reducedMotion]);

  if (phase === 'done') return null;
  return (
    <View
      {...(testIdProps(testID) as object)}
      testID={testID}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={`absolute inset-0 ${scheme === 'night' ? 'bg-ink-950' : 'bg-concrete-50'}`}
    >
      <LobbyRiveSurface
        riveFile={rive?.file}
        artboardName={rive?.artboardName}
        stateMachineName={rive?.stateMachineName}
        onBinding={binding.onBinding}
        style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
      />
      {phase === 'hold' && progress !== undefined ? (
        <View className="absolute inset-0 items-center justify-center px-8" pointerEvents="none">
          <View className="w-full max-w-[420px] gap-2">
            {/* The cover is painted by its own scheme, not the app theme, so the label takes the cover's ink directly. */}
            <View className="flex-row justify-between" aria-hidden>
              <Text className={`text-sm font-semibold ${scheme === 'night' ? 'text-ink-50' : 'text-ink-950'}`}>{progressLabel}</Text>
              <Text className={`font-display text-sm ${scheme === 'night' ? 'text-ink-50' : 'text-ink-950'}`}>{percentLabel(progressFraction(progress, 100))}</Text>
            </View>
            <ProgressBar value={progress} district="harlem" size="lg" accessibilityLabel={progressLabel} />
          </View>
        </View>
      ) : null}
    </View>
  );
}
