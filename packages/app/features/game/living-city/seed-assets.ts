// Seed candidates for the WorldAssetRegistry (Living City PR04, spec §5).
//
// Per docs/living-city/asset-ledger.md (Scout C, lane-lcaudit):
// - Kenney Car Kit 3.1 GLBs are CC0 but the license file was bundled by
//   fable-cities' author — registered by URI only, `pending-verification`
//   until kenney.nl is re-fetched and hash-compared. NOT vendored.
// - Quaternius UBC/UAL and Kenney animated characters: CC0 per publisher
//   pages, `pending-verification` until the exact downloaded zip's license
//   file is checked. NOT vendored.
// - three.js generators are MIT and already vendored inside
//   three@0.186.1 — the only zero-download procedural sources, `ready`.
// - Primitive-fallback recipes are ours (`internal`), `ready`.
// - No CC0/verified bus mesh exists yet — `vehicle.bus` seeds procedural
//   only; the chain still bottoms out at its primitive box.
// - Mixamo is deliberately absent: Adobe terms forbid redistributing raw
//   skeletons/clips (ledger: "never tag cc0", prototyping only).

import type { WorldAssetEntry } from './asset-registry.ts';

const THREE_EXAMPLES = 'three:examples/jsm/generators/city';

export const SEED_ASSETS: readonly WorldAssetEntry[] = [
  // ── vehicle.sedan ──────────────────────────────────────────────────────
  {
    id: 'vehicle.sedan',
    variant: 'kenney-sedan',
    kind: 'vehicle',
    source: 'glb',
    uri: 'assets/living-city/vehicles/kenney-car-kit-3.1/sedan.glb',
    bounds: { lengthM: 4.5, widthM: 1.8, heightM: 1.45 },
    pivot: 'ground-center',
    forwardAxis: '+Z',
    upAxis: '+Y',
    license: 'CC0-1.0',
    status: 'pending-verification',
    provenance: {
      sourcePageUrl: 'https://kenney.nl/assets/car-kit',
      originalFileUrl:
        'https://github.com/rawprogress/fable-cities/blob/main/public/assets/simulation/models/sedan.glb',
      author: 'Kenney Vleugels (kenney.nl), Car Kit 3.1',
      licenseVerified: false,
      note: 'Ledger hedge: KENNEY_LICENSE.txt was bundled by fable-cities, not fetched by us — re-fetch kenney.nl Car Kit 3.1 and SHA-256 compare before vendoring. Bounds are declared targets; measure the GLB on import.',
    },
  },
  {
    id: 'vehicle.sedan',
    variant: 'three-car-generator',
    kind: 'vehicle',
    source: 'procedural',
    uri: `${THREE_EXAMPLES}/CarGenerator.js`,
    params: { body: 'sedan' },
    bounds: { lengthM: 4.5, widthM: 1.8, heightM: 1.45 },
    pivot: 'ground-center',
    forwardAxis: '+Z',
    upAxis: '+Y',
    license: 'MIT',
    status: 'ready',
    provenance: {
      generatorUrl: 'https://github.com/mrdoob/three.js/blob/dev/examples/jsm/generators/city/CarGenerator.js',
      author: 'three.js authors',
      licenseVerified: true,
      note: 'Vendored inside installed three@0.186.1 — no download, no hotlink.',
    },
  },
  {
    id: 'vehicle.sedan',
    variant: 'box',
    kind: 'vehicle',
    source: 'primitive-fallback',
    uri: 'proc:box-car',
    params: { body: 'sedan' },
    bounds: { lengthM: 4.5, widthM: 1.8, heightM: 1.5 },
    pivot: 'ground-center',
    forwardAxis: '+Z',
    upAxis: '+Y',
    license: 'internal',
    status: 'ready',
    provenance: { licenseVerified: true, note: 'Body box + cabin box + 4 wheel cylinders, marked with a forward-facing nose marker.' },
  },

  // ── vehicle.van ────────────────────────────────────────────────────────
  {
    id: 'vehicle.van',
    variant: 'kenney-van',
    kind: 'vehicle',
    source: 'glb',
    uri: 'assets/living-city/vehicles/kenney-car-kit-3.1/van.glb',
    bounds: { lengthM: 4.9, widthM: 2.0, heightM: 2.15 },
    pivot: 'ground-center',
    forwardAxis: '+Z',
    upAxis: '+Y',
    license: 'CC0-1.0',
    status: 'pending-verification',
    provenance: {
      sourcePageUrl: 'https://kenney.nl/assets/car-kit',
      originalFileUrl:
        'https://github.com/rawprogress/fable-cities/blob/main/public/assets/simulation/models/van.glb',
      author: 'Kenney Vleugels (kenney.nl), Car Kit 3.1',
      licenseVerified: false,
      note: 'Same hash-recheck hedge as kenney-sedan.',
    },
  },
  {
    id: 'vehicle.van',
    variant: 'proc-van',
    kind: 'vehicle',
    source: 'procedural',
    uri: 'proc:box-van',
    params: { body: 'panel-van' },
    bounds: { lengthM: 4.9, widthM: 2.0, heightM: 2.15 },
    pivot: 'ground-center',
    forwardAxis: '+Z',
    upAxis: '+Y',
    license: 'internal',
    status: 'ready',
    provenance: { licenseVerified: true, note: 'Ledger fallback: procedural van box until a verified van/box-truck pack lands.' },
  },
  {
    id: 'vehicle.van',
    variant: 'box',
    kind: 'vehicle',
    source: 'primitive-fallback',
    uri: 'proc:box-car',
    params: { body: 'van' },
    bounds: { lengthM: 4.9, widthM: 2.0, heightM: 2.2 },
    pivot: 'ground-center',
    forwardAxis: '+Z',
    upAxis: '+Y',
    license: 'internal',
    status: 'ready',
    provenance: { licenseVerified: true },
  },

  // ── vehicle.bus ────────────────────────────────────────────────────────
  // No verified CC0/GLB bus exists yet (ledger: "pending — no CC0 bus found
  // yet"). Chain intentionally starts at procedural; primitive is the tail.
  {
    id: 'vehicle.bus',
    variant: 'proc-bus',
    kind: 'vehicle',
    source: 'procedural',
    uri: 'proc:box-bus',
    params: { body: 'city-bus', axles: 2 },
    bounds: { lengthM: 12.0, widthM: 2.55, heightM: 3.1 },
    pivot: 'ground-center',
    forwardAxis: '+Z',
    upAxis: '+Y',
    license: 'internal',
    status: 'ready',
    provenance: {
      licenseVerified: true,
      note: 'Stretched box bus (M60/M102 silhouette) pending a licensed bus GLB or a three.js CarGenerator variant.',
    },
  },
  {
    id: 'vehicle.bus',
    variant: 'box',
    kind: 'vehicle',
    source: 'primitive-fallback',
    uri: 'proc:box-car',
    params: { body: 'bus' },
    bounds: { lengthM: 12.0, widthM: 2.55, heightM: 3.1 },
    pivot: 'ground-center',
    forwardAxis: '+Z',
    upAxis: '+Y',
    license: 'internal',
    status: 'ready',
    provenance: { licenseVerified: true },
  },

  // ── ped.adult ──────────────────────────────────────────────────────────
  {
    id: 'ped.adult',
    variant: 'quaternius-ubc',
    kind: 'pedestrian',
    source: 'glb',
    uri: 'assets/living-city/characters/quaternius-ubc-1.0/adult.glb',
    animations: { idle: 'Idle', walk: 'Walk', run: 'Run', sit: 'Sit' },
    fallbackPose: 'idle',
    bounds: { lengthM: 0.45, widthM: 0.55, heightM: 1.75 },
    pivot: 'feet',
    forwardAxis: '+Z',
    upAxis: '+Y',
    license: 'CC0-1.0',
    status: 'pending-verification',
    provenance: {
      sourcePageUrl: 'https://quaternius.com/packs/universalbasecharacters.html',
      author: 'Quaternius — Universal Base Characters v1.0 + Universal Animation Library',
      licenseVerified: false,
      note: 'Ledger hedge: verify the exact downloaded zip + bundled license (site states CC0, ~60–70% of pack is free tier). Clip names come from UAL retarget (walk/run/idle/sit verified listed). 13k-tri rig — hero/foreground tier only. Missing states render as the idle pose.',
    },
  },
  {
    id: 'ped.adult',
    variant: 'three-person-generator',
    kind: 'pedestrian',
    source: 'procedural',
    uri: `${THREE_EXAMPLES}/PersonGenerator.js`,
    animations: { idle: 'pose-standing', walk: 'pose-walking' },
    fallbackPose: 'idle',
    bounds: { lengthM: 0.45, widthM: 0.55, heightM: 1.7 },
    pivot: 'feet',
    forwardAxis: '+Z',
    upAxis: '+Y',
    license: 'MIT',
    status: 'ready',
    provenance: {
      generatorUrl: 'https://github.com/mrdoob/three.js/blob/dev/examples/jsm/generators/city/PersonGenerator.js',
      author: 'three.js authors',
      licenseVerified: true,
      note: 'Installed three@0.186.1. Posed low-poly instanced people (not rigged); states beyond idle/walk render as the standing pose.',
    },
  },
  {
    id: 'ped.adult',
    variant: 'box',
    kind: 'pedestrian',
    source: 'primitive-fallback',
    uri: 'proc:person-2box',
    bounds: { lengthM: 0.45, widthM: 0.55, heightM: 1.7 },
    pivot: 'feet',
    forwardAxis: '+Z',
    upAxis: '+Y',
    license: 'internal',
    status: 'ready',
    provenance: { licenseVerified: true, note: 'metro-live pattern: torso box + legs box. No clips; every state is the idle pose.' },
  },

  // ── ped.kid ────────────────────────────────────────────────────────────
  {
    id: 'ped.kid',
    variant: 'kenney-animated',
    kind: 'pedestrian',
    source: 'glb',
    uri: 'assets/living-city/characters/kenney-animated/kid.glb',
    animations: { idle: 'idle', walk: 'walk', run: 'run' },
    fallbackPose: 'idle',
    bounds: { lengthM: 0.35, widthM: 0.4, heightM: 1.15 },
    pivot: 'feet',
    forwardAxis: '+Z',
    upAxis: '+Y',
    license: 'CC0-1.0',
    status: 'pending-verification',
    provenance: {
      sourcePageUrl: 'https://kenney.nl/assets/animated-characters-protagonists',
      author: 'Kenney Vleugels (kenney.nl), Animated Characters',
      licenseVerified: false,
      note: 'Ledger hedge: verify the pack\'s bundled license file at download; rig convention differs from Quaternius — retarget before reuse. Clip names are provisional until import.',
    },
  },
  {
    id: 'ped.kid',
    variant: 'three-person-generator-kid',
    kind: 'pedestrian',
    source: 'procedural',
    uri: `${THREE_EXAMPLES}/PersonGenerator.js`,
    params: { scale: 0.68 },
    animations: { idle: 'pose-standing', walk: 'pose-walking' },
    fallbackPose: 'idle',
    bounds: { lengthM: 0.35, widthM: 0.4, heightM: 1.15 },
    pivot: 'feet',
    forwardAxis: '+Z',
    upAxis: '+Y',
    license: 'MIT',
    status: 'ready',
    provenance: {
      generatorUrl: 'https://github.com/mrdoob/three.js/blob/dev/examples/jsm/generators/city/PersonGenerator.js',
      author: 'three.js authors',
      licenseVerified: true,
      note: 'Same generator as ped.adult at 0.68 scale — kid silhouette without a second rig.',
    },
  },
  {
    id: 'ped.kid',
    variant: 'box',
    kind: 'pedestrian',
    source: 'primitive-fallback',
    uri: 'proc:person-2box',
    params: { scale: 0.68 },
    bounds: { lengthM: 0.35, widthM: 0.4, heightM: 1.15 },
    pivot: 'feet',
    forwardAxis: '+Z',
    upAxis: '+Y',
    license: 'internal',
    status: 'ready',
    provenance: { licenseVerified: true },
  },

  // ── prop.signalhead ────────────────────────────────────────────────────
  {
    id: 'prop.signalhead',
    variant: 'three-trafficlight-generator',
    kind: 'prop',
    source: 'procedural',
    uri: `${THREE_EXAMPLES}/TrafficlightGenerator.js`,
    bounds: { lengthM: 0.45, widthM: 0.35, heightM: 1.05 },
    pivot: 'ground-center',
    forwardAxis: '+Z',
    upAxis: '+Y',
    license: 'MIT',
    status: 'ready',
    provenance: {
      generatorUrl: 'https://github.com/mrdoob/three.js/blob/dev/examples/jsm/generators/city/TrafficlightGenerator.js',
      author: 'three.js authors',
      licenseVerified: true,
      note: 'NYC mast-arm + 3-lens geometry only — its material is decorative (hardcoded lit green lens); PR07 re-authors lens emissive driven by the controller aState attribute.',
    },
  },
  {
    id: 'prop.signalhead',
    variant: 'box',
    kind: 'prop',
    source: 'primitive-fallback',
    uri: 'proc:signal-head',
    bounds: { lengthM: 0.45, widthM: 0.35, heightM: 1.05 },
    pivot: 'ground-center',
    forwardAxis: '+Z',
    upAxis: '+Y',
    license: 'internal',
    status: 'ready',
    provenance: { licenseVerified: true, note: 'Pole cylinder + head box + 3 lens markers.' },
  },
];

