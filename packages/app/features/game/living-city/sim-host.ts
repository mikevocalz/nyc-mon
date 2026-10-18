// Living City PR05 — the authoritative simulation host. Owns the fixed-step
// clock (the spec's 20–30 Hz accumulator), the signal system and the vehicle
// sim, and publishes ONE flat packed actor snapshot per sim tick. It is the
// only writer of the vehicle channel: JS-path actors read `latest()`
// directly; the worklet render host mirrors each publish into a
// Synchronizable (render-runtime/worklet-host.ts).
//
// PR06: the host now also owns the pedestrian sim — same tick, same publish.
// The packed layout is EXTENDED, not forked: the vehicle header/records are
// untouched and a ped section is appended (ped-sim.ts), so every consumer
// keeps reading the vehicle channel exactly as before.
//
// PR07: the host also owns the authoritative world clock (clock.ts) and
// packs two more sections onto the same array — the signal section
// (every controlled element's aspect, signal-viz.ts) and the env
// section (hour/dayFactor/lampLevel/headlights/rain). Every visual
// consumer — signal heads, ped displays, lamp glows, vehicle lights —
// reads the same bytes the sims act on; nothing outside the snapshot
// can disagree with what the AI saw.
//
// Two rules come straight from render-snapshot.ts:
//
//  - Fresh arrays every write. packActorSnapshot already allocates a new
//    array per call and nothing mutates it afterwards, so handing the same
//    reference to a Synchronizable is safe (the identity-cache bug measured
//    on the Duo, 2026-10-17, only bites buffers that get re-serialized).
//  - The sim clock is authoritative and fixed-step. Real time only feeds
//    the accumulator; the sim state is a pure function of the tick count,
//    so pause/fold/resume never re-seeds traffic (spec §14-D).
//
// Consumers (the mounted scene actor on the JS path, the Synchronizable
// sink on the worklet path) ref-count the ticker with attach()/detach():
// the host only burns rAF while something renders it, and sim state
// survives scene remounts like the module-scope session stores do.

import { CityClock } from './clock.ts';
import { PedSim, type PedSimOptions } from './ped-sim.ts';
import type { SignalSystem } from './signal-controller.ts';
import {
  emptyWorldSnapshot,
  packWorldSnapshot,
  signalRoster,
  type SignalRosterEntry,
} from './signal-viz.ts';
import type { LaneTopology } from './topology.ts';
import {
  SIM_DT,
  VehicleSim,
  type VehicleSimMetrics,
  type VehicleSimOptions,
} from './vehicle-sim.ts';

/** A publish receives the freshly packed snapshot each sim tick. */
export type VehicleSnapshotSink = (snapshot: number[]) => void;

export interface LivingCityHostOptions extends VehicleSimOptions {
  readonly topology: LaneTopology;
  readonly signals: SignalSystem;
  /** Pedestrian sim options — scripted crowd, ambient target, obstacles, seed. Omit for an empty crowd. */
  readonly peds?: PedSimOptions;
  /**
   * Frame-clock source in ms — default performance.now() with a Date.now()
   * fallback. Injected in tests.
   */
  readonly now?: () => number;
  /** Scheduler for the ticker — default requestAnimationFrame (or a 33 ms setTimeout where rAF is absent). */
  readonly schedule?: (cb: () => void) => unknown;
  readonly cancel?: (handle: unknown) => void;
  /** Spawn/despawn zone centre — the render camera's look-at point, injected so the sim stays thread-agnostic. */
  readonly focus?: () => { x: number; z: number } | null;
  /** Clamp on real time per frame so a backgrounded app resumes without a catch-up burst. */
  readonly maxFrameSeconds?: number;
  /** PR07: the world clock's starting hour (0–24). Default is the clock's own noon-less default — see clock.ts. */
  readonly timeOfDayHours?: number;
  /** PR07: game hours per sim second — 1/3600 real time, 1/60 makes a session see a dusk transition. */
  readonly hoursPerSimSecond?: number;
}

export interface LivingCityHostStats extends VehicleSimMetrics {
  /** Fixed ticks actually executed since the host was built. */
  readonly ticksRun: number;
  /** Wall-clock ms spent in sim.step on the last tick (diagnostics only). */
  readonly lastTickMs: number;
  /** Wall-clock ms spent in pedSim.step on the last tick (diagnostics only). */
  readonly lastPedTickMs: number;
  /** Live pedestrian count on the last tick. */
  readonly pedestrians: number;
  /** PR07: the authoritative world hour-of-day (0–24) the env section carries. */
  readonly timeOfDay: number;
  readonly consumers: number;
  readonly running: boolean;
}

export class LivingCityHost {
  readonly sim: VehicleSim;
  readonly pedSim: PedSim;
  readonly signals: SignalSystem;
  /** PR07: the authoritative day/night clock — stepped in lockstep with the sim tick. */
  readonly clock: CityClock;
  private readonly now: () => number;
  private readonly schedule: (cb: () => void) => unknown;
  private readonly cancel: (handle: unknown) => void;
  private readonly focus: (() => { x: number; z: number } | null) | undefined;
  private readonly maxFrameSeconds: number;
  private readonly sinks = new Set<VehicleSnapshotSink>();
  private readonly roster: readonly SignalRosterEntry[];
  private latest: number[] = emptyWorldSnapshot();
  private version = 0;
  private consumers = 0;
  private running = false;
  private handle: unknown = null;
  private last = 0;
  private acc = 0;
  private ticksRun = 0;
  private lastTickMs = 0;
  private lastPedTickMs = 0;

