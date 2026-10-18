// Living City PR05 — the feature gate and the singleton host bound to the
// real Harlem/Apollo v3 tile, its signal program and the authored vertical
// slice at 125th Street & Adam Clayton Powell Jr. Boulevard.
//
// PR06: the same host now carries the pedestrian crowd — the authored
// six-pedestrian slice on a real ACP zebra plus a modest ambient sidewalk
// population, published in the appended ped section of the same snapshot.
//
// This is the only file that knows all three of: the bundled dataset, the
// flag, and which concrete junction the slice plays on. Everything it
// re-exports stays usable from both runtimes:
//
//  - JS path: GameScreen adds `livingCityActorFactories()` to the scene's
//    `actors`; the factories lazily build the host on first mount and each
//    read closure reads the host's latest packed snapshot in place.
//  - Worklet path: worklet-host.ts pulls `livingCityHost()`, mirrors each
//    publish into its own Synchronizable, and game-render.ts mounts the same
//    actor factories reading that channel — the sim stays JS-authoritative.
//
// Flag off (default): `livingCityActorFactories()` returns [] and
// `livingCityHost()` returns null, so nothing is built, spawned or
// subscribed — the scene is byte-identical to today.

import { bundledCity } from '../city-data.ts';
import type { FlatPoints } from '../city-dataset.ts';
import { gameCameraStore } from '../game-session.ts';
import type { SceneActorFactory } from '../scene-actor.ts';
import { bundledSignals } from './bundled-signals.ts';
import { bundledTopology } from './bundled-topology.ts';
import { createPedActor } from './ped-actor.ts';
import { LivingCityHost } from './sim-host.ts';
import { EXPERIMENTAL_LIVING_CITY, createVehicleActor, livingCityFactoriesFor } from './vehicle-actor.ts';
import { livingCityPedSlice, livingCityVerticalSlice, type LivingCityPedSlice, type LivingCitySlice } from './vertical-slice.ts';

export { EXPERIMENTAL_LIVING_CITY };
export { LIVING_CITY_SLICE_NODE, livingCityPedSlice, livingCityVerticalSlice } from './vertical-slice.ts';
export type { LivingCityPedSlice, LivingCitySlice, PedSliceSpawn, SliceSpawn } from './vertical-slice.ts';

/** Deterministic seed for the hosted sim — the slice is a scenario, not a dice roll. */
const LIVING_CITY_SEED = 0x1c2026;

/** Ambient vehicle population on top of the authored slice — keeps the tile alive without crowding it. */
const LIVING_CITY_AMBIENT = 12;
/** Ambient sidewalk population on top of the six-ped slice. */
const LIVING_CITY_PED_AMBIENT = 16;

interface LivingCityBundle {
  readonly host: LivingCityHost;
  readonly vehicleFactory: SceneActorFactory;
  readonly pedFactory: SceneActorFactory;
  readonly slice: LivingCitySlice | null;
  readonly pedSlice: LivingCityPedSlice | null;
}

let bundle: LivingCityBundle | null = null;
let obstacleCache: FlatPoints | null = null;

/**
 * Static sidewalk obstacles as flat [x, z, ...] pairs: street trees,
 * hydrants, LinkNYC kiosks, bike racks, subway stairs and bus shelters from
 * the bundled tile's record layers. Furniture arrives as [x, z, rot]
 * triplets — only the position half feeds the ped corridor index.
 */
function bundledObstacles(): FlatPoints {
  if (obstacleCache) return obstacleCache;
  const out: number[] = [];
  const city = bundledCity();
  if (city.ok) {
    const d = city.dataset;
    out.push(...d.trees.census, ...d.trees.fill, ...d.transit.subway, ...d.transit.shelters);
    for (const list of [d.furniture.hydrant, d.furniture.linknyc, d.furniture.bikeRack]) {
      for (let i = 0; i + 1 < list.length; i += 3) out.push(list[i]!, list[i + 1]!);
    }
  }
  obstacleCache = out;
  return out;
}

function create(): LivingCityBundle {
  const topology = bundledTopology();
  const signals = bundledSignals();
  if (!topology || !signals) {
    throw new Error('living-city: bundled topology/signals unavailable');
  }
  const slice = livingCityVerticalSlice(topology);
  const pedSlice = livingCityPedSlice(topology);
  const host = new LivingCityHost({
    topology,
    signals,
    seed: LIVING_CITY_SEED,
    targetVehicles: LIVING_CITY_AMBIENT,
    vehicles: slice?.spawns ?? [],
    peds: {
      seed: LIVING_CITY_SEED ^ 0x5eed,
      peds: pedSlice?.spawns ?? [],
      targetPeds: LIVING_CITY_PED_AMBIENT,
      // Sidewalk furniture from the bundled tile steers the crowd around
      // trees/hydrants/kiosks/racks/shelters that sit inside a band corridor.
      obstacles: bundledObstacles(),
    },
    // The camera's look-at point is the spawn/despawn zone centre; the sim
    // stays renderer-agnostic, the host injects the store read.
    focus: () => {
      const { x, z } = gameCameraStore.getState().camera;
      return { x, z };
    },
  });
  const read = () => host.latestSnapshot();
  const attach = () => host.attach();
  const detach = () => host.detach();
  const vehicleFactory = createVehicleActor({ read, onMount: attach, onUnmount: detach });
  const pedFactory = createPedActor({ read, onMount: attach, onUnmount: detach });
  return { host, vehicleFactory, pedFactory, slice, pedSlice };
}

function livingCityBundle(): LivingCityBundle {
  bundle ??= create();
  return bundle;
}

/** The deferred factories: the host is built when the scene instantiates an actor, not at import. */
const LAZY_VEHICLE_FACTORY: SceneActorFactory = (three) => livingCityBundle().vehicleFactory(three);
const LAZY_PED_FACTORY: SceneActorFactory = (three) => livingCityBundle().pedFactory(three);

/**
 * Scene-actor factories for the JS render path. Flag off → `[]`, so the
 * actors array is identical to pre-PR05 (zero-diff).
 */
export function livingCityActorFactories(): readonly SceneActorFactory[] {
  return livingCityFactoriesFor(EXPERIMENTAL_LIVING_CITY, [LAZY_VEHICLE_FACTORY, LAZY_PED_FACTORY]);
}

/**
 * The authoritative host for the worklet path (worklet-host.ts mirrors its
 * publishes into a Synchronizable and attaches/detaches the ticker itself).
 * Flag off → null.
 */
export function livingCityHost(): LivingCityHost | null {
  return EXPERIMENTAL_LIVING_CITY ? livingCityBundle().host : null;
}

/** Diagnostics only (dev tools / docs): what the slices resolved to on this tile. */
export function livingCitySliceInfo(): LivingCitySlice | null {
  return EXPERIMENTAL_LIVING_CITY ? livingCityBundle().slice : null;
}

export function livingCityPedSliceInfo(): LivingCityPedSlice | null {
  return EXPERIMENTAL_LIVING_CITY ? livingCityBundle().pedSlice : null;
}
