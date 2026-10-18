# Living City — source & license index

PR10 deliverable (spec §15–16, §13 row 10). One consolidated table of
everything the program read, adapted, referenced or rejected — with the
verification status each claim actually earned. Sources of truth this
consolidates: `asset-ledger.md` + `ASSET_NOTICES.md` (in-repo), the PR01
scout reports, `docs/licenses/provenance-2026-10-17.md` (lane F2), and
the per-PR licensing sections.

**Rule (unchanged from the ledger):** `pending` never ships. A row earns
`ready` only after the exact package is re-verified at its revision.
`pending-verification` registry entries are linked by URI only and are
**not vendored**.

## 1. The city itself — Valdrada / OSM / NYC Open Data chain

| What | License | Status | Where it lives |
|---|---|---|---|
| Valdrada compiled tiles (`harlem-apollo-20261017` input) | ODbL-1.0 (per Valdrada `LICENSING.md`) | VERIFIED — clone pinned `v0.4.0` = `2724c79`; `pins.json` 21/21 hash-match | `tooling/city/valdrada/`, `packages/app/features/game/data/harlem-apollo.json` |
| Valdrada decoder port (`decode.mjs` from `tiledata.js`/`geo.js`/`landmarkSpec.js`/`tkOverrides.js`) | MIT — "Copyright (c) 2026 Mehmet Kerem Turkcan" | VERIFIED — verbatim upstream text vendored at `tooling/city/valdrada/LICENSE.valdrada` (F2 fix) | `tooling/city/valdrada/` |
| OpenStreetMap extract (Overpass, our own fetch + OSM inside Valdrada tiles) | ODbL-1.0, "© OpenStreetMap contributors" | VERIFIED — attribution string in `sources[]` + Settings → Legal & credits | tile `sources[]`, `map-data-credit.ts` |
| NYC Open Data records (CSCL, PLUTO, Building Footprints, DOB NOW Facades, Street Tree Census, Hydrants, Bus Shelters, LinkNYC, Bicycle Parking) | NYC Open Data Terms of Use | VERIFIED — each Socrata id resolved live against the registry (F2 §1 table) | tile `sources[]` rows 3–11 |
| MTA Subway Entrances (data.ny.gov) | NY Open Data Terms of Use (state, correctly distinct) | VERIFIED | tile `sources[]` row 12 |
| Baked `harlem-apollo.json` as a Derivative Database | ODbL share-alike applies | **PENDING-MIKE #1** — no dataset-level ODbL declaration yet (see §4) | F2 §3 |

## 2. Simulation/render influence — code-adjacent sources

| Source | License | What the program took | Status |
|---|---|---|---|
| Fable Cities `rawprogress/fable-cities` @ `aea8b10` | MIT | **Algorithms only, no code copied:** arc-length lane polys, bezier connectors, Uint8 conflict matrix, FCFS claims + priority, blocked-exit, amber dilemma, ped kerb-wait, `aState` instance-attr pattern, id-bit distance thinning. Cited in-file (`conflict-solver.ts:11-18`, `vehicle-sim.ts`, `ped-sim.ts:5`) and in scout-B | REPORTED-ONLY per F2 — scouted LICENSE read, not re-verified; hedged correctly |
| Fable `CREDITS.md` asset bundle | CC0 per bundled `KENNEY_LICENSE.txt` | URIs only — the registry links Kenney GLBs through fable's mirror pending own-source verification | **PENDING** (see §3) |
| night-street @ `333f064` | MIT | **Scouted/reference only** — loft-math informed `body.procedural.night-street` hero-car candidate + PR07's glow/pool *technique*; no code ported (its GLSL/WebGL stack is incompatible with rn-webgpu anyway) | REPORTED-ONLY — F2 flagged `ready` runs ahead of the ledger's own re-verification rule; nothing shipped depends on it |
| three.js 0.186.1 city generators (`CarGenerator`, `PersonGenerator`, `TrafficlightGenerator`, `StreetlightGenerator`…) | MIT (three.js authors) | Installed dependency — `three:` procedural candidates in the registry; signal-head geometry reference (PR07 re-authored its decorative material) | VERIFIED — vendored inside `node_modules`; `three:` bindings themselves PENDING worklet-bundle check |
| metro-live (vg-demos-all) | MIT | Already-ported patterns: instanced-2-box person (`proc:person-2box` follows it), merge/instance discipline | VERIFIED — existing repo provenance (`docs/implementation/city-world.md`) |
| google-maps-fps | MIT **source only** — excludes assets/data | Quality-tier structure concept for `perf/tier.ts` | REFERENCE-ONLY — nothing imported |
| ProceduralBuildingsThreeJS | MIT | §10A facade-quality north star | REFERENCE-ONLY — deferred follow-on brief |
| jstrait/city-tour, NASA 3DTilesRendererJS, manhattan-3d | various | — | **REJECTED** (scout-B §7): procedural grids / unverified provenance |