  constructor(options: LivingCityHostOptions) {
    this.signals = options.signals;
    this.now = options.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
    this.schedule =
      options.schedule ??
      ((cb) =>
        typeof requestAnimationFrame === 'function'
          ? requestAnimationFrame(cb)
          : (setTimeout(cb, 1000 * SIM_DT) as unknown));
    this.cancel =
      options.cancel ??
      ((h) =>
        typeof cancelAnimationFrame === 'function'
          ? cancelAnimationFrame(h as number)
          : clearTimeout(h as ReturnType<typeof setTimeout>));
    this.focus = options.focus;
    this.maxFrameSeconds = options.maxFrameSeconds ?? 0.25;
    this.clock = new CityClock({
      startHour: options.timeOfDayHours,
      ...(options.hoursPerSimSecond !== undefined ? { hoursPerSimSecond: options.hoursPerSimSecond } : {}),
    });
    // PR07: the canonical signal roster — packed aspects bind to this
    // ordering, which any runtime rebuilds identically from the same
    // deterministic topology (signal-viz.ts).
    this.roster = signalRoster(options.signals);
    const { topology: _t, signals: _s, now: _n, schedule: _sc, cancel: _c, focus: _f, maxFrameSeconds: _m, timeOfDayHours: _h, hoursPerSimSecond: _r, peds, ...simOptions } = options;
    this.sim = new VehicleSim(options.topology, options.signals, simOptions);
    // The vehicle sim owns the signal clock (it steps signals itself); the
    // ped sim shares the same tick but never double-steps the controllers.
    // The fleet view is wired so uncontrolled crosswalks can gap-check —
    // signalized kerbs don't need it, the solver serializes those.
    this.pedSim = new PedSim(options.topology, options.signals, {
      ...peds,
      advanceSignals: false,
      vehicles: peds?.vehicles ?? (() => this.sim.vehiclesView()),
    });
  }

  /** The most recently published snapshot (never mutated after publish). */
  latestSnapshot(): readonly number[] {
    return this.latest;
  }

  /** One tick of accumulated real time, run immediately (tests + step-driving without a ticker). */
  step(frameSeconds: number): void {
    this.acc += Math.min(Math.max(0, frameSeconds), this.maxFrameSeconds);
    while (this.acc >= SIM_DT) {
      this.acc -= SIM_DT;
      const t0 = this.now();
      // PR07: the world clock moves in lockstep with the sim tick; the
      // sim reads the env it stamped (headlight/rain flags) — never the
      // other way round, so a dusk flip cannot reorder traffic.
      this.clock.step(SIM_DT);
      const env = this.clock.state();
      this.sim.setEnvironment({ headlights: env.headlights === 1, rain: env.rain });
      this.sim.step(SIM_DT);
      this.lastTickMs = this.now() - t0;
      const t1 = this.now();
      this.pedSim.step(SIM_DT);
      this.lastPedTickMs = this.now() - t1;
      this.ticksRun++;
      this.publish();
    }
  }

  /** Subscribe to per-tick snapshots; returns the unsubscribe. Replays the latest immediately. */
  addSink(sink: VehicleSnapshotSink): () => void {
    this.sinks.add(sink);
    sink(this.latest);
    return () => this.sinks.delete(sink);
  }

  removeSink(sink: VehicleSnapshotSink): void {
    this.sinks.delete(sink);
  }

  /** A renderer started consuming: start ticking when the first arrives. */
  attach(): void {
    this.consumers++;
    if (this.consumers === 1) this.start();
  }

  /** A renderer went away: park the ticker when the last leaves (sim state persists). */
  detach(): void {
    this.consumers = Math.max(0, this.consumers - 1);
    if (this.consumers === 0) this.stop();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = 0;
    this.acc = 0;
    this.drive();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.handle !== null) {
      this.cancel(this.handle);
      this.handle = null;
    }
  }

  stats(): LivingCityHostStats {
    return {
      ...this.sim.metrics,
      ticksRun: this.ticksRun,
      lastTickMs: this.lastTickMs,
      lastPedTickMs: this.lastPedTickMs,
      pedestrians: this.pedSim.metrics.pedestrians,
      timeOfDay: this.clock.state().hour,
      consumers: this.consumers,
      running: this.running,
    };
  }

  private drive(): void {
    if (!this.running) return;
    this.handle = this.schedule(() => {
      this.handle = null;
      const t = this.now();
      const dt = this.last > 0 ? (t - this.last) / 1000 : 0;
      this.last = t;
      if (this.focus) {
        const f = this.focus();
        if (f) {
          this.sim.setFocus(f.x, f.z);
          this.pedSim.setFocus(f.x, f.z);
        }
      }
      this.step(dt);
      this.drive();
    });
  }

  private publish(): void {
    this.version++;
    this.latest = packWorldSnapshot(this.version, this.sim, this.pedSim, this.signals, this.clock.state(), this.roster);
    for (const sink of this.sinks) sink(this.latest);
  }
}
