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
  scheduleOnRuntimeWithId,
  scheduleOnUI,
  type Synchronizable,
  type WorkletRuntime,
} from 'react-native-worklets';
import { installWebGPUOnRuntime, type WorkletRenderHost, type WorkletRenderSession, type WorkletRenderStart } from '@acme/ui/three';
import { callerStore } from '../character/caller-store.ts';
import { gameCameraStore, gameScreenActions } from '../game-session.ts';
import { emptySnapshot, bumpSnapshot, packSnapshot, type SnapshotView } from '../render-snapshot.ts';
import { parseSkyRigFlag } from '../world/sky-rig.ts';
import {
  setGameRenderRunning,
  startGameRender,
  stopGameRender,
  vsyncTickGameRender,
  wakeGameRender,
  type GameRenderArgs,
} from './game-render.ts';
import { describeRuntimeError, routeRenderEvent, type GameRenderEventKind } from './runtime-report.ts';

type Report = (kind: GameRenderEventKind, detail: string) => void;

// EXPO_PUBLIC_WORKLET_VSYNC (opt-in, off by default): the render runtime's
// rAF is a 16 ms setTimeout poll, not vsync (worklets
// runLoop/workletRuntime/requestAnimationFramePolyfill.ts), so 'poll' drifts
// and can draw twice inside one display frame. With this flag the UI runtime's
// native frame callback paces the loop instead — one hop per vsync calls
// vsyncTickGameRender, which draws only when a frame is wanted.
const VSYNC_PACED = parseSkyRigFlag(process.env.EXPO_PUBLIC_WORKLET_VSYNC);

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
    scheduleOnRN(report, 'trace', 'wake entered');
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

// --- Vsync pacing (EXPO_PUBLIC_WORKLET_VSYNC) --------------------------------
// The driver lives on the UI runtime, where requestAnimationFrame is the
// native frame callback (worklets runLoop/uiRuntime/requestAnimationFrame.js
// loops on __nativeRequestAnimationFrame — Choreographer on Android). Each
// vsync it hops to the render runtime, which draws one frame when scheduled.
const vsyncTickOnRuntime = (session: number, report: Report) => {
  'worklet';
  try {
    vsyncTickGameRender(session);
  } catch (error) {
    scheduleOnRN(report, 'error', describeRuntimeError('vsyncTick', error));
  }
};
const vsyncDriverOnUI = (
  runtimeId: number,
  session: number,
  idle: Synchronizable<boolean>,
  driving: Synchronizable<boolean>,
  report: Report,
) => {
  'worklet';
  let vsyncs = 0;
  const tickOnce = () => {
    if (!driving.getDirty()) return;
    vsyncs++;
    const idleNow = idle.getDirty();
    if (vsyncs <= 5 || vsyncs % 300 === 0) scheduleOnRN(report, 'trace', `driver vsync ${vsyncs} idle=${idleNow}`);
    // Parked sessions get no hop: a still city costs one getDirty per vsync.
    if (!idleNow) {
      try {
        scheduleOnRuntimeWithId(runtimeId, vsyncTickOnRuntime, session, report);
      } catch (error) {
        scheduleOnRN(report, 'error', describeRuntimeError('vsync hop', error));
      }
    }
    requestAnimationFrame(tickOnce);
  };
  requestAnimationFrame(tickOnce);
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
  // Vsync mode only: the UI driver exits when this goes false on dispose.
  const driving: Synchronizable<boolean> | null = VSYNC_PACED ? createSynchronizable(true) : null;
  let disposed = false;

  const onRuntimeEvent: Report = (kind, detail) => {
    // Breadcrumbs, perf lines and errors are logged even after dispose: a failing stop is worth seeing.
    if (kind === 'trace' || kind === 'error' || kind === 'perf') {
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

  let writes = 0;
  const write = (next: number[]) => {
    if (disposed) return;
    latest = next;
    writes++;
    if (writes <= 4) console.log(`[GameRender] snapshot write ${writes}`);
    snapshot.setBlocking(next);
    if (idle.getDirty()) {
      idle.setBlocking(false);
      scheduleOnRuntime(target, wakeOnRuntime, session, onRuntimeEvent);
    }
  };
  // Each write must carry a FRESH array: worklets' createSerializable caches
  // serializables by JS-object identity (serializableMappingCache), so reusing
  // one buffer writes the first serialization forever — measured on the Duo,
  // 2026-10-17 (every runtime tick read version 1). The slice is one 21-number
  // array; the Serializable clone the Synchronizable builds allocates anyway.
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
    pacing: VSYNC_PACED ? 'vsync' : 'poll',
    emit: onRuntimeEvent,
  });
  if (driving) scheduleOnUI(vsyncDriverOnUI, target.runtimeId, session, idle, driving, onRuntimeEvent);

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
      driving?.setBlocking(false);
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
