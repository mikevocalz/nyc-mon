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
import { withFirstFrameSignal, type GameSceneParams } from '../load-game-scene.ts';
import { bundledSignals } from '../living-city/bundled-signals.ts';
import { bundledTopology } from '../living-city/bundled-topology.ts';
import { livingCityCaps } from '../living-city/bundled-host.ts';
import { createLampActor, lampPlacements } from '../living-city/lamp-viz.ts';
import { createPedActor } from '../living-city/ped-actor.ts';
import { createSignalActor } from '../living-city/signal-viz.ts';
import { createVehicleActor } from '../living-city/vehicle-actor.ts';
import { readCaller, readCamera, readView, snapshotVersion, type MutableCallerState } from '../render-snapshot.ts';
import { createStreetClearance } from '../world/walkability.ts';
import { describeRuntimeError, installFrameGlobals, type GameRenderEventKind } from './runtime-report.ts';
import { FrameSampleWindow, type MutableFrameTimingSample } from '../perf/frame-sampler.ts';
import { physicalRendererParams } from '../world/physical-look.ts';
import { readInteropGlobals, resolveRendererDevice, WORLD_PHYSICAL, type RendererDevice } from './shared-device.ts';
import { createPipecacheTimer, formatProbeRecord, probeShared, probeSkiaTex, threeSampler, WORLD_DEVICE_PROBE } from './device-probes.ts';

export type { GameRenderEventKind } from './runtime-report.ts';

// Same opt-in probe as the JS path (EXPO_PUBLIC_GAME_PERF=1, inlined at
// bundle time): 120-draw windows of the draw's CPU cost and the interval
// between draws — on this runtime that interval is the pacing under test.
const GAME_PERF = process.env.EXPO_PUBLIC_GAME_PERF === '1';

/** How the loop's next tick is driven: the runtime's 16 ms setTimeout rAF ('poll', the default) or the UI runtime's native vsync callback ('vsync'). */
export type RenderPacing = 'poll' | 'vsync';

export interface GameRenderArgs {
  session: number;
  context: NativeCanvasContext;
  device: GPUDevice | null;
  /** gpu-store's record of `device` (readGpuDevice().source): `shared` is Skia's Graphite device. Read only under EXPO_PUBLIC_WORLD_PHYSICAL. */
  deviceSource?: 'shared' | 'own' | null;
  snapshot: Synchronizable<number[]>;
  /** Living City PR05: the packed vehicle channel — null/absent when the flag is off (flag-off = zero-diff). */
  vehicles?: Synchronizable<number[]> | null;
  /** True while this loop is stopped; the JS side wakes it with wakeGameRender. */
  idle: Synchronizable<boolean>;
  running: boolean;
  /** 'vsync' draws once per vsyncTickGameRender call; 'poll' self-schedules on the runtime rAF. */
  pacing?: RenderPacing;
  emit: (kind: GameRenderEventKind, detail: string) => void;
}

