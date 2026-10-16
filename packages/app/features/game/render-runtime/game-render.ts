// The Game world on the worklet render runtime. This module is evaluated ON
// that runtime (react-native-worklets Bundle Mode loads the app bundle there
// and the worklet entries in worklet-host.ts import it by forwarded relative
// path), so it owns its own three.js, its own parsed dataset and its own
// scene. It must never import react-native or a module that does: a second
// React Native instance on a worklet runtime is unsupported (worklets Bundle
// Mode docs, "Running third party libraries in Worklets").
//
// State it does not own arrives through `snapshot` (render-snapshot.ts): the
// JS-thread simulation writes the camera and Caller there, and this loop
// reads the latest array once per tick. The Caller proxy reads a mirror store
// fed from that array, so character/ and world/ run here unchanged.
//
// Milestones, breadcrumbs and failures go back to the JS thread with
// scheduleOnRN (runtime-report.ts routes them there). Nothing thrown on this
// runtime reaches logcat or Metro by itself, so every entry point catches.
import * as THREE from 'three/webgpu';
import { scheduleOnRN, type Synchronizable } from 'react-native-worklets';
import { advanceNodeFrame, stopInternalLoop } from '@acme/ui/three/internals';
import type { NativeCanvasContext, ThreeFrame, ThreeScene } from '@acme/ui/three';
import { bundledCity } from '../city-data.ts';
import { createCityScene } from '../city-scene.ts';
import { createCallerProxyWith } from '../character/caller-proxy.ts';
import type { CallerState } from '../character/caller-store.ts';
import { withFirstFrameSignal, type GameSceneParams } from '../load-game-scene.ts';
import { readCaller, readCamera, readView, snapshotVersion } from '../render-snapshot.ts';
import { describeRuntimeError, installFrameGlobals, type GameRenderEventKind } from './runtime-report.ts';

export type { GameRenderEventKind } from './runtime-report.ts';

export interface GameRenderArgs {
  session: number;
  context: NativeCanvasContext;
  device: GPUDevice | null;
  snapshot: Synchronizable<number[]>;
  /** True while this loop is stopped; the JS side wakes it with wakeGameRender. */
  idle: Synchronizable<boolean>;
  running: boolean;
  emit: (kind: GameRenderEventKind, detail: string) => void;
}

interface Session {
  args: GameRenderArgs;
  renderer: InstanceType<typeof THREE.WebGPURenderer> | null;
  built: ThreeScene<GameSceneParams> | null;
  params: GameSceneParams | null;
  snapshot: number[];
  caller: CallerState;
  drawnVersion: number;
  wantFrame: boolean;
  running: boolean;
  scheduled: boolean;
  idleTicks: number;
  /** Frames drawn; the first two leave a breadcrumb. */
  drawn: number;
  time: number;
  last: number;
  width: number;
  height: number;
  pixelRatio: number;
  disposed: boolean;
}

let active: Session | null = null;

const emit = (s: Session, kind: GameRenderEventKind, detail = '') => {
  scheduleOnRN(s.args.emit, kind, detail);
};

const trace = (s: Session, stage: string) => emit(s, 'trace', stage);

const fail = (s: Session, where: string, error: unknown) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  emit(s, 'error', describeRuntimeError(where, error));
  emit(s, 'failed', message);
  disposeSession(s);
};

function applySize(s: Session) {
  const { renderer, built } = s;
  if (!renderer || !built) return;
  const view = readView(s.snapshot);
  if (view.width <= 0 || view.height <= 0) return;
  if (s.width === view.width && s.height === view.height && s.pixelRatio === view.pixelRatio) return;
  s.width = view.width;
  s.height = view.height;
  s.pixelRatio = view.pixelRatio;
  renderer.setPixelRatio(view.pixelRatio);
  renderer.setSize(view.width, view.height, false);
  built.resize?.(view.width, view.height);
}

// One frame: the JS path's draw(), reading the snapshot instead of JS stores.
function draw(s: Session) {
  const { renderer, built, params } = s;
  if (!renderer || !built || !params) return;
  applySize(s);
  if (s.width <= 0) return;
  const now = performance.now();
  let delta = 0;
  if (s.running) {
    delta = s.last ? Math.min((now - s.last) / 1000, 0.1) : 0;
    s.time += delta;
    s.last = now;
  }
  s.caller = readCaller(s.snapshot);
  const frame: ThreeFrame = {
    time: s.time, delta, width: s.width, height: s.height, pixelRatio: s.pixelRatio,
    reducedMotion: readView(s.snapshot).reducedMotion,
    pointer: { x: 0, y: 0, inside: false, pressed: false },
  };
  built.update?.(frame, params);
  advanceNodeFrame(renderer);
  renderer.render(built.scene, built.camera);
  s.args.context.present();
  if (s.drawn < 2) trace(s, s.drawn === 0 ? 'first draw presented' : 'second draw presented');
  s.drawn++;
}

