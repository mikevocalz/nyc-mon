'use client';
// PLATFORM FORK (native): mirrors ../game-controls/ArcadeRiveSurface.native.tsx
// on @rive-app/react-native 0.5.2 (apps/mobile/node_modules/@rive-app/
// react-native/lib/typescript/src): `useViewModelInstance(file, { async:
// true })` resolves the default instance off the JS thread; `RiveView` takes
// `file`, `dataBind`, `fit`, `semantics`, `autoPlay`. Deprecated
// state-machine inputs are never used (directive §8).
//
// Playback (review finding M15): `useRive()` hands back the view's ref; the
// loop pauses while `paused` is set or the app leaves the foreground and
// plays again when both clear (`RiveViewRef.pause()` / `play()`).
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { Fit, RiveView, Semantics, useRive, useViewModelInstance } from '@rive-app/react-native';
import { shouldPlayArtboard } from './lobby-playback.ts';
import { createLobbyRiveBinding, type LobbyRiveBinding } from './lobby-rive-binding.ts';
import type { LobbyRiveSurfaceProps } from './LobbyRiveSurface.types.ts';

export function LobbyRiveSurface({ riveFile, artboardName, stateMachineName, onBinding, exposeSemantics = true, paused = false, style }: LobbyRiveSurfaceProps) {
  const { instance } = useViewModelInstance(riveFile, { async: true });
  const binding = useRef<LobbyRiveBinding | null>(null);
  const { riveRef, setHybridRef } = useRive();

  useEffect(() => {
    const apply = (activity: string): void => {
      const view = riveRef.current;
      if (!view) return;
      void (shouldPlayArtboard(paused, activity) ? view.play() : view.pause());
    };
    apply(AppState.currentState ?? 'unknown');
    const subscription = AppState.addEventListener('change', apply);
    return () => subscription.remove();
  }, [paused, riveRef, instance]);

  useEffect(() => {
    if (!instance) {
      onBinding(null);
      return;
    }
    const created = createLobbyRiveBinding(instance);
    binding.current = created;
    onBinding(created);
    return () => {
      created.dispose();
      binding.current = null;
      onBinding(null);
    };
    // onBinding is an imperative sink the parent keeps stable; the instance drives the lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance]);

  if (!riveFile || !instance) return null;
  return (
    <RiveView
      file={riveFile}
      artboardName={artboardName}
      stateMachineName={stateMachineName}
      dataBind={instance}
      fit={Fit.Contain}
      autoPlay={!paused}
      hybridRef={setHybridRef}
      // VoiceOver reads the semantics lane B authors on the artboard (§8), unless the kit already names the content.
      semantics={exposeSemantics ? Semantics.Automatic : Semantics.Off}
      // The kit housing reports state; a Rive error must not take the lobby down.
      onError={() => undefined}
      style={style}
    />
  );
}
