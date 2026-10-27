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

import { callerStore, selectCallerTransform } from '../character/caller-store.ts';
import { bundledCity } from '../city-data.ts';
import { CURB_HEIGHT } from '../world/curb.ts';
import type { FlatPoints } from '../city-dataset.ts';
import { gameCameraStore } from '../game-session.ts';
import { createLivingCityAdaptive, LIVING_CITY_CAPS, resolveLivingCityTier, type LivingCityCaps, type LivingCityTier } from '../perf/tier.ts';
import type { SceneActorFactory } from '../scene-actor.ts';
import type { SkyName } from '../world/sky-rig.ts';
import { placeStreetFurniture } from '../world/street-furniture.ts';
import { EXPERIMENTAL_WORLD_VD } from '../world/vd-materials.ts';
import { FUTURE_LAYER } from '../world/future-layer.ts';
import { EXPERIMENTAL_WORLD_PHYSICAL, physicalFeaturesFor, WORLD_PROBE } from '../world/physical-look.ts';
import { loadPhysicalFacelift } from '../physical-graph.ts';
import { createStreetClearance } from '../world/walkability.ts';
import { bundledSignals } from './bundled-signals.ts';
import { bundledTopology } from './bundled-topology.ts';
import { cityClockSkyName } from './clock.ts';
import { lampPlacements, createLampActor } from './lamp-viz.ts';
import { createPedActor } from './ped-actor.ts';
import { createSignalActor } from './signal-viz.ts';
import { LivingCityHost } from './sim-host.ts';
import { livingCityAdaptiveBridge } from './adaptive-bridge.ts';
import { EXPERIMENTAL_LIVING_CITY, createVehicleActor, livingCityFactoriesFor } from './vehicle-actor.ts';
import { livingCityPedSlice, livingCityVerticalSlice, type LivingCityPedSlice, type LivingCitySlice } from './vertical-slice.ts';

export { EXPERIMENTAL_LIVING_CITY };
export { LIVING_CITY_SLICE_NODE, livingCityPedSlice, livingCityVerticalSlice } from './vertical-slice.ts';
export type { LivingCityPedSlice, LivingCitySlice, PedSliceSpawn, SliceSpawn } from './vertical-slice.ts';

/** Deterministic seed for the hosted sim — the slice is a scenario, not a dice roll. */
const LIVING_CITY_SEED = 0x1c2026;

/** Ambient vehicle population on top of the authored slice — keeps the tile alive without crowding it. */
export const LIVING_CITY_AMBIENT = 12;
/** Ambient sidewalk population on top of the six-ped slice. */
export const LIVING_CITY_PED_AMBIENT = 16;

// --- PR09: actor/LOD tier ------------------------------------------------------------
//
// The crowd/detail caps live in perf/tier.ts (LIVING_CITY_CAPS) so the
// world tier's bundle row can name a living-city rung directly
// (phone → 'medium', high → 'high'). Resolution order:
// EXPO_PUBLIC_LIVING_CITY_TIER (explicit) > the selected world tier's row
// > 'high' — and 'high' is exactly the authored PR05–07 counts above, so
// with nothing set the city is byte-identical to before PR09. The
// ambient defaults stay exported for tests and docs.

/** The tier the running bundle is using — mutable for the adaptive step-down. */
let activeTier: LivingCityTier = resolveLivingCityTier();

/** The active living-city caps — the mount-time read (create() consumes this). */
export function livingCityCaps(): LivingCityCaps {
  return LIVING_CITY_CAPS[activeTier];
}

/** The tier name the host is running at — diagnostics only. */
export function livingCityTier(): LivingCityTier {
  return activeTier;
}

/**
 * Apply a living-city tier live. Population caps (vehicles/peds) take
 * effect immediately on the mounted host (graceful — excess ambient
 * actors retire off-camera); the mount-time knobs (signal near-field
 * caps, the lamp actor's presence) only apply to a bundle built after
 * the call — honest split, documented in pr09-perf.md.
 */
export function livingCitySetTier(tier: LivingCityTier): LivingCityTier {
  activeTier = tier;
  const caps = LIVING_CITY_CAPS[tier];
  bundle?.host.setPopulationCaps({ vehicles: caps.vehicles, peds: caps.peds });
  return activeTier;
}

/**
 * PR09 adaptive response: the render-scale controller's surrendered scale
 * steps the crowd down one tier at a time — the mark schedule lives in
 * createLivingCityAdaptive (perf/tier.ts): first step below 0.75, the
 * next another quarter lower, 'low' is the floor. One-way by design: a
 * recovered scale does not re-fill the crowd mid-session (a refill burst
 * is exactly the hitch the step-down avoids). Dead unless both the
 * living-city and render-scale flags are on — the call site gates.
 */
const adaptive = createLivingCityAdaptive();

export function livingCityAdaptiveFrame(scale: number): LivingCityTier | null {
  if (!EXPERIMENTAL_LIVING_CITY) return null;
  const next = adaptive.frame(scale, activeTier);
  if (next === null) return null;
  livingCitySetTier(next);
  globalThis.console?.info?.('[NYC-Mon/perf] living-city crowd tier', { tier: next, scale: Number(scale.toFixed(3)) });
  return next;
}

