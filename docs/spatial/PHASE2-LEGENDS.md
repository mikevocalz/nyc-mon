# Phase 2 design note: Legends, street encounters and the Block Diorama

- **Status:** Design only. Parked by `docs/adr/0013-phase2-legends-parked.md`. Nothing here is built, and nothing here is canon.
- **Date:** 2026-10-08
- **Branch:** `feat/spatial-contract`
- **Depends on:** `docs/spatial/CONTRACT.md`, `docs/adr/0010-spatial-scene-contract.md`, `docs/adr/0011-mode-resolution.md`, `docs/adr/0012-approach-trigger.md`
- **Canon authority:** `docs/canon/source/NYC_MON_CURRENT_CANON_INDEX_v11.md` order. `V11 ¶n` = n-th non-empty paragraph of the v11 Canon & Lore Bible, as `docs/canon/STARTERS_EXTRACT.md` defines it.

Phase 1 excludes "Hood Mon encounters, scanning" and asks for "a typed stub and an ADR saying how it attaches later — nothing more" (`docs/phase-1-brief.md` L17). This note is the "how it attaches later" for real-city encounters. It types the seams, lists what canon leaves open, and sets the safety rules any later build has to meet.

---

## 1. What canon says, and what it doesn't

### 1.1 Canon facts this note relies on

| Fact | Source |
|---|---|
| The slogan is "EVERY BLOCK HAS A LEGEND." It defines no mechanic. | `V11 ¶13` |
| Redevelopment can displace both people and Hood Mons, "giving the conspiracy physical stakes at block level." | `V11 ¶40` |
| Brooklyn Tech, Chelsea, Harlem/Rucker Park, the Bronx, the undercity and all five boroughs "are meaningful places, not generic neon backdrops." | `V11 ¶41` |
| "Scanning is not recruitment. H-Lynk containment is not consent. A partnership is social and relational, not a device flag." | `V11 ¶43` |
| Competition "can scale from block/street to neighborhood, borough and City Circuit." | `V11 ¶69` |
| Hood Mon: "Independent/free-living Mon without a current Caller partnership." | `V11 ¶111` |
| Hood Mon encounters and scanning are out of Phase 1. | `docs/phase-1-brief.md` L17 |
| UI and data say `Hood Mon`, never "wild". | `CONTRIBUTING.md` Law 9 |

### 1.2 What "legend" could mean

Canon gives the word to the slogan and nothing else. Three readings fit the facts above. None is chosen here.

1. **A legend is a story.** Each block carries authored local history: who lived there, what redevelopment took, which Hood Mons stayed. The Mon learns it; nothing spawns. This reading fits `V11 ¶40` most directly.
2. **A legend is a person.** A specific named Hood Mon is known on a block. Your Mon can meet it, and it can refuse (`V11 ¶43`, `¶111`). It is an individual with a stable identity, never a respawning pool.
3. **A legend is a title.** Block-level standing earned in competition (`V11 ¶69`), which climbs to neighborhood, borough and City Circuit.

The roster's "F17 · Legendary Hart" (`docs/canon/source/NYC_MON_Egg_Baby_All_Forms_Roster_v11_1.md` L40) is a Bloodline name. Nothing on disk connects it to the slogan, and this note does not assume it does.

The typed field is `legend: null` (§6.6) so the shape can hold any of the three readings without a rename.

### 1.3 Not canon, and kept out of the type system

These came in the Phase 2 tasking or from older files. They are candidates for Mike to rule on (§8), and no code path may treat them as data:

