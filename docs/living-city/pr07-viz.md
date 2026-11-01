# PR07 — Signal heads, pedestrian displays, streetlamps and the world clock

Living City PR stack row 07 (`docs/plans/living-city-prompt.md` §10/§13):
the visible half of the simulation. Traffic-signal heads and pedestrian
signal displays now render **the exact controller aspects the solver and
the AI act on** — packed into the same flat actor snapshot, not a second
channel — streetlamps actually switch on through dusk, vehicles show
headlights/taillights/brake lights/turn signals, and one authoritative
world clock feeds all of it plus the sky pick, the lamp drive and the
weather (rain) slot.

## Scope

- **One authoritative clock** (`clock.ts`): `CityClock` lives inside
  `LivingCityHost` and steps in lockstep with the fixed sim tick. It
  publishes `hour`, `dayFactor`, `lampLevel`, `headlights`, `rain` and
  `simTime` in a packed env section appended to the actor snapshot.
  Consumers: lamp glows/pools, vehicle headlight bits, indicator and
  flashing-DON'T-WALK cadence, the sky-preset pick at scene mount, and
  the reserved weather/storefront slots.
- **Signal heads + ped displays** (`signal-viz.ts`): a near-corner pole +
  three-lens head per approach leg of every signalized junction and a
  two-lens ped box per crosswalk end — the `proc:signal-head` /
  `proc:ped-box` primitive recipes (pole + head + visor; pole + box +
  brows), all internally authored.
- **Streetlamp glows** (`lamp-viz.ts`): emissive halo quads and
  pool-of-light decals layered on the **existing** streetlight
  placements — `placeStreetFurniture` output via the same
  `createStreetClearance` index the world builds, so halos land
  pole-for-pole on the furniture the world already renders. No second
  placement pass; no per-lamp shadow-casting lights (spec §10).
- **Vehicle lights** (`vehicle-actor.ts`, `vehicle-sim.ts`): eight light
  quads per vehicle in one instanced mesh — headlamp pair, tail pair,
  front/rear indicator pairs — driven by packed `flags` bits only:
  `VFLAG.headlights` (world env), `VFLAG.braking` (deceleration/holds),
  `VFLAG.blinkLeft`/`VFLAG.blinkRight` (turn intent). Blink/FDW cadence
  runs on the packed sim clock, never wall time.
- **Extended snapshot, not a fork**: vehicle header/records and the ped
  section are untouched; a signal section and an env section append
  behind them. Old buffers (no appended sections) decode with sane
  defaults — lamps off, no heads.
- **Flag-gated**: everything stays behind `EXPO_PUBLIC_LIVING_CITY`.
  Flag off → `livingCityActorFactories()` returns `[]`, the sky param is
  `undefined`, and the scene is byte-identical to pre-PR07.

## Paths

```
packages/app/features/game/living-city/
  clock.ts                # CityClock + dayFactorAt + cityClockSkyName + CSNAP env codec
  signal-viz.ts           # roster/SSIG codec, packWorldSnapshot, placements, proc recipes, signal+ped actor
  lamp-viz.ts             # lampPlacements (world reuse), lampDrive, glow/pool actor
  vehicle-actor.ts        # + VLIGHT slots, vehicleLightKeys, indicatorBlink, one instanced light mesh
  vehicle-sim.ts          # + VFLAG.headlights, SimEnvironment, sim.setEnvironment()
  sim-host.ts             # + CityClock ownership, roster, env feed, packWorldSnapshot publish
  bundled-host.ts         # + signal/lamp factories, LIVING_CITY_START_HOUR, livingCitySky/TimeOfDay
  clock.test.ts           # curve, thresholds, rain, codec, determinism, sky pick
  signal-viz.test.ts      # HONESTY: packed section == SignalSystem.state; layout; placements; lenses
  lamp-viz.test.ts        # lampDrive incl. rain boost; pole-for-pole parity with the world layout
  vehicle-lights.test.ts  # env headlight bit, brake bit, turn bits, colour mapping, cadence
  sim-host.test.ts        # + world-snapshot section test
packages/app/features/game/render-runtime/game-render.ts  # same 4 actor mounts on the worklet
packages/app/features/game/GameScreen.tsx                 # sky: livingCitySky() at mount
```

## Snapshot format (v layout — extended)

```
[vehicle section] VSNAP_HEADER=8 + count×12            (untouched since PR05)
[ped section]     PSNAP_HEADER=4 + count×12            (untouched since PR06)
[signal section]  SSIG_HEADER=4 [count,stride=2,scheme=1,nodes]
                  + count×2 [aspectCode, auxSeconds]
[env section]     CSNAP_HEADER=2 [scheme=1,fields=6]
                  + 6 [hour,dayFactor,lampLevel,headlights,rain,simTime]
```

- The signal section binds to `signalRoster(signals)` — every connector
  then every crosswalk per node, in the deterministic controller
  order. Both runtimes rebuild the identical roster from the identical
  deterministic topology; index → element agrees without shipping ids.
  Aspect codes: connectors 0/1/2 = R/Y/G, crosswalks 0/1/2 = D/F/W.
  `aux` carries the FDW change-interval seconds for countdown displays.
- `envSectionOffset` chains off the signal section; `readEnvSection`
  returns a daytime default on old buffers, so the codec is
  forward/backward compatible in the tested directions.
- Publish is still one fresh array per sim tick — the Synchronizable
  identity rule holds (render-snapshot.ts notes).

## What renders end-to-end

- One `InstancedMesh` of pole+head props (≤320 instances), one of ped
  boxes (≤320), **one** instanced quad mesh for every lens — lit state
  lands in `instanceColor`, so a phase change is a colour write, never a
  rebuild. FDW flashes on the packed sim clock at ~1.6 Hz. Near-field
  sets follow the tree-lod rule (nearest-N within a radius, refresh only
  after a ~10 m focus move).