// Register for the scene's per-frame call through the import-free bridge —
// this module only evaluates via flag-gated call sites, so `frame` being set
// is itself the flag-on proof (living-city/adaptive-bridge.ts).
livingCityAdaptiveBridge.frame = livingCityAdaptiveFrame;
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
  /** Null on the 'low' tier — the glow/pool layer is cosmetic and unmounted there. */
  readonly lampFactory: SceneActorFactory | null;
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
  // PR09: the resolved actor tier caps the ambient populations and the
  // signal near-field sets; 'high' (the unset default) is exactly the
  // authored PR05–07 counts above.
  const caps = livingCityCaps();
  const host = new LivingCityHost({
    topology,
    signals,
    seed: LIVING_CITY_SEED,
    targetVehicles: caps.vehicles,
    vehicles: slice?.spawns ?? [],
    peds: {
      seed: LIVING_CITY_SEED ^ 0x5eed,
      peds: pedSlice?.spawns ?? [],
      targetPeds: caps.peds,
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
    // The Caller is a live traffic obstacle: vehicles hold behind it
    // mid-lane. Same module-scope store the render loop packs each frame —
    // unspawned returns null and the channel stays closed.
    caller: () => selectCallerTransform(callerStore.getState()),
  });
  const read = () => host.latestSnapshot();
  const attach = () => host.attach();
  const detach = () => host.detach();
  const focus = () => {
    const { x, z } = gameCameraStore.getState().camera;
    return { x, z };
  };
  const vehicleFactory = createVehicleActor({ read, onMount: attach, onUnmount: detach, focus });
  const city0 = bundledCity();
  const walkClearance = city0.ok && CURB_HEIGHT > 0 ? createStreetClearance(city0.dataset) : null;
  const pedFactory = createPedActor({
    read, onMount: attach, onUnmount: detach,
    ...(walkClearance ? { groundY: (x: number, z: number) => (walkClearance.inCarriageway(x, z, 0) ? 0 : CURB_HEIGHT) } : {}),
  });
  // PR07: signal heads + ped displays read the packed signal section —
  // the same controller aspects the solver acts on. Pole/box bases run
  // through the world's own clearance index so nothing stands in the
  // carriageway. Lamp glows re-run the world's own streetlight placement
  // (same index, so halos land on the rendered poles exactly).
  const city = bundledCity();
  const clearance = city.ok ? createStreetClearance(city.dataset) : undefined;
  const signalFactory = createSignalActor({
    read,
    signals,
    topology,
    focus,
    clearance,
    // One pole per corner: heads and ped boxes mount on the street-sign pole when one stands there.
    mastAnchors: city.ok && clearance ? placeStreetFurniture(city.dataset, clearance).signs : [],
    onMount: attach,
    onUnmount: detach,
    headCap: caps.signalHeadCap,
    pedCap: caps.pedBoxCap,
  });
  const placements = city.ok ? lampPlacements(city.dataset, clearance) : [];
  // PR09: the lamp glow/pool layer is the cosmetic rung — 'low' leaves it unmounted.
  const lampFactory = caps.lampGlow
    ? createLampActor({
        read, placements, focus, onMount: attach, onUnmount: detach,
        // The vd lane draws no light pools on the pavement (Valdrada lights the street, it does not paint it).
        ...(EXPERIMENTAL_WORLD_VD ? { poolCap: 0 } : {}),
        // The physical city with the facelift on lights its lamps in the LED colour, as the world's pools do.
        ...(physicalFeaturesFor(EXPERIMENTAL_WORLD_PHYSICAL, WORLD_PROBE, false)?.pbrMaterials && FUTURE_LAYER
          ? { color: loadPhysicalFacelift().FACELIFT_STREETLIGHT.linear }
          : {}),
      })
    : null;
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
const LAZY_LAMP_FACTORY: SceneActorFactory = (three) => {
  const factory = livingCityBundle().lampFactory;
  // Defensive: a 'low' tier resolved after this factory list was handed
  // out must still not crash the mount — an empty no-op actor.
  if (!factory) {
    const T = three as { Group: new () => unknown };
    return { id: 'living-city:lamps', object: new T.Group(), update: () => false, dispose: () => {} };
  }
  return factory(three);
};

/**
 * Scene-actor factories for the JS render path. Flag off → `[]`, so the
 * actors array is identical to pre-PR05 (zero-diff). PR09: the 'low'
 * tier's lampGlow cap omits the lamp factory here so the actor never
 * mounts (population caps are a host option, applied inside create()).
 */
export function livingCityActorFactories(): readonly SceneActorFactory[] {
  return livingCityFactoriesFor(
    EXPERIMENTAL_LIVING_CITY,
    livingCityCaps().lampGlow
      ? [LAZY_VEHICLE_FACTORY, LAZY_PED_FACTORY, LAZY_SIGNAL_FACTORY, LAZY_LAMP_FACTORY]
      : [LAZY_VEHICLE_FACTORY, LAZY_PED_FACTORY, LAZY_SIGNAL_FACTORY],
  );
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