## 3. Asset candidates (the ledger, promoted to the seed registry)

| Semantic id / asset | License | Status | Gate to clear |
|---|---|---|---|
| `vehicle.sedan`/`vehicle.van` — Kenney Car Kit 3.1 GLBs via fable | CC0-1.0 (bundled `KENNEY_LICENSE.txt`) | `pending-verification` | Re-fetch kenney.nl Car Kit 3.1 + SHA-256 compare vs the fable copies, vendor under `assets/living-city/…`, `markStatus → ready` |
| `ped.adult` — Quaternius UBC v1.0 + UAL | CC0-1.0 per pack page | `pending-verification` | Verify the exact downloaded zip + bundled license; ~60–70 % free tier |
| `ped.kid` — Kenney Animated Characters | CC0-1.0 per publisher page | `pending-verification` | Verify bundled license at download; rig differs from Quaternius → retarget |
| `vehicle.bus` | — | No GLB candidate by design | No verified CC0 bus exists yet (ledger) |
| Mixamo | Adobe terms — **not CC0** | **BLOCKED for shipping** | Never registered; prototyping only, never tag `cc0`, no raw redistribution |
| Poly Haven `street_lamp_01/02`, ambientCG asphalt | CC0-1.0 | Optional/reference — not registered | Repo LED lamps + asphalt shader already cover the role |
| `three:` generator entries | MIT | `ready` source; binding PENDING | Worklet-bundle import verification |
| `proc:*` recipes (box car/van/bus, 2-box person, signal head, ped box) | internal (repo MIT) | `ready` | — the primitive tail of every chain |

Registry-side enforcement (`asset-validation.ts`): every entry declares a
license string; `ready` requires `provenance.licenseVerified === true`;
`pending-verification` may not claim verified; every semantic id keeps a
ready `primitive-fallback` tail or `validateRegistry` errors.

## 4. Open escalations carried forward (unchanged — visible by design)

From `docs/licenses/provenance-2026-10-17.md` §7 — **PENDING-MIKE**,
G9 assigns the call to him:

1. **ODbL §4.4 share-alike declaration** — state that the derived
   `harlem-apollo.json` is itself offered under ODbL 1.0.
2. **Produced-Work attribution surface** — whether Settings-only credit
   suffices, or the game screen needs an in-view "© OpenStreetMap
   contributors" notice (`map-data-credit.test.ts` currently asserts *no*
   HUD).
3. **Publisher naming** — "(DOITT)" vs "(OTI, formerly DOITT)" on the
   Building Footprints row.
4. **`licenseUrl` for the MTA row** — portal root today; dataset
   deep-link already sits in `url`.

Other lanes' carryovers recorded in F2 §7: `tooling/city/README.md`
missing; `city-world.md` v3 rewrite outstanding; "Map data"→"City data"
caption pending G7; A1 `DESIGN_SYSTEM.md` "record-backed" wording on
`lane-v3a1`.

## 5. What was checked and found clean (PR10 legal review)

- No third-party GLB/texture/rig/clip is vendored anywhere in the repo —
  `pending-verification` rows are URIs, not files.
- No CC0 claim without a hedge: every CC0 row in the ledger/seed carries
  its verification gate; Mixamo is explicitly non-CC0 and absent.
- No GLSL/WebGL code ported: fable's and night-street's render paths were
  re-authored in TSL/NodeMaterial or rejected outright — the cel-shader
  lesson (an earlier lane's unlicensed-port near-miss) is why scout-B
  split "algorithm" from "code" on every row.
- No trademarked imagery/brands: Harlem geography, DOT record names
  (LinkNYC, CSCL) and real street names are factual map data; paint/
  clothing palettes are muted in-house picks ("MTA-ish blue" is a comment
  on a hex, not a logo). No storefront/brand dressing was added (PR08
  explicitly declined brands/holograms per spec §8).
- Palette discipline: `world/*.ts` keeps its test-pinned
  palette.ts-only rule (`streetscape.test.ts`); `living-city/` owns two
  small documented per-entity arrays (`VEHICLE_PAINTS`,
  `PED_CLOTHES`) plus signal-housing greys — reported, not a violation,
  since the pin covers `world/` and these are instance-color variation
  palettes, not scene materials.
