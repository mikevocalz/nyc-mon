// Living City PR05 — the feature gate and the singleton host bound to the
// real Harlem/Apollo v3 tile, its signal program and the authored vertical
// slice at 125th Street & Adam Clayton Powell Jr. Boulevard.
//
// PR06: the same host now carries the pedestrian crowd — the authored
// six-pedestrian slice on a real ACP zebra plus a modest ambient sidewalk
// population, published in the appended ped section of the same snapshot.
//
// PR07: the same host now owns the world clock too, and two more actors
// read the SAME packed snapshot — signal heads + ped displays (the exact
// controller aspects) and clock-driven streetlamp glows layered on the
// world's own streetlight placements. `livingCitySky()` maps the clock's
// hour onto the sky-rig presets so the dome starts in the right phase.
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
import type { SkyName } from '../world/sky-rig.ts';
import { createStreetClearance } from '../world/walkability.ts';
import { bundledSignals } from './bundled-signals.ts';
import { bundledTopology } from './bundled-topology.ts';
import { cityClockSkyName } from './clock.ts';
import { lampPlacements, createLampActor } from './lamp-viz.ts';
import { createPedActor } from './ped-actor.ts';
import { createSignalActor } from './signal-viz.ts';
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
/**
 * The world clock's starting hour — early dusk (18:40) so the slice opens
 * mid-transition: lamps fading up, headlights on, a dusk sky. The clock
 * keeps advancing at the 24× day cycle (clock.ts); a fixed hour can be
 * pinned here for debugging.
 */
export const LIVING_CITY_START_HOUR = 18.66;

interface LivingCityBundle {
  readonly host: LivingCityHost;
  readonly vehicleFactory: SceneActorFactory;
  readonly pedFactory: SceneActorFactory;
  readonly signalFactory: SceneActorFactory;
  readonly lampFactory: SceneActorFactory;
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
    // PR07: the world clock — the one authority for lamps, headlights,
    // blink cadence and the sky pick. It advances with the sim tick at
    // one game-hour per sim-minute, so the dusk transition the slice
    // opens on actually completes during a session.
    timeOfDayHours: LIVING_CITY_START_HOUR,
    hoursPerSimSecond: 1 / 60,
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
  const focus = () => {
    const { x, z } = gameCameraStore.getState().camera;
    return { x, z };
  };
  const vehicleFactory = createVehicleActor({ read, onMount: attach, onUnmount: detach });
  const pedFactory = createPedActor({ read, onMount: attach, onUnmount: detach });
  // PR07: signal heads + ped displays read the packed signal section —
  // the same controller aspects the solver acts on. Lamp glows re-run the
  // world's own streetlight placement (same clearance index the world
  // built, so halos land on the rendered poles exactly).
  const signalFactory = createSignalActor({ read, signals, topology, focus, onMount: attach, onUnmount: detach });
  const city = bundledCity();
  const placements = city.ok ? lampPlacements(city.dataset, createStreetClearance(city.dataset)) : [];
  const lampFactory = createLampActor({ read, placements, focus, onMount: attach, onUnmount: detach });
  return { host, vehicleFactory, pedFactory, signalFactory, lampFactory, slice, pedSlice };
}

function livingCityBundle(): LivingCityBundle {
  bundle ??= create();
  return bundle;
}

/** The deferred factories: the host is built when the scene instantiates an actor, not at import. */
const LAZY_VEHICLE_FACTORY: SceneActorFactory = (three) => livingCityBundle().vehicleFactory(three);
const LAZY_PED_FACTORY: SceneActorFactory = (three) => livingCityBundle().pedFactory(three);
const LAZY_SIGNAL_FACTORY: SceneActorFactory = (three) => livingCityBundle().signalFactory(three);
const LAZY_LAMP_FACTORY: SceneActorFactory = (three) => livingCityBundle().lampFactory(three);

/**
 * Scene-actor factories for the JS render path. Flag off → `[]`, so the
 * actors array is identical to pre-PR05 (zero-diff).
 */
export function livingCityActorFactories(): readonly SceneActorFactory[] {
  return livingCityFactoriesFor(EXPERIMENTAL_LIVING_CITY, [
    LAZY_VEHICLE_FACTORY,
    LAZY_PED_FACTORY,
    LAZY_SIGNAL_FACTORY,
    LAZY_LAMP_FACTORY,
  ]);
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

/** PR07: the authoritative world hour the packed env section carries (null while the flag is off). */
export function livingCityTimeOfDay(): number | null {
  if (!EXPERIMENTAL_LIVING_CITY) return null;
  // Do not force the bundle into existence for a diagnostics read: before
  // the host mounts, the clock sits at the configured start hour.
  return bundle ? bundle.host.clock.state().hour : LIVING_CITY_START_HOUR;
}

/**
 * PR07: the sky-rig preset matching the world clock — the clock is the
 * authority for "what time is it"; the rig renders named presets, so the
 * scene passes this pick at mount (cityClockSkyName in clock.ts owns the
 * hour→preset mapping; the static pick is made once and a live-tracking
 * sky is follow-up work). Flag off → undefined (the world's own default).
 */
export function livingCitySky(): SkyName | undefined {
  const hour = livingCityTimeOfDay();
  if (hour === null) return undefined;
  return cityClockSkyName(hour);
}
