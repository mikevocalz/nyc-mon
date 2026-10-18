// Living City PR05 — the feature gate and the singleton host bound to the
// real Harlem/Apollo v3 tile, its signal program and the authored vertical
// slice at 125th Street & Adam Clayton Powell Jr. Boulevard.
//
// This is the only file that knows all three of: the bundled dataset, the
// flag, and which concrete junction the slice plays on. Everything it
// re-exports stays usable from both runtimes:
//
//  - JS path: GameScreen adds `livingCityVehicleActorFactories()` to the
//    scene's `actors`; the factory lazily builds the host on first mount and
//    its read closure reads the host's latest packed snapshot in place.
//  - Worklet path: worklet-host.ts pulls `livingCityHost()`, mirrors each
//    publish into its own Synchronizable, and game-render.ts mounts the same
//    actor factory reading that channel — the sim stays JS-authoritative.
//
// Flag off (default): `livingCityVehicleActorFactories()` returns [] and
// `livingCityHost()` returns null, so nothing is built, spawned or
// subscribed — the scene is byte-identical to today.

import { gameCameraStore } from '../game-session.ts';
import type { SceneActorFactory } from '../scene-actor.ts';
import { bundledSignals } from './bundled-signals.ts';
import { bundledTopology } from './bundled-topology.ts';
import { LivingCityHost } from './sim-host.ts';
import { EXPERIMENTAL_LIVING_CITY, createVehicleActor, livingCityFactoriesFor } from './vehicle-actor.ts';
import { livingCityVerticalSlice, type LivingCitySlice } from './vertical-slice.ts';

export { EXPERIMENTAL_LIVING_CITY };
export { LIVING_CITY_SLICE_NODE, livingCityVerticalSlice, type LivingCitySlice, type SliceSpawn } from './vertical-slice.ts';

/** Deterministic seed for the hosted sim — the slice is a scenario, not a dice roll. */
const LIVING_CITY_SEED = 0x1c2026;

/** Ambient population on top of the authored slice — keeps the tile alive without crowding it. */
const LIVING_CITY_AMBIENT = 12;

interface LivingCityBundle {
  readonly host: LivingCityHost;
  readonly factory: SceneActorFactory;
  readonly slice: LivingCitySlice | null;
}

let bundle: LivingCityBundle | null = null;

function create(): LivingCityBundle {
  const topology = bundledTopology();
  const signals = bundledSignals();
  if (!topology || !signals) {
    throw new Error('living-city: bundled topology/signals unavailable');
  }
  const slice = livingCityVerticalSlice(topology);
  const host = new LivingCityHost({
    topology,
    signals,
    seed: LIVING_CITY_SEED,
    targetVehicles: LIVING_CITY_AMBIENT,
    vehicles: slice?.spawns ?? [],
    // The camera's look-at point is the spawn/despawn zone centre; the sim
    // stays renderer-agnostic, the host injects the store read.
    focus: () => {
      const { x, z } = gameCameraStore.getState().camera;
      return { x, z };
    },
  });
  const factory = createVehicleActor({
    read: () => host.latestSnapshot(),
    onMount: () => host.attach(),
    onUnmount: () => host.detach(),
  });
  return { host, factory, slice };
}

function livingCityBundle(): LivingCityBundle {
  bundle ??= create();
  return bundle;
}

/** The deferred factory: the host is built when the scene instantiates the actor, not at import. */
const LAZY_VEHICLE_FACTORY: SceneActorFactory = (three) => livingCityBundle().factory(three);

/**
 * Scene-actor factories for the JS render path. Flag off → `[]`, so the
 * actors array is identical to pre-PR05 (zero-diff).
 */
export function livingCityVehicleActorFactories(): readonly SceneActorFactory[] {
  return livingCityFactoriesFor(EXPERIMENTAL_LIVING_CITY, [LAZY_VEHICLE_FACTORY]);
}

/**
 * The authoritative host for the worklet path (worklet-host.ts mirrors its
 * publishes into a Synchronizable and attaches/detaches the ticker itself).
 * Flag off → null.
 */
export function livingCityHost(): LivingCityHost | null {
  return EXPERIMENTAL_LIVING_CITY ? livingCityBundle().host : null;
}

/** Diagnostics only (dev tools / docs): what the slice resolved to on this tile. */
export function livingCitySliceInfo(): LivingCitySlice | null {
  return EXPERIMENTAL_LIVING_CITY ? livingCityBundle().slice : null;
}
