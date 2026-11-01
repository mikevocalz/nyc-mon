'use client';
// PLATFORM FORK (native): @rive-app/react-native plays state machines only, so
// the view always names `Loader`. Colours, phase and progress go through the
// view model (data binding), never the deprecated state-machine inputs.
import { useEffect } from 'react';
import {
  Fit,
  RiveView,
  useRiveColor,
  useRiveFile,
  useRiveNumber,
  useRiveString,
  useViewModelInstance,
} from '@rive-app/react-native';
import { useReducedMotion } from './backgrounds/use-reduced-motion';
import { progressA11y } from './progress/progress-model';
import {
  RIVE_LOADER_ARTBOARD,
  RIVE_LOADER_BINDINGS,
  RIVE_LOADER_MACHINE,
  RIVE_LOADER_VIEW_MODEL,
  clampRiveLoaderProgress,
  resolveRiveLoaderPhase,
  riveLoaderColors,
} from './rive-loader-bindings';
import { View } from './tw';
import type { RiveLoaderProps } from './RiveLoader.types';

// Built from rive/loader/scene.rml by rive/loader/build.sh and committed beside
// it. Metro bundles it as an asset (apps/mobile/metro.config.js assetExts).
const LOADER_RIV = require('./rive/loader/build/loader.riv');

export function RiveLoader({
  size = 160,
  phase = 'loading',
  progress,
  scheme = 'dark',
  label = 'Loading',
  className,
}: RiveLoaderProps) {
  const reduceMotion = useReducedMotion();
  const { riveFile } = useRiveFile(LOADER_RIV);
  const { instance } = useViewModelInstance(riveFile, { viewModelName: RIVE_LOADER_VIEW_MODEL, async: true });

  const { setValue: setRingPrimary } = useRiveColor(RIVE_LOADER_BINDINGS.ringPrimary, instance);
  const { setValue: setRingAccent } = useRiveColor(RIVE_LOADER_BINDINGS.ringAccent, instance);
  const { setValue: setCore } = useRiveColor(RIVE_LOADER_BINDINGS.core, instance);
  const { setValue: setTrack } = useRiveColor(RIVE_LOADER_BINDINGS.track, instance);
  const { setValue: setPhase } = useRiveString(RIVE_LOADER_BINDINGS.phase, instance);
  const { setValue: setProgress } = useRiveNumber(RIVE_LOADER_BINDINGS.progress, instance);

  useEffect(() => {
    const colors = riveLoaderColors(scheme);
    setRingPrimary(colors.ringPrimary);
    setRingAccent(colors.ringAccent);
    setCore(colors.core);
    setTrack(colors.track);
  }, [scheme, setRingPrimary, setRingAccent, setCore, setTrack]);

  const shownPhase = resolveRiveLoaderPhase(phase, reduceMotion);
  useEffect(() => {
    setPhase(shownPhase);
  }, [shownPhase, setPhase]);

  useEffect(() => {
    // An unknown amount leaves the frame empty rather than holding a stale fill.
    setProgress(progress === undefined ? 0 : clampRiveLoaderProgress(progress));
  }, [progress, setProgress]);

  return (
    <View
      {...progressA11y({ value: progress === undefined ? undefined : clampRiveLoaderProgress(progress) * 100, label })}
      className={className}
      // Square px size from the prop; the artboard is square.
      style={{ width: size, height: size }}
    >
      {riveFile && instance ? (
        <RiveView
          file={riveFile}
          artboardName={RIVE_LOADER_ARTBOARD}
          stateMachineName={RIVE_LOADER_MACHINE}
          dataBind={instance}
          autoPlay
          fit={Fit.Contain}
          // The wrapper reports progress; a Rive error must not take the screen down.
          onError={() => undefined}
          style={{ width: '100%', height: '100%' }}
        />
      ) : null}
    </View>
  );
}
