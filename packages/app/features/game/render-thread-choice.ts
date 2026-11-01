// Which thread renders the Game world, read once at module load.
// `EXPO_PUBLIC_WORKLET_RENDER=1` (inlined by Expo at bundle time; the literal
// `process.env.EXPO_PUBLIC_…` access is what the inliner matches) asks for the
// worklet render runtime. Off by default.
//
// The host module (render-runtime/worklet-host.ts) imports three.js and the
// city scene statically, so it loads only when the flag is on: the default
// build keeps three.js behind the scene's dynamic import, as before.
import { useEffect } from 'react';
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { parseRenderThreadFlag, type RenderThread, type WorkletRenderHost } from '@acme/ui/three';

export const GAME_RENDER_THREAD: RenderThread = parseRenderThreadFlag(process.env.EXPO_PUBLIC_WORKLET_RENDER);

type HostState = { status: 'idle' | 'loading' | 'ready' | 'failed'; host: WorkletRenderHost | undefined };
const hostStore = createStore<HostState>(() => ({ status: 'idle', host: undefined }));

function loadHost(): void {
  if (hostStore.getState().status !== 'idle') return;
  hostStore.setState({ status: 'loading' });
  import('./render-runtime/worklet-host.ts').then(
    (m) => hostStore.setState({ status: 'ready', host: m.gameWorkletHost }),
    (error: unknown) => {
      console.error('[Game] the worklet render host failed to load; rendering on the JS thread.', error);
      hostStore.setState({ status: 'failed' });
    },
  );
}

/**
 * The thread and host for the Game canvas. `settled` is false only while the
 * worklet host module is still loading; mount the canvas after that, because
 * ThreeCanvas resolves its thread once per mount.
 */
export function useGameRenderThread(): { thread: RenderThread; host: WorkletRenderHost | undefined; settled: boolean } {
  const state = useStore(hostStore);
  useEffect(() => {
    if (GAME_RENDER_THREAD === 'worklet') loadHost();
  }, []);
  if (GAME_RENDER_THREAD !== 'worklet') return { thread: 'js', host: undefined, settled: true };
  const settled = state.status === 'ready' || state.status === 'failed';
  return { thread: state.status === 'ready' ? 'worklet' : 'js', host: state.host, settled };
}