- "Yotes at parks at dawn/dusk": proposal from the tasking. No source on disk.
- Bodega Cee "warm spot": proposal from the tasking. No source on disk.
- Hood Ratti "low routes": proposal from the tasking. No source on disk.
- v7 encounter tags `street`, `transit_set`, `courtyard`, `community_hub`: v7 Master Bible encounter rows, quoted in `docs/canon/STARTERS_EXTRACT.md` L374 (Bodega Baddiee Cee: `community_hub, courtyard, street`, `M7 L14813`) and L604 (Hood Ratti: `street, transit_set, courtyard`, `M7 L14812`). v7 is authority 5 and uses "wild", which v11 replaces (`V11 ¶21`). The extract carries no Yote encounter row.
- Clean City v2 habitat pressures: `docs/NYC_MON_Clean_City_Legacy_and_Great_Miscalculation_v2.md` §11 ("A Mon raised around bodegas understands people, food and neighborhood movement differently from one raised in a park") and its guardrail "Different NYC habitats produce different evolutionary pressures." The file calls itself a "Canon Lore Expansion" dated after v11 and is not listed in the v11 index. Treat it as unratified until Mike says otherwise.

---

## 2. §6.1 Positioning split: phones go outside, headsets stay at the table

**Real-city encounters are phone mechanics.** A phone uses GNSS for coarse position and, where available, a visual positioning service for precise placement:

- **Android and iOS via ARCore Geospatial.** Google's page says the API "uses device sensor and GPS data to detect the device's environment, then matches the recognizable parts of that environment to a localization model provided by Google's Visual Positioning System (VPS)", and that content can be attached "to any area covered by Google Street View". It offers three anchor types (WGS84, Terrain, Rooftop) and ships Android, NDK, Unity and iOS guides. It also says "A small number of ARCore supported devices do not support the Geospatial API." Source: https://developers.google.com/ar/develop/geospatial
- **iOS via ARKit location anchors.** Apple's `ARGeoAnchor` page: "Location anchors are available only in geotracking sessions, and geotracking is available in specific areas", and the framework "downloads localization imagery to refine the user's precise geographic position." Apple's `ARGeoTrackingConfiguration` page: supported on "devices that have an A12 chip or later and cellular (GPS) capability", "Geotracking occurs exclusively outdoors", "The user must have an internet connection", and localization imagery "captures views from public streets and routes accessible by car, but doesn't include images of gated or pedestrian-only areas." Sources: https://developer.apple.com/documentation/arkit/argeoanchor and https://developer.apple.com/documentation/arkit/argeotrackingconfiguration

The Apple note on pedestrian-only areas matters for NYC: plazas, park interiors and NYCHA courtyards may get no visual fix. That is one more reason VPS stays a bonus (§3).

**Headsets do not go outside.** Meta's Quest Pro safety page says: "Your Meta Quest Pro is not recommended for use outdoors." It also tells users to "clear your activity space" and notes "the boundary may not detect people or pets." The page says nothing about walking, traffic or stairs; this note does not claim it does. Source: https://www.meta.com/quest/safety-center/quest-pro/ . This note did not open an equivalent PICO page, so PICO outdoor guidance is unverified; the rule below applies to PICO on product grounds, not on a cited source.

**What headsets get instead: the Block Diorama.** The Caller's origin block (§6.6 `originBlock`) renders as a tabletop model in the existing tabletop mode. The same Mon meets the same legend on the same block, at table scale, indoors. Encounters that happen on the phone show up in the diorama afterward because state is server-authoritative (`V11 ¶93`: "A device session is a surface, not a new creature").

---

## 3. §6.2 Binding an encounter to a block

### 3.1 How bad is GNSS on a NYC street

GPS.gov: "GPS-enabled smartphones are typically accurate to within a 4.9 m (16 ft.) radius under open sky" and "their accuracy worsens near buildings, bridges, and trees." Source: https://archive.gps.gov/systems/gps/performance/accuracy/ (the live `gps.gov` URL returned 404 on 2026-10-08; this is the archived copy of the same page).

That page gives no urban-canyon figure. **Engineering assumption, to be measured before any build:** in Manhattan and downtown Brooklyn street canyons, reported phone position can be off by tens of meters and can land on the wrong side of a street or in the wrong block. The Phase 2 spike must log fix accuracy against surveyed points on at least one avenue canyon, one side street of brownstones, one NYCHA campus and one park edge, per borough, before any threshold below is trusted.

