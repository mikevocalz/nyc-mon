'use client';
// PLATFORM FORK (native): the Rive artboard behind a control, data-bound to
// the §8 View Model. @rive-app/react-native 0.5.2 (apps/mobile/node_modules/
// @rive-app/react-native/lib/typescript/src): `useViewModelInstance(file,
// { async: true })` resolves the default instance off the JS thread;
// `RiveView` takes `file`, `dataBind`, `fit`, `semantics`, `autoPlay`.
// Deprecated state-machine inputs are never used (directive §8).
//
// Accessibility (finding M13): the React Native wrapper of each control owns
// the tree (G01 `07-a11y.md` Screen reader table), so the artboard's own
// semantics stay off (`Semantics.Off`, core/Semantics.d.ts: "No
// accessibility elements are created") and the view is hidden from
// assistive tech. Otherwise VoiceOver would find twelve caps, six of them
// Rive buttons whose tap never reaches the router.
//
// Errors (finding M16): `onError` and every View Model path the artboard
// lacks go to `riveDiagnosticsStore`, which warns once per entry in
// development. A Rive error still never takes the controls down.
import { useEffect, useRef } from 'react';
import { Fit, RiveView, Semantics, useViewModelInstance, type RiveError, type RiveViewRef } from '@rive-app/react-native';
import { createArcadeRiveBinding, type ArcadeRiveBinding } from './rive-binding.ts';
import { riveDiagnosticsStore } from './rive-diagnostics.ts';
import type { ArcadeRiveSurfaceProps } from './ArcadeRiveSurface.types.ts';

export function ArcadeRiveSurface({ riveFile, artboardName, stateMachineName, onBinding, diagnosticsName, style }: ArcadeRiveSurfaceProps) {
  const { instance } = useViewModelInstance(riveFile, { async: true });
  const binding = useRef<ArcadeRiveBinding | null>(null);
  // The Android view stops advancing once its state machine settles, and a
  // view model write does not wake it (rive-android only wakes on pointer
  // events, play() or playIfNeeded()). Every write that changed a value calls
  // playIfNeeded so the stick rings, cap states and pill keep animating.
  const view = useRef<RiveViewRef | null>(null);
  const surface = `arcade:${diagnosticsName ?? artboardName ?? 'arcade'}`;

  useEffect(() => {
    if (!instance) {
      onBinding(null);
      return;
    }
    const created = createArcadeRiveBinding(instance, {
      onMissingPath: (path) => riveDiagnosticsStore.getState().reportMissingPath(surface, path),
      // The hybrid ref may not carry playIfNeeded on every runtime build; fall back to play().
      onDidWrite: () => {
        const ref = view.current as { playIfNeeded?: () => void; play?: () => void } | null;
        if (typeof ref?.playIfNeeded === 'function') ref.playIfNeeded();
        else if (typeof ref?.play === 'function') ref.play();
      },
    });
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
      hybridRef={{ f: (ref) => { view.current = ref; } }}
      fit={Fit.Contain}
      autoPlay
      semantics={Semantics.Off}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onError={(error: RiveError) =>
        riveDiagnosticsStore.getState().reportError({ surface, message: error.message, type: error.type })
      }
      style={style}
    />
  );
}