interface Session {
  args: GameRenderArgs;
  renderer: InstanceType<typeof THREE.WebGPURenderer> | null;
  built: ThreeScene<GameSceneParams> | null;
  params: GameSceneParams | null;
  snapshot: number[];
  caller: MutableCallerState;
  /** Scratch objects the draw fills in place: zero allocation per frame. */
  camera: { x: number; z: number; yaw: number; distance: number };
  view: { width: number; height: number; pixelRatio: number; reducedMotion: boolean };
  frame: ThreeFrame;
  probe: FrameSampleWindow | null;
  /** Reused probe sample: the opt-in perf path allocates nothing per frame either. */
  probeSample: MutableFrameTimingSample;
  lastDrawStart: number;
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
let hops = 0;

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
  const view = s.view;
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
// Everything it touches is preallocated on the session; the only allocation
// per frame is the snapshot array getDirty returns (the channel itself).
function draw(s: Session) {
  const { renderer, built, params } = s;
  if (!renderer || !built || !params) return;
  applySize(s);
  if (s.width <= 0) return;
  const now = performance.now();
  const probeStart = s.probe ? now : 0;
  const probeInterval = s.probe && s.lastDrawStart > 0 ? probeStart - s.lastDrawStart : null;
  if (s.probe) s.lastDrawStart = probeStart;
  let delta = 0;
  if (s.running) {
    delta = s.last ? Math.min((now - s.last) / 1000, 0.1) : 0;
    s.time += delta;
    s.last = now;
  }
  readCaller(s.snapshot, s.caller);
  const frame = s.frame;
  frame.time = s.time;
  frame.delta = delta;
  frame.width = s.width;
  frame.height = s.height;
  frame.pixelRatio = s.pixelRatio;
  frame.reducedMotion = s.view.reducedMotion;
  // Same stage attribution as the JS path (ThreeCanvas.tsx): four extra
  // clock reads per frame only while the probe is on.
  const t0 = s.probe ? performance.now() : 0;
  built.update?.(frame, params);
  const t1 = s.probe ? performance.now() : 0;
  advanceNodeFrame(renderer);
  const t2 = s.probe ? performance.now() : 0;
  renderer.render(built.scene, built.camera);
  const t3 = s.probe ? performance.now() : 0;
  s.args.context.present();
  if (s.probe) {
    const t4 = performance.now();
    s.probeSample.cpuMs = Math.max(0, t4 - probeStart);
    s.probeSample.intervalMs = probeInterval;
    s.probeSample.updateMs = t1 - t0;
    s.probeSample.nodeMs = t2 - t1;
    s.probeSample.renderMs = t3 - t2;
    s.probeSample.presentMs = t4 - t3;
    const info = renderer.info?.render;
    s.probeSample.drawCalls = info?.drawCalls ?? -1;
    s.probeSample.triangles = info?.triangles ?? -1;
    s.probeSample.bufferW = renderer.domElement?.width ?? -1;
    s.probeSample.bufferH = renderer.domElement?.height ?? -1;
    const summary = s.probe.push(s.probeSample);
    if (summary) emit(s, 'perf', JSON.stringify(summary));
  }
  if (s.drawn < 2) trace(s, s.drawn === 0 ? 'first draw presented' : 'second draw presented');
  else if (s.drawn % 300 === 0) trace(s, `draw ${s.drawn} presented`);
  s.drawn++;
}

function schedule(s: Session) {
  if (s.scheduled || s.disposed) return;
  s.scheduled = true;
  // Vsync pacing: the UI-side driver calls vsyncTickGameRender once per display
  // frame; this runtime's rAF is a 16 ms setTimeout poll, not vsync
  // (worklets runLoop/workletRuntime/requestAnimationFramePolyfill.ts).
  if (s.args.pacing === 'vsync') return;
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
let ticks = 0;

function tick(s: Session) {
  s.scheduled = false;
  if (s.disposed || active !== s) return;
  s.snapshot = s.args.snapshot.getDirty();
  readView(s.snapshot, s.view);
  const version = snapshotVersion(s.snapshot);
  const fresh = version !== s.drawnVersion || s.wantFrame;
  ticks++;
  // Startup-only trace: every trace is a scheduleOnRN hop, so per-frame
  // logging would pollute the numbers this loop exists to produce.
  if (ticks <= 3) trace(s, `tick ${ticks}: ver=${version} drawnVer=${s.drawnVersion} want=${s.wantFrame} fresh=${fresh}`);
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
  const view = readView(snapshot);
  const s: Session = {
    args, renderer: null, built: null, params: null, snapshot,
    caller: {
      spawned: false, x: 0, z: 0, groundY: 0, heading: 0, gait: 'idle', speed: 0, pace: 0, stride: 0, gaitPhase: 0,
      jump: { height: 0, velocity: 0 },
    },
    camera: { x: 0, z: 0, yaw: 0, distance: 0 },
    view,
    frame: {
      time: 0, delta: 0, width: 0, height: 0, pixelRatio: 1, reducedMotion: false,
      pointer: { x: 0, y: 0, inside: false, pressed: false },
    },
    probe: GAME_PERF ? new FrameSampleWindow() : null,
    probeSample: { cpuMs: 0, intervalMs: null },
    lastDrawStart: 0,
    drawnVersion: -1, wantFrame: true, running: args.running, scheduled: false, idleTicks: 0, drawn: 0,
    time: 0, last: 0, width: 0, height: 0, pixelRatio: 1, disposed: false,
  };
  readCaller(snapshot, s.caller);
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
  // EXPO_PUBLIC_WORLD_PHYSICAL (G9): the renderer runs on Skia's device when
  // gpu-store handed it or this runtime can import it (shared-device.ts).
  // Flag off, `device` is args.device exactly as before.
  const shared = WORLD_PHYSICAL ? resolveRendererDevice(args.device, args.deviceSource, readInteropGlobals()) : null;
  if (shared) trace(s, `renderer device: ${shared.source}; ${shared.note}`);
  const device = shared ? shared.device : args.device;
  const pipecache = shared && WORLD_DEVICE_PROBE === 'pipecache' ? createPipecacheTimer('worklet') : null;
  let renderer: InstanceType<typeof THREE.WebGPURenderer>;
  try {
    // With inline requires (forced by Bundle Mode), this line is where three.js is first evaluated here.
    renderer = new THREE.WebGPURenderer({
      antialias: true,
      // react-native-webgpu's canvas is DOM-shaped enough for three; its types are not.
      canvas: args.context.canvas as unknown as HTMLCanvasElement,
      context: args.context,
      ...(device ? { device } : {}),
      // EXPO_PUBLIC_WORLD_PHYSICAL: reversed depth, as Slop's main.js sets it. Flag off: {}.
      ...physicalRendererParams(),
    });
  } catch (error) {
    fail(s, 'renderer construct', error);
    return;
  }
  s.renderer = renderer;
  trace(s, 'three loaded, renderer constructed; init pending');
  const ready = shared && WORLD_DEVICE_PROBE && WORLD_DEVICE_PROBE !== 'pipecache'
    ? renderer.init().then(() => runRendererProbe(s, renderer, shared))
    : renderer.init();
  ready.then(() => {
    if (s.disposed) return;
    trace(s, 'renderer init resolved');
    pipecache?.mark('rendererInit');
    emit(s, 'stage', 'moduleLoaded');
    stopInternalLoop(renderer);
    const mirror = { getState: () => s.caller };
    const params: GameSceneParams = {
      dataset: city.dataset,
      get camera() { return readCamera(s.snapshot, s.camera); },
      // PR05: the vehicle fleet reads its own packed Synchronizable — the sim
      // stays JS-authoritative and only the snapshot crosses runtimes.
      // PR06: the crowd reads the SAME channel — the ped section is appended
      // to that array, so no second Synchronizable crosses the bridge.
      // PR07: signal heads + lamp glows read the SAME channel again — the
      // signal and env sections are appended after the peds. Topology and
      // signals are deterministic pure builds, so this runtime rebuilds the
      // identical roster the JS host packed against (index → element binds
      // on both sides with nothing extra crossing the bridge).
      actors: [
        createCallerProxyWith(mirror),
        ...(args.vehicles
          ? (() => {
              const topology = bundledTopology();
              const signals = bundledSignals();
              const focus = () => ({ x: s.camera.x, z: s.camera.z });
              const read = () => args.vehicles?.getDirty();
              // PR09: the same resolved caps as the JS path — the tier is
              // resolved identically on this runtime (env is inlined at
              // bundle time), so both render paths mount the same set.
              const caps = livingCityCaps();
              // One clearance index for both actors: heads/boxes nudge to
              // the sidewalk, lamp glows reuse the same kerb math.
              const streetClearance = createStreetClearance(city.dataset);
              return [
                // ponytail: real headlight spots stay off; r186 ClusteredLighting clusters only
                // unshadowed PointLights, so spots would hit every lit material. Lamps and flares still show.
                createVehicleActor({ read, focus, headlightSpots: false }),
                createPedActor({ read }),
                ...(topology && signals
                  ? [createSignalActor({ read, signals, topology, focus, clearance: streetClearance, headCap: caps.signalHeadCap, pedCap: caps.pedBoxCap })]
                  : []),
                ...(caps.lampGlow
                  ? [
                      createLampActor({
                        read,
                        placements: lampPlacements(city.dataset, streetClearance),
                        focus,
                      }),
                    ]
                  : []),
              ];
            })()
          : []),
      ],
      onFirstFrame: () => {
        emit(s, 'firstFrame');
        const record = pipecache?.finish();
        if (record) trace(s, formatProbeRecord(record));
      },
    };
    const setup = withFirstFrameSignal(
      createCityScene,
      (stage) => {
        pipecache?.mark(stage);
        emit(s, 'stage', stage);
      },
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

/**
 * The `shared` and `skiatex` probes on this runtime, after init and before
 * the city builds, against the device three actually holds
 * (WebGPUBackend.device, three 0.186.1 build/three.webgpu.js ~L87210). A
 * probe failure is logged, never thrown: the world still loads.
 */
async function runRendererProbe(s: Session, renderer: InstanceType<typeof THREE.WebGPURenderer>, shared: RendererDevice): Promise<void> {
  const device = (renderer.backend as { device?: GPUDevice | null }).device ?? null;
  const { skia } = readInteropGlobals();
  try {
    if (WORLD_DEVICE_PROBE === 'shared') {
      trace(s, formatProbeRecord(await probeShared({ runtime: 'worklet', device, deviceSource: shared.source, skia })));
    } else if (WORLD_DEVICE_PROBE === 'skiatex') {
      const sampler = threeSampler(THREE, renderer);
      try {
        trace(s, formatProbeRecord(await probeSkiaTex({ runtime: 'worklet', device, skia, sample: sampler.sample })));
      } finally {
        sampler.dispose();
      }
    }
  } catch (error) {
    emit(s, 'error', describeRuntimeError(`probe ${WORLD_DEVICE_PROBE}`, error));
  }
}

/** A write landed while the loop was parked. */
export function wakeGameRender(session: number): void {
  const s = active;
  if (!s || s.args.session !== session) return;
  // Clear idle before arming: the vsync driver skips parked sessions, so a
  // wake that left `idle` set would never be picked up.
  s.args.idle.setBlocking(false);
  schedule(s);
}

/**
 * One display frame from the UI-side vsync driver (worklet-host.ts): ticks the
 * loop when a frame is wanted and does nothing while the session is parked —
 * an idle city costs one no-op hop per vsync, skipped earlier when the driver
 * sees `idle` set. Only used with `pacing: 'vsync'`; in poll mode the runtime's
 * own rAF drives tick and this is never scheduled.
 */
export function vsyncTickGameRender(session: number): void {
  const s = active;
  if (!s || s.args.session !== session || s.args.pacing !== 'vsync') return;
  if (!s.scheduled) {
    hops++;
    if (hops <= 8 || hops % 120 === 0) trace(s, `vsync hop skipped (scheduled=false, drawn=${s.drawn}, hops=${hops})`);
    return;
  }
  try {
    tick(s);
  } catch (error) {
    if (!s.disposed) fail(s, 'frame tick', error);
  }
}

export function setGameRenderRunning(session: number, running: boolean): void {
  const s = active;
  if (!s || s.args.session !== session) return;
  s.running = running;
  if (!running) s.last = 0;
  s.wantFrame = true;
  s.args.idle.setBlocking(false);
  schedule(s);
}

export function stopGameRender(session: number): void {
  const s = active;
  if (!s || s.args.session !== session) return;
  disposeSession(s);
}