### 3.2 Snap to polygons, natively

Encounters bind to a **block** (or, when the fix is too poor, a **neighborhood**), never to a raw coordinate:

1. Take the fix and its reported horizontal accuracy.
2. Point-in-polygon against block polygons, on device, in native code. If the accuracy circle sits inside one block, bind to that block.
3. If the circle crosses block edges, fall back one level to the neighborhood polygon. Never pick the nearest block and pretend.
4. VPS (§2), when it localizes, can tighten the fix and allow block binding where step 2 failed. When VPS is unavailable or fails, the feature still works at block or neighborhood grain. **VPS is a bonus, not a dependency.**

Snapping to a polygon, not a point, also means no encounter has a "spot" a player must stand on, which is half of the safety case in §5.

### 3.3 Candidate polygon sources (opened 2026-10-08)

| Dataset | Publisher | What it is | Use |
|---|---|---|---|
| TAX_BLOCK_POLYGON https://data.cityofnewyork.us/City-Government/TAX_BLOCK_POLYGON/akq4-haa2 | Department of Finance | "the shape, location, and identity of Tax Blocks in the Digital Tax Map". Rows updated 2026-10-02. | Block grain. Tax blocks are not the same as a street block in every case (parks, superblocks, NYCHA campuses); check on the ground. |
| TAX_LOT_POLYGON https://data.cityofnewyork.us/City-Government/TAX_LOT_POLYGON/i38t-6if2 | Department of Finance | Tax lot shapes in the same Digital Tax Map. | Too fine for binding. Possible input for excluding private lots (§5). |
| 2020 Neighborhood Tabulation Areas https://data.cityofnewyork.us/d/9nt8-h7nd | Department of City Planning | "medium-sized statistical geographies" built from census tracts. The page says NTAs "are not intended to definitively represent neighborhoods, nor are they intended to be exhaustive of all possible names and understandings of neighborhoods". Rows updated 2026-05-28. | Neighborhood fallback grain. Display names need an editorial pass; NTA names are statistical, and New Yorkers will argue with some of them. |
| PLUTO https://data.cityofnewyork.us/d/64uk-42ks | Department of City Planning | Lot-level land-use data, "more than seventy fields". | Candidate source for place category (§4). License and field meanings to be read before use. |

Terms of use, attribution and update cadence for each set have not been reviewed. That review belongs to the spike.

---

## 4. §6.3 Ecology-driven appearance

**Proposed driver:** place category + local time of day. A block's category comes from open land-use data (PLUTO candidate, §3.3) mapped to a small set of habitat tags. A Mon's `habitatTags` and `activeHours` (§6.6) say where and when it is likely to be around. Nothing here involves rarity tiers, spawn timers or a respawning pool; under `V11 ¶111` a Hood Mon is an individual, so an appearance is that individual being somewhere, not an item dropping.

**The starter ecology is open canon.** These are candidates only, for Mike to accept, change or strike:

| Source | What it proposes | Status |
|---|---|---|
| Phase 2 tasking | Yotes at parks at dawn and dusk | Proposal, no source on disk |
| Phase 2 tasking | Bodega Cee "warm spot" | Proposal, no source on disk |
| Phase 2 tasking | Hood Ratti "low routes" | Proposal, no source on disk |
| v7 `M7 L14812` | Hood Ratti: `street, transit_set, courtyard`; "no mapping of poverty or ethnicity to pest rarity" | v7, authority 5 |
| v7 `M7 L14813` | Bodega Baddiee Cee: `community_hub, courtyard, street`; "Partner/community-story encounters, not wild predation or real pet capture" | v7, authority 5 |
| Clean City v2 §11 | Lineage shaped by habitat: subway colony vs waterfront, bodega vs park | Unratified expansion |

