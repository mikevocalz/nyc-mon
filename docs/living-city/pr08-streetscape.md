# PR08 — Streetscape quality pass: record furniture, parapet lips, one daypart for every lane

Living City PR stack row 08 (`docs/plans/living-city-prompt.md` §8/§13):
the NYC streetscape quality pass. The brief was *quality, not features* —
look at what the v3 detail bits and the existing furniture systems already
render and close the honest gaps that keep Harlem from reading as Harlem,
without duplicating a single existing system or adding a draw call.

The gap analysis came first and it rejected most of the candidate work
(storefront density, awnings, extra props — all already there, see
below). Three real gaps survived the audit:

1. **The v3 record furniture never rendered.** `dataset.furniture` —
   687 DOT hydrant, 56 LinkNYC and 567 bike-rack `[x, z, rot]` triplets —
   was parsed since the v3 tile landed, and the pedestrian sim already
   avoids those points as obstacles (`bundledObstacles`,
   `living-city/bundled-host.ts`). The crowd detoured around invisible
   objects; the props themselves were not drawn anywhere.
2. **The roofline read thin.** Every corniced masonry street face got a
   cornice ledge and nothing behind it — no brick parapet lip, the thing
   a New York block actually terminates in.
3. **The daypart only reached the glass lane.** `timeOfDay` (the
   dayFactor-derived lit share) was a glass-lane option; the cel and PBR
   facade shaders glowed at the authored dusk share whatever sky the
   clock picked.

## What was deliberately not built

Checked against the code before touching anything (`EXISTING_SYSTEMS_AUDIT.md`
plus a fresh count on the real tile):

- **Storefront/vitality band** — already record-driven: `d` bit 16 gates
  the shop front, `sh` sets the band height, `ww` the bay module; 1,399
  storefronts, 2,600 awnings, 490 shop signs on the tile. Density and
  contrast judged adequate — no second awning system, no extra glow.
- **Street-level props** — parked cars (2,349), streetlights (420),
  signs (164), baskets (236), subway entrances (22), shelters (62) all
  placed and drawn already. No newsstands/trash-bags/duplicate racks —
  the honest inventory said the sidewalk furniture was complete once the
  *records* rendered.
- **New materials or palette colours** — everything below uses the
  existing palette tokens (`shelterFrame`, `iron`, `neonCarolina`, wall
  tints) and merges into the existing buffers.
- **A live day/night facade uniform** — the daypart is still a
  mount-time pick (same contract the sky rig has); continuous tracking
  is PR09 follow-up, not faked here.
- **No brands, no holograms, no futurist set dressing** (spec §8).

## What changed

```
packages/app/features/game/world/
  street-props-layout.ts   # + placeRecordProps: record triplets → PropPlacement,
                           #   toSidewalk nudge (≤3 m) or drop, kerb-derived dir
  street-props.ts          # + emitLinkNyc (monolith + two lit faces into the
                           #   shared transit/glow buffers), + emitBikeRack
                           #   (inverted-U hoop into the kerb band buffer);
                           #   record hydrants replace the rule-spaced fallback
                           #   where the tile carries them; settle() footprint
                           #   check reuses the shelter rule
  facade-detail.ts         # + emitParapet: 0.42 m brick lip, front+top only
  city-mesh.ts             #   parapet emitted under the exact cornice rule
                           #   (v3 bit or class/height hash); stats.parapets
  windows.ts               # + litShareAt + LIT_SHARE_* constants — the
                           #   daypart formula all lanes share
  materials.ts             #   facadeGraphs(tod): cel-lane lit share + far
                           #   glow scale with the daypart; storefront glow
                           #   stays full (shop lights are on at noon)
  pbr-materials.ts         #   PbrCityOptions.timeOfDay → facadeGraphs
  glass.ts                 #   litShare delegates to litShareAt; shader uses
                           #   the shared constants (behaviour unchanged)
  index.ts                 #   one resolved `tod` feeds cel, PBR and glass;
                           #   CityWorldOptions.timeOfDay override kept
  streetscape.test.ts      # 7 tests (below)
```

### Record furniture

`placeRecordProps(triplets, clearance, maxMove)` walks the flat
`[x, z, rot]` records through the **existing** `StreetClearance` index:
a point that is not standable nudges to the nearest sidewalk band within
`maxMove` metres, otherwise it drops. Orientation is kerb-derived (`dir`
along the carriageway, `toRoad` toward it) — the same convention
`placeAtKerb` gives the transit records, because the baked `rot`
semantics are unverified (PENDING E1 in the v3 handoff). The placements
then pass through the same `settle()` footprint rule the bus shelters
use, so a kiosk that cannot stand flat is dropped, not half-drawn.

Hydrants follow the record-or-hash rule `city-mesh.ts` uses for detail
bits: when `dataset.furniture.hydrant` carries records they place the
hydrants (still clearing the streetlight poles); a tile without records
keeps the rule-spaced hydrants byte-for-byte (tested on the v2 and the
stripped-v3 fixtures).

Everything merges into the existing four prop objects —
`city:street-props` (basket/hydrant/rack kerb band), `city:transit`,
`city:transit-lights`, `city:cars`. No new draw calls; the kiosk's lit
faces ride the transit-lights neon buffer.

### Parapet lip

`emitParapet` is a 0.42 m brick lip a few courses proud of the facade,
emitted to the near-field detail band at exactly the faces the cornice
rule already fires on — v3 `DETAIL.cornice` bit or the v2
class-and-height hash, no second rule. At overview range the cornice
still carries the roofline; the lip only reads near. One `box` call, two
faces — 4 triangles per corniced edge.