function schedule(s: Session) {
  if (s.scheduled || s.disposed) return;
  s.scheduled = true;
  requestAnimationFrame(() => {
    try {
      tick(s);
    } catch (error) {
      if (!s.disposed) fail(s, 'frame tick', error);
    }
  });
}

// The loop runs while frames are wanted and parks itself after two quiet
// ticks, so an idle city costs this thread nothing (the JS canvas is on
// demand too). Parking sets `idle` and then reads the version once more:
// a write that landed between the last read and `idle` still gets drawn.
function tick(s: Session) {
  s.scheduled = false;
  if (s.disposed || active !== s) return;
  s.snapshot = s.args.snapshot.getDirty();
  const version = snapshotVersion(s.snapshot);
  const fresh = version !== s.drawnVersion || s.wantFrame;
  if (fresh || s.running) {
    s.drawnVersion = version;
    s.wantFrame = false;
    s.idleTicks = 0;
    try {
      draw(s);
    } catch (error) {
      fail(s, 'draw', error);
      return;
    }
  } else {
    s.idleTicks++;
  }
  if (s.running || s.wantFrame || s.idleTicks < 2) {
    schedule(s);
    return;
  }
  s.last = 0;
  s.args.idle.setBlocking(true);
  if (snapshotVersion(s.args.snapshot.getDirty()) !== s.drawnVersion) {
    s.args.idle.setBlocking(false);
    schedule(s);
  }
}

function disposeSession(s: Session) {
  if (s.disposed) return;
  s.disposed = true;
  try {
    s.built?.dispose?.();
    s.renderer?.dispose();
  } catch (error) {
    emit(s, 'error', describeRuntimeError('dispose', error));
  }
  s.built = null;
  s.renderer = null;
  if (active === s) active = null;
}

/** Builds the renderer and the city on this runtime. Replaces any earlier session. */
export function startGameRender(args: GameRenderArgs): void {
  if (active) disposeSession(active);
  const snapshot = args.snapshot.getDirty();
  const s: Session = {
    args, renderer: null, built: null, params: null, snapshot, caller: readCaller(snapshot),
    drawnVersion: -1, wantFrame: true, running: args.running, scheduled: false, idleTicks: 0, drawn: 0,
    time: 0, last: 0, width: 0, height: 0, pixelRatio: 1, disposed: false,
  };
  active = s;
  trace(s, `startGameRender (session ${args.session}, device ${args.device ? 'shared' : 'none'})`);
  args.idle.setBlocking(false);
  if (installFrameGlobals()) trace(s, 'self aliased to the runtime global');
  const city = bundledCity();
  if (!city.ok) {
    fail(s, 'city parse', city.error);
    return;
  }
  trace(s, 'city parsed');
  let renderer: InstanceType<typeof THREE.WebGPURenderer>;
  try {
    // With inline requires (forced by Bundle Mode), this line is where three.js is first evaluated here.
    renderer = new THREE.WebGPURenderer({
      antialias: true,
      // react-native-webgpu's canvas is DOM-shaped enough for three; its types are not.
      canvas: args.context.canvas as unknown as HTMLCanvasElement,
      context: args.context,
      ...(args.device ? { device: args.device } : {}),
    });
  } catch (error) {
    fail(s, 'renderer construct', error);
    return;
  }
  s.renderer = renderer;
  trace(s, 'three loaded, renderer constructed; init pending');
  renderer.init().then(() => {
    if (s.disposed) return;
    trace(s, 'renderer init resolved');
    emit(s, 'stage', 'moduleLoaded');
    stopInternalLoop(renderer);
    const mirror = { getState: () => s.caller };
    const params: GameSceneParams = {
      dataset: city.dataset,
      get camera() { return readCamera(s.snapshot); },
      actors: [createCallerProxyWith(mirror)],
      onFirstFrame: () => emit(s, 'firstFrame'),
    };
    const setup = withFirstFrameSignal(
      createCityScene,
      (stage) => emit(s, 'stage', stage),
      (event) => trace(s, event),
    );
    const invalidate = () => {
      s.wantFrame = true;
      s.args.idle.setBlocking(false);
      schedule(s);
    };
    s.params = params;
    s.built = setup({ THREE, renderer, backend: 'webgpu', invalidate }, params);
    trace(s, 'scene built');
    emit(s, 'backend', 'webgpu');
    invalidate();
  }).catch((error: unknown) => {
    if (!s.disposed) fail(s, 'renderer init or scene build', error);
  });
}

/** A write landed while the loop was parked. */
export function wakeGameRender(session: number): void {
  const s = active;
  if (!s || s.args.session !== session) return;
  schedule(s);
}

export function setGameRenderRunning(session: number, running: boolean): void {
  const s = active;
  if (!s || s.args.session !== session) return;
  s.running = running;
  if (!running) s.last = 0;
  s.wantFrame = true;
  schedule(s);
}

export function stopGameRender(session: number): void {
  const s = active;
  if (!s || s.args.session !== session) return;
  disposeSession(s);
}
