'use client';

import { createElement, useEffect, type ComponentType, type ReactNode } from 'react';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { useInstanceStore, useStore } from '../use-instance-store';

type ModuleWithDefault<P extends object> = { default: ComponentType<P> };

let skiaReady: Promise<void> | null = null;

function prepareSkia() {
  skiaReady ??= LoadSkiaWeb({ locateFile: (file) => `/canvaskit/${file}` });
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
