// The Game screen's WorkletRenderHost (ThreeCanvas `renderThread="worklet"`).
// JS side of the worklet render runtime: it creates the runtime once, mirrors
// gameCameraStore and callerStore into a Synchronizable snapshot on every
// store change, relays the runtime's milestones to gameScreenStore, and wakes
// the runtime only when its loop is parked.
//
// Cost per input event on the JS thread: one packSnapshot (21 numbers) and one
// Synchronizable write. A hop onto the render runtime happens only on the
// parked-to-drawing edge, so a held stick costs one hop for the whole hold.
//
// Requires react-native-worklets Bundle Mode with this directory forwarded
// (apps/mobile/babel.config.js, EXPO_PUBLIC_WORKLET_RENDER=1). Without it,
// `available()` is false and ThreeCanvas stays on the JS thread.
import {
  createSynchronizable,
  createWorkletRuntime,
  isBundleModeEnabled,
  scheduleOnRN,
  scheduleOnRuntime,
  type Synchronizable,
  type WorkletRuntime,
} from 'react-native-worklets';
import { installWebGPUOnRuntime, type WorkletRenderHost, type WorkletRenderSession, type WorkletRenderStart } from '@acme/ui/three';
import { callerStore } from '../character/caller-store.ts';
import { gameCameraStore, gameScreenActions } from '../game-session.ts';
import { emptySnapshot, bumpSnapshot, packSnapshot, type SnapshotView } from '../render-snapshot.ts';
import {
  setGameRenderRunning,
  startGameRender,
  stopGameRender,
  wakeGameRender,
  type GameRenderArgs,
} from './game-render.ts';
import { describeRuntimeError, routeRenderEvent, type GameRenderEventKind } from './runtime-report.ts';

type Report = (kind: GameRenderEventKind, detail: string) => void;

let runtime: WorkletRuntime | null = null;
let nextSession = 1;

// Worklet entries. In Bundle Mode the plugin forwards the relative imports
// above, so these calls resolve to game-render.ts as evaluated on the runtime.
// Bundle Mode forces inline requires, so game-render.ts itself is first
// evaluated inside the `try` of startOnRuntime: a module-scope throw there is
// reported too. Nothing thrown on the runtime reaches logcat by itself.
const startOnRuntime = (args: GameRenderArgs) => {
  'worklet';
  try {
    scheduleOnRN(args.emit, 'trace', 'start worklet entered');
    installWebGPUOnRuntime();
    scheduleOnRN(args.emit, 'trace', 'installWebGPU');
    startGameRender(args);
  } catch (error) {
    scheduleOnRN(args.emit, 'error', describeRuntimeError('start', error));
    scheduleOnRN(args.emit, 'failed', error instanceof Error ? error.message : String(error));
  }
};
const wakeOnRuntime = (session: number, report: Report) => {
  'worklet';
  try {
    wakeGameRender(session);
  } catch (error) {
    scheduleOnRN(report, 'error', describeRuntimeError('wake', error));
  }
};
const runningOnRuntime = (session: number, running: boolean, report: Report) => {
  'worklet';
  try {
    setGameRenderRunning(session, running);
  } catch (error) {
    scheduleOnRN(report, 'error', describeRuntimeError(`setRunning(${running})`, error));
  }
};
const stopOnRuntime = (session: number, report: Report) => {
  'worklet';
  try {
    stopGameRender(session);
  } catch (error) {
    scheduleOnRN(report, 'error', describeRuntimeError('stop', error));
  }
};

const consoleSinks = {
  log: (message: string) => console.log(message),
  error: (message: string) => console.error(message),
  loadStage: gameScreenActions.loadStage,
};

function renderRuntime(): WorkletRuntime {
  // One runtime for the app's life: a remount (Retry, START) reuses it, so three.js loads there once.
  runtime ??= createWorkletRuntime({ name: 'nyc-mon-render', animationQueuePollingRate: 16 });
  return runtime;
}

function start(options: WorkletRenderStart): WorkletRenderSession {
  const target = renderRuntime();
  const session = nextSession++;
  let view: SnapshotView = { width: options.width, height: options.height, pixelRatio: options.pixelRatio, reducedMotion: options.reducedMotion };
  let latest = packSnapshot(emptySnapshot(), gameCameraStore.getState().camera, callerStore.getState(), view);
  const snapshot: Synchronizable<number[]> = createSynchronizable(latest);
  const idle: Synchronizable<boolean> = createSynchronizable(false);
  let disposed = false;

  const onRuntimeEvent: Report = (kind, detail) => {
    // Breadcrumbs and errors are logged even after dispose: a failing stop is worth seeing.
    if (kind === 'trace' || kind === 'error') {
      routeRenderEvent(kind, detail, consoleSinks);
      return;
    }
    if (disposed) return;
    if (routeRenderEvent(kind, detail, consoleSinks)) return;
    switch (kind) {
      case 'backend': options.onEvent({ kind: 'backend', backend: 'webgpu' }); return;
      case 'firstFrame': gameScreenActions.firstFrame(); return;
      case 'failed': options.onEvent({ kind: 'failed', message: detail }); return;
    }
  };

  const write = (next: number[]) => {
    if (disposed) return;
    latest = next;
    snapshot.setBlocking(next);
    if (idle.getDirty()) {
      idle.setBlocking(false);
      scheduleOnRuntime(target, wakeOnRuntime, session, onRuntimeEvent);
    }
  };
  const mirror = () => write(packSnapshot(latest, gameCameraStore.getState().camera, callerStore.getState(), view));
  const unsubscribeCamera = gameCameraStore.subscribe(mirror);
  const unsubscribeCaller = callerStore.subscribe(mirror);

  // The JS path reports `requested` when the scene import starts (loadGameScene);
  // here the equivalent is handing the start to the runtime.
  routeRenderEvent('stage', 'requested', consoleSinks);
  scheduleOnRuntime(target, startOnRuntime, {
    session,
    context: options.context,
    device: options.device,
    snapshot,
    idle,
    running: false,
    emit: onRuntimeEvent,
  });

  return {
    resize: (width, height, pixelRatio) => {
      view = { ...view, width, height, pixelRatio };
      mirror();
    },
    setReducedMotion: (reducedMotion) => {
      view = { ...view, reducedMotion };
      mirror();
    },
    setRunning: (running) => {
      if (!disposed) scheduleOnRuntime(target, runningOnRuntime, session, running, onRuntimeEvent);
    },
    invalidate: () => write(bumpSnapshot(latest)),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      unsubscribeCamera();
      unsubscribeCaller();
      scheduleOnRuntime(target, stopOnRuntime, session, onRuntimeEvent);
    },
  };
}

export const gameWorkletHost: WorkletRenderHost = {
  available: () => {
    try {
      return isBundleModeEnabled();
    } catch {
      return false;
    }
  },
  start,
};