- One instanced quad mesh for all vehicle lights (8 slots/vehicle):
  white headlamps on `headlights`, dim→bright red tails on
  `headlights`→`braking`, amber corner flashes on the blink bits gated
  by a ~1.4 Hz sim-clock parity.
- One instanced glow-cross mesh (≤256 in 380 m) and one instanced
  light-pool decal mesh (≤64 in 140 m) for the streetlamps; two TSL
  uniforms carry the clock's lamp drive, boosted up to +45 % in rain —
  the whole city's lamps fade through dusk on two uniform writes.
- Sky: `livingCitySky()` maps the clock's start hour onto the rig's
  `morning`/`dusk`/`night` presets at mount (18.66 h → `dusk`). A live
  sky that tracks the running clock is listed under Pending.

## Tests

`node --test` — 138 living-city tests, all pass (118 pre-existing + 20
new):

- `packed signal section decodes to the exact controller state` — the
  honesty test: decode the packed bytes and reproduce
  `SignalSystem.state` element for element at three phase times. What AI
  sees is what the street shows, by construction.
- Lamp on/off thresholds vs the clock curve; rain boost (+45 % cap,
  clamped, never a dimmer); pole-for-pole parity with
  `placeStreetFurniture` output.
- `VFLAG.braking` on a held-red approach; `VFLAG.blinkLeft`/`Right` on
  forced left/right routes; `VFLAG.headlights` on `setEnvironment`.
- Section offset chain (ped → signal → env) and old-buffer defaults —
  layout stability tested both directions.
- Host determinism test (existing) now also pins the signal + env bytes:
  same seed + same frames → byte-identical world snapshot.
- `tsc --noEmit` clean; `eslint` clean (one pre-existing unused-import
  warning in `game-render.ts`, `CallerState`, predates this PR).

## Draw / triangle budget (arithmetic, not a renderer.info capture)

Dynamic actor draws: ≤4 vehicle-class meshes + 1 vehicle-light mesh +
2 ped meshes + 3 signal meshes (heads/boxes/lenses) + 2 lamp meshes
(glows/pools) = **≤12 draws** (PR05's ~10 + this PR's 6; the spec's
"batch/instanced" requirement holds — every phase change is a colour or
uniform write, zero geometry churn).

Triangles, worst case at instance caps:

| layer | instances × tris | tris |
|---|---|---|
| signal heads | 320 × 60 | 19 200 |
| ped boxes | 320 × 48 | 15 360 |
| lens quads | 1 600 × 2 | 3 200 |
| vehicle lights | 384 × 2 | 768 |
| lamp glows | 256 × 4 | 1 024 |
| lamp pools | 64 × 16 | 1 024 |
| **PR07 worst case** | | **≈ 40.6 k** |

Typical near-field (camera at the slice, ~30 signalized junctions in
range): ~120 heads + ~120 boxes + ~1 120 lenses ≈ **15 k** — inside the
~50 k dynamic-actor budget with the vehicles and crowd.

## Licensing / provenance

Unchanged from `ASSET_NOTICES.md` (PR04). All new geometry is internally
authored primitive recipes (`proc:signal-head`, `proc:ped-box`, light
quads, glow crosses, pool decals) — no third-party assets vendored, no
`three:` generator binding added. The NYC signal geometry (side-mount
three-section head, HAND/WALKER combo box) follows the DOT signals page
proportions cited in the plan; the night-street reference informed the
glow/pool *technique* only (additive emissive + decal, re-authored in
TSL/NodeMaterial — its GLSL/WebGL code was not ported).

## Device status

- Node tests pass (above). **Real device render verification is
  pending**: no WebGPU path runs under `node --test`; the mounted
  heads/glows/lights have not been eyeballed on device. No simulator or
  device run was attempted — honest status: sim + codec + placements +
  flags + gate verified headless; draw/triangle numbers are arithmetic
  from the recipes and instance caps, not a `renderer.info` capture.
- The worklet path mounts the same four actors against the same
  Synchronizable channel — same unverified-device caveat; the roster is
  rebuilt deterministically on the runtime, so no extra data crosses the
  bridge.
- TSL materials used: `MeshBasicNodeMaterial` + `uv()`/`smoothstep`/
  `uniform`/`vec4` — the installed three@0.186.1 NodeMaterial path. No
  shadow maps (rn-webgpu has none); no per-lamp point lights anywhere.

## Pending / next

- **Live sky tracking**: the rig takes a named preset at mount; crossing
  a dusk boundary mid-session does not re-pick. Needs a sky-rig
  interpolation or a re-mount trigger — follow-up.
- **Windows/storefronts/weather materials**: the env section already
  carries `dayFactor`/`lampLevel`/`rain`; the building-window lit share
  and rain overlays are consumers still to wire (documented in clock.ts
  as reserved readers, no fake wiring added).
- **Countdown digits**: `SSIG` aux packs the FDW seconds; digit
  rendering on the ped box is a later lane.
- Lamp glows/pools layer on top of the world's authored subtle pools —
  they fade *up* through dusk but do not dim the static base layer;
  folding the static pool into the same uniform is a world-materials
  follow-up, not duplicated here.
- GLB signal-head tier stays `pending-verification` per ASSET_NOTICES;
  `resolveVehicleEntry`-style swap points are not needed — the recipe is
  the primitive tail.

## Rollback

Unset `EXPO_PUBLIC_LIVING_CITY` — nothing mounts, and `livingCitySky()`
returns `undefined` so the sky param is absent as before. `git revert`
this commit restores the PR06 snapshot shape: both new sections are
appended, never woven in, and every reader defaults sanely on old
buffers (tested).