// ── Slop-grade lofted fleet (EXPO_PUBLIC_WORLD_PHYSICAL) ───────────────────
// One recipe per sim VehicleKind. They live outside SEED_ASSETS so the
// default registry, and every test pinned to it, is unchanged with the flag
// off. `vehicleKind` names the sim class the recipe draws: sedan and taxi
// share the `vehicle.sedan` id (VEHICLE_SEMANTIC_ID), and the taxi's roof
// sign comes from its kind, not from its paint. Geometry and material:
// lofted-car.ts and lofted-car-material.ts, ported from Slop New York.
// Bounds are the built meshes' measured extents, mirrors included
// (lofted-car.test.ts pins them to 1 cm).

const SLOP_PROVENANCE = {
  generatorUrl: 'https://github.com/mrdoob/slop-newyork/blob/be65d0a/js/actor-models.js',
  author: 'Mr.doob (Ricardo Cabello), Slop New York; LoftGeometry and CarGenerator by the three.js authors',
  licenseVerified: true,
} as const;

export const LOFTED_VEHICLE_ASSETS: readonly WorldAssetEntry[] = [
  {
    id: 'vehicle.sedan',
    variant: 'slop-lofted-sedan',
    kind: 'vehicle',
    source: 'procedural',
    uri: 'proc:lofted-car',
    params: { body: 'sedan', vehicleKind: 'sedan' },
    bounds: { lengthM: 4.55, widthM: 2.11, heightM: 1.46 },
    pivot: 'ground-center',
    forwardAxis: '+Z',
    upAxis: '+Y',
    license: 'MIT',
    status: 'ready',
    provenance: { ...SLOP_PROVENANCE, note: 'Slop BODY_SPECS.sedan, ported to plain arrays (no three import) so the worklet runtime can build it.' },
  },
  {
    id: 'vehicle.sedan',
    variant: 'slop-lofted-taxi',
    kind: 'vehicle',
    source: 'procedural',
    uri: 'proc:lofted-car',
    params: { body: 'taxi', vehicleKind: 'taxi' },
    bounds: { lengthM: 4.55, widthM: 2.11, heightM: 1.65 },
    pivot: 'ground-center',
    forwardAxis: '+Z',
    upAxis: '+Y',
    license: 'MIT',
    status: 'ready',
    provenance: { ...SLOP_PROVENANCE, note: 'Slop BODY_SPECS.taxi: the sedan body with the medallion roof sign, gated on the taxi kind.' },
  },
  {
    id: 'vehicle.van',
    variant: 'slop-lofted-van',
    kind: 'vehicle',
    source: 'procedural',
    uri: 'proc:lofted-car',
    params: { body: 'suv', vehicleKind: 'van' },
    bounds: { lengthM: 4.65, widthM: 2.21, heightM: 1.8 },
    pivot: 'ground-center',
    forwardAxis: '+Z',
    upAxis: '+Y',
    license: 'MIT',
    status: 'ready',
    provenance: { ...SLOP_PROVENANCE, note: 'Slop has no van; BODY_SPECS.suv is its tallest car body.' },
  },
  {
    id: 'vehicle.bus',
    variant: 'slop-lofted-bus',
    kind: 'vehicle',
    source: 'procedural',
    uri: 'proc:lofted-bus',
    params: { body: 'bus', vehicleKind: 'bus' },
    bounds: { lengthM: 11.83, widthM: 2.87, heightM: 3.26 },
    pivot: 'ground-center',
    forwardAxis: '+Z',
    upAxis: '+Y',
    license: 'MIT',
    status: 'ready',
    provenance: { ...SLOP_PROVENANCE, note: 'Slop BUS_SPEC (40-ft low-floor MTA bus); static tyres in the body mesh.' },
  },
];

/** The registry seed with the lofted fleet ranked ahead of the box recipes; the vehicle actor uses it when the physical flag is on. */
export const PHYSICAL_SEED_ASSETS: readonly WorldAssetEntry[] = [...SEED_ASSETS, ...LOFTED_VEHICLE_ASSETS];