The v7 rows carry a rule worth keeping whatever Mike decides: habitat tags must never encode income, race or ethnicity. A tag describes the built environment (a transit entrance, a courtyard), never who lives there. Any category mapping gets a review against that rule before it ships.

---

## 5. §6.4 Safety rules (non-negotiable)

These bind any Phase 2 build. Numbers are **proposals with thresholds to validate in the spike**, not tuned values.

1. **Never route a player.** No directions, no arrows toward an encounter, no "it's 200 m north". The game reacts to where the Caller already is. Apple's geotracking page itself tells navigation apps to "discourage them from looking at the device when in motion"; this design removes the reason to.
2. **Daylight-safe public context only.** Appearances bind to public, walkable places. Private lots, rail and subway track areas, platform edges, roadways, highway shoulders, construction sites and water edges are excluded polygons.
3. **No rare or story-critical encounter may require** late night, a platform edge, a roadway, private property or entering any excluded polygon. If something is scarce, it is scarce in time spent on public blocks in daylight.
4. **Suppress at speed.** Proposal: suppress all prompts when estimated speed > 2.5 m/s sustained for 5 s (above a brisk walk; catches bikes, scooters, cars, trains). Validate against real walking and cycling traces.
5. **Suppress while crossing.** Proposal: suppress when the fix is within ~10 m of a street centerline segment or intersection, using a city street centerline layer (dataset not yet opened; to identify in the spike). Given §3.1 error, this will over-suppress near corners. That is the correct failure.
6. **Suppress underground and on transit.** If the fix is inside a subway station or the device reports transit motion, no prompts.
7. **Minimal UI.** Outdoors, the screen shows one quiet card and the Mon's voice line. No full-screen AR takeover by default, no timers, no countdowns, no "leaving soon".
8. **Quiet hours.** The default schedule excludes late night. Whether a Caller can widen it, and whether minors ever can, is open (§8).
9. **Headsets never enter street mode** (§2).

---

## 6. §6.5 Differentiation and legal

**Legal.** Location-based creature games are a crowded field with active patent holders. Before any Phase 2 build starts, counsel should run a freedom-to-operate review of the actual design. This note is not legal advice. It does not characterize any patent, claim or company's IP, and nobody should read the design choices here as a legal workaround.

**What makes this NYC-MON** (product reasons, not legal ones):

- **Canon lore.** Blocks carry the redevelopment and displacement stakes of `V11 ¶40`; legends belong to real places in five boroughs (`V11 ¶41`).
- **H-Lynk fiction.** The phone is the H-Lynk, a communication and care device, "not proof of ownership" (`V11 ¶23`).
- **NYC identity.** Named blocks, named neighborhoods, the voices and cultures of named individuals.
- **The care relationship.** Your Mon meets its block's legend; you don't catch anything. A scan reads, it never recruits (`V11 ¶43`), and a Hood Mon can say no.

---

## 7. §6.6 What Phase 2 reuses

Everything below is typed in `docs/spatial/CONTRACT.md` and `docs/adr/0010-spatial-scene-contract.md` through `docs/adr/0012-approach-trigger.md`. Phase 2 adds inputs, not new systems.

| Seam | Phase 2 change |
|---|---|
| The spatial store | Holds the bound block/neighborhood id and suppression state. Same store, new slice fields. |
| Scene input | `legend` goes from `null` to a populated record when an encounter is live. Shape unchanged. |
| Approach-trigger state machine | Same machine, new inputs: block binding, speed, crossing, quiet hours. Suppression is a guard, not a new state graph. |
| Mode resolver | Adds `street`. Resolves only on phones, outdoors, with location permission granted and every §5 guard passing. Headsets can never resolve to it. |
| Tabletop mode | Becomes the Block Diorama: `originBlock` rendered at table scale. |
| Content fields | `originBlock`, `habitatTags`, `activeHours` on Mon/species content, typed now and empty. |