### One daypart for every material lane

`windows.ts` now owns the shared formula every lane mirrors:

```
litShareAt(density, tod) = min(0.95, density × (0.25 + 0.95·tod))
```

`tod` 0 = day … 1 = night (`LIT_SHARE_TOD = 0.8` keeps the authored dusk
default). `index.ts` resolves it once at mount — `options.timeOfDay`, or
the sky pick (`morning → 0.15`, `dusk → 0.8`, `night → 1`, flag off →
dusk) — and now hands it to **all three** material factories: cel
(`createCityMaterials`), PBR (`createPbrCityMaterials`) and the flagged
glass lane. Previously only `createGlassCityMaterials` accepted it, so
a `morning` sky pick dimmed nothing but glass interiors while the
unflagged facades still glowed at the dusk share. The storefront glow is
excluded from the scale on purpose — shop lights are on at noon too.

Honest limit: this is still the mount-time pick `clock.ts` documents —
the running `dayFactor` does not re-drive facades mid-session, matching
the sky rig's named-preset contract. Continuous tracking is listed under
Pending, same as the live sky.

## Counts — real Harlem/Apollo v3 tile, before → after

| metric | before | after | Δ |
|---|---|---|---|
| city draw calls | 12 | 12 | 0 |
| city triangles | 445 182 | 462 618 | +17 436 (4 tris × 4 359 parapet lips) |
| cornices | 4 359 | 4 359 | 0 |
| parapets | — | 4 359 | new (= cornice count) |
| hydrants | 707 (rule-spaced) | 667 (records: 687 → 38 nudged, 20 dropped) | record-driven |
| LinkNYC kiosks | 0 rendered (56 records) | 53 (13 nudged, 3 dropped) | +53 props |
| bike racks | 0 rendered (567 records) | 536 (222 nudged, 31 dropped) | +536 props |
| parked cars (incl. taxis) | 2 349 + 467 | 2 417 + 488 | +68 / +21 — 40 fewer hydrant blockers free kerb slots |
| prop-mesh triangles | 40 278 | 56 720 | +16 442 |
| prop objects | 4 | 4 | 0 |

Total static geometry +33 878 tris, **0** added draw calls — inside the
audit lane's ≤50 k added-triangle budget and far under its draw ceiling.

## Tests

`node --test` on the world + living-city trees: **198 tests, all pass**
(191 pre-existing + 7 new in `streetscape.test.ts`):

- record furniture renders and merges into the four existing objects;
- in-carriageway records nudge to the sidewalk band or drop, and every
  placed point is standable;
- tiles without records keep the rule-spaced hydrants (v2 and
  stripped-v3 fixtures, positions byte-equal to `placeHydrants`);
- the parapet lip rides the cornice rule on the hash path and the v3 bit;
- `litShareAt` scales the lit share monotonically day → dusk → night and
  the option reaches the factories on every lane;
- palette-only grep: no raw hex literal in `world/*.ts` outside
  `palette.ts`.

Existing pins that still hold: `city-mesh-v3.test.ts` v2 byte-equality
and the real-tile 12-draw-call assertion; the whole world suite
(windows, glass, signage, budget, walkability) green.

`tsc --noEmit` clean. `eslint` clean — the three warnings in
`pbr-materials.ts` (`linearColor`, `CITY_COLORS`, `CityColor`) are
pre-existing unused imports on unchanged lines.

## Device status

Headless only. No WebGPU path runs under `node --test` and no
simulator/device run was attempted — the numbers above are feature
counts and arithmetic on the merged buffers, not a `renderer.info`
capture.

**Capture matrix — PENDING (PR09 device pass):**

| | morning | dusk | night |
|---|---|---|---|
| street-level, kerb height (Lenox row) | PENDING | PENDING | PENDING |
| mid-block view, Apollo/125th frontage | PENDING | PENDING | PENDING |
| elevated overview, looking south over the tile | PENDING | PENDING | PENDING |

Each cell should verify the thing this PR changed: kiosks/racks/hydrants
where the records say they are, parapet lips on corniced rooflines, and
a facade lit share that follows the clock pick (lit interiors at night,
mostly dark by day, storefronts always lit).

## Pending / next

- **Live daypart**: `tod` is resolved once at mount from the sky pick;
  the running `dayFactor` does not reach the facades mid-session. Same
  follow-up as the continuous-sky item in `pr07-viz.md` — ideally one
  uniform drive for sky + facade + lamp levels.
- **Record `rot`**: triplets carry a rotation the bake semantics of
  which are unverified (handoff PENDING E1); orientation is kerb-derived
  until that is confirmed.
- **Record-vs-pole conflicts for LinkNYC/racks**: hydrants check the
  streetlight poles; kiosks and racks only check sidewalk standability.
  If device captures show pole/kiosk overlaps, extend the lamp-clearance
  filter to those kinds.
- **PARAPET far LOD**: the lip lives in the near-field band; if the
  roofline reads flat at mid-range on device, carry a one-line silhouette
  into the masonry band — cheap, but only if the capture says so.

## Rollback

`git revert` this commit. The record path is additive — no record →
`placeStreetProps` returns exactly the pre-PR08 placements (tested);
`facadeGraphs`/`createCityMaterials`/`createPbrCityMaterials` default to
`LIT_SHARE_TOD` (the authored dusk share) when `timeOfDay` is unset, and
the flag-off world (`skyRig` off) resolves `dusk` exactly as before.
`parapets` is a stats addition only; removing `emitParapet` restores the
pre-PR08 buffers. The v2 fallback stays byte-identical either way.
