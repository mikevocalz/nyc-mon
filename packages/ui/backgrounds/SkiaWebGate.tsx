'use client';

import { createElement, useEffect, type ComponentType, type ReactNode } from 'react';
import { useInstanceStore, useStore } from '../use-instance-store';

type ModuleWithDefault<P extends object> = { default: ComponentType<P> };

let skiaReady: Promise<void> | null = null;

// The loader is imported on first use, not at module scope: it pulls in the
// CanvasKit glue (~35 KB gzip), and every page that renders a gated scene
// would otherwise ship it before the scene ever asks for Skia.
function prepareSkia() {
  skiaReady ??= import('react-native-skia/lib/module/web').then(({ LoadSkiaWeb }) =>
    LoadSkiaWeb({ locateFile: (file) => `/canvaskit/${file}` }),
  );
  return skiaReady;
}

export function SkiaWebGate<P extends object>({
  load,
  props,
  fallback,
}: {
  load: () => Promise<ModuleWithDefault<P>>;
  props: P;
  fallback?: ReactNode;
}) {
  const store = useInstanceStore<{ Component: ComponentType<P> | null }>(() => ({ Component: null }));
  const Component = useStore(store, (state) => state.Component);

  useEffect(() => {
    let active = true;
    void prepareSkia()
      .then(load)
      .then((module) => {
        if (active) store.setState({ Component: module.default });
      });
    return () => {
      active = false;
    };
  }, [load, store]);

  // createElement, not JSX: the component arrives from a store at runtime,
  // and the compiler lint reads a JSX tag from a variable as a component
  // defined during render.
  return Component ? createElement(Component, props) : (fallback ?? null);
}