### 7.1 nitro-mapbox-ar as a map/terrain candidate

Evaluated from the public repo https://github.com/mikevocalz/nitro-mapbox-ar on 2026-10-08. Evaluate, do not assume; this is what the repo shows, not a recommendation.

- **What it is:** README: "A revival of Mapbox's original React Native AR terrain experiment, rebuilt around Nitro Modules, Skia Graphite, WebGPU, TypeGPU, modern Mapbox SDKs, and ReactVision." Status line: "active modernization". MIT.
- **Rendering:** Mapbox Terrain-RGB tiles decoded through Skia, TypeGPU elevation compute, direct WebGPU terrain draw, with "No GPU → CPU readback". The same family of stack this repo already uses for the creature.
- **Optional packages:** a Nitro HybridView over Mapbox Maps SDK v11 (`@mapbox/react-native-mapbox-ar-native-map`) and a ReactVision/Viro bridge (`@mapbox/react-native-mapbox-ar-reactvision`) for "geospatial AR/XR anchors and route projection". The latest commit (`0c037c4d`, 2026-10-08) is "fix(reactvision): WGS84 ENU projection and pose-stable route geometry".
- **Maturity:** `package.json` version `0.0.1`. `npm view @mapbox/react-native-mapbox-ar` returned 404, so it is not published under that name. Peers: `react-native >=0.86.0`, `react-native-nitro-modules ^0.37.1`, `react-native-webgpu ^0.10.0`, `typegpu ^0.12.6`, `@shopify/react-native-skia >=2.12.0-0`. The README says its reference app "stays on Expo SDK 57 / React Native 0.86", while this repo targets Expo 58 / RN 0.88 (`docs/SPATIAL.md`). That gap is unverified, not known-broken.
- **Fit:** plausible for the Block Diorama's terrain base and a city map surface. The route-projection feature cuts against rule 5.1 (never route a player) and would stay unused. Block polygon snapping (§3.2) is not something the README claims; `src/geo` contains only `bbox.ts`.
- **Questions for the spike:** does it build on Expo 58 / RN 0.88 with the private Viro fork; what Mapbox token and pricing apply; does Terrain-RGB at block zoom give a usable diorama in NYC, where buildings, not terrain, define a block.

---

## 8. Open questions for Mike

1. What does "legend" mean in play: a block story, a named Hood Mon, a competition title, or a mix (§1.2)?
2. Is a legend unique to one block, or can one individual be the legend of several?
3. Is `originBlock` where the Caller lives, where the Mon hatched, or where the Mon's lineage comes from? Who sets it, and can it change?
4. Should the Clean City v2 file enter the v11 index as canon, in whole or in part?
5. Do the v7 encounter tags (`street`, `transit_set`, `courtyard`, `community_hub`) carry forward under v11, renamed, or not at all?
6. Accept, change or strike: Yotes at parks at dawn/dusk; Bodega Cee "warm spot"; Hood Ratti "low routes". What is the Yote Bloodline's habitat, given the extract has no v7 row for it?
7. What happens when your Mon meets a legend: conversation, a story beat, a friendship, a challenge? `V11 ¶43` rules out recruitment by scan; is recruitment by any route allowed?
8. Can a Hood Mon met on the street ever become a second partner, given Phase 1 is one Mon per Caller?
9. Should street mode exist for under-18 Callers at all, and if so with what extra limits (quiet hours, guardian opt-in)?
10. Is there any block or place in NYC the game must never use (memorials, houses of worship, schools, shelters, NYCHA interiors)? Who curates the exclusion list?
11. Does the redevelopment storyline (`V11 ¶40`) show on real blocks with real redevelopment, or only fictional ones? Real blocks carry real displacement; this needs a deliberate call.
12. Approve counsel-led freedom-to-operate review as a gate before any Phase 2 build?
