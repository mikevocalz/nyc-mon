'use client';
import { useEffect } from 'react';
import { SafeAreaProvider } from '../../providers/safe-area';
import { ErrorScreen } from './screen.shared';

export interface RootErrorBoundaryProps {
  error: Error;
  /** The router boundary's reset: re-renders the subtree that threw. */
  retry: () => unknown;
  /** Navigate to "/" (the caller owns the router). Runs after the boundary resets. */
  goHome: () => void;
  /** Hides a native splash that is still up when the first frame threw. */
  hideSplash?: () => void;
}

/**
 * The app's last line: what the root layout's `ErrorBoundary` draws when
 * anything under it throws, the layout's own providers included.
 *
 * The router renders this INSTEAD of the root layout, so none of the layout's
 * providers exist here (safe-area, query, navigation theme, toaster, splash).
 * It brings its own SafeAreaProvider and touches nothing else that a provider
 * supplies: the kit's themed classes read the Uniwind theme, which is set at
 * module scope before the first frame.
 *
 * Production shows the plain-language body; development shows the message.
 */
export function RootErrorBoundary({ error, retry, goHome, hideSplash }: RootErrorBoundaryProps) {
  useEffect(() => {
    // A throw on the first frame unmounts the branded splash before it can
    // hide the native one, and the user would stare at the logo forever.
    hideSplash?.();
  }, [hideSplash]);

  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  return (
    <SafeAreaProvider>
      <ErrorScreen
        kind="error"
        detail={isDev ? error.message : undefined}
        onRetry={() => void retry()}
        onGoHome={() => {
          // Remount the layout first: with it unmounted there is no navigator
          // to take a REPLACE. Then navigate on the next tick, once the Slot
          // has registered again.
          void Promise.resolve(retry()).then(() => {
            setTimeout(() => {
              try {
                goHome();
              } catch {
                // The layout threw again; the boundary is back on screen.
              }
            }, 0);
          });
        }}
      />
    </SafeAreaProvider>
  );
}
