# NYC-MON · Harlem city dataset v3 from Valdrada — agent prompt

Written 2026-10-17. This prompt checks two repositories:

- `mikevocalz/nyc-mon` `main` @ `73733e4` (https://github.com/mikevocalz/nyc-mon).
- `mkturkcan/valdrada` tag `v0.4.0` = commit `2724c79` (https://github.com/mkturkcan/valdrada). The dataset tag `v0.4.0` exists on Hugging Face as well (https://huggingface.co/datasets/mehmetkeremturkcan/valdrada).

**Goal.** Replace the estimated parts of the Apollo-centred Harlem tile with Valdrada's record-backed city for the same square: building height, floors, style, landmark placement, road lanes, and street furniture from city records. The result ships as `harlem-apollo` dataset v3.

**Design rule.** Every field stays traceable to a public record, or it is marked as an estimate. Your current rendering, origin, projection and world saves keep working.

---

## 0. How to run this

1. Run Claude Code at the nyc-mon root, on a new branch (`feat/city-v3-valdrada` unless Mike names another).
2. Before any edit, read these in full:
   - In nyc-mon: `AGENTS.md`, `skills/README.md`, `docs/design/reference-roster.md`, `docs/implementation/city-world.md`, `tooling/city/README.md`, `packages/app/features/game/city-dataset.ts`, `packages/core/world/transform.ts`, `world/city-mesh.ts`, `map-data-credit.ts`, `settings/settings-content.tsx`, `lobby/use-lobby-resume.ts`.
   - In Valdrada at `v0.4.0`: `README.md`, `LICENSING.md`, `ACKNOWLEDGEMENTS.md`, `client/DATA_SOURCES.md`, `client/src/world/tiledata.js`, `client/src/shared/geo.js`, `client/src/shared/landmarkSpec.js`, and the writer sections of `client/tools/pipeline/compile.mjs`. Start at the section list near L5880 and follow the record writers back.
3. Clone Valdrada outside the nyc-mon tree (for example `~/src/valdrada`). Nothing from it is vendored except the ported decoder in §5.2.
4. Coordinate the work through the subagents in §7, using the `ecc:*` plugin (https://github.com/WorldFlowAI/everything-claude-code). Take agent names from the plugin's own listing.
5. The gates in §4 are hard stops: ask Mike, record the answer, continue.
6. No dependency upgrades, no merges, no deploys. Keep device checks separate from node, browser or simulator checks in every report.

---

## 1. Roster

Append the block below to `docs/design/reference-roster.md` as `## City data (dataset v3)`. Judge each decision by whether the author of the record, format, algorithm or spec would sign off on this exact file. Do not use "senior" or "principal" in role framing; those titles are below this bar.

### Engineers (creator / spec-author tier)

| Domain | Bar | Source |
|---|---|---|
| Valdrada tile format, compiler, overrides | Mehmet Kerem Turkcan, Valdrada author | https://github.com/mkturkcan · docs: https://mkturkcan.github.io/valdrada/ |
| Geodesy and projection | Charles Karney, GeographicLib (the memory-standard "GeographicLib-level geodesy") | https://geographiclib.sourceforge.io/ |
| Polygon triangulation and simplification | Volodymyr Agafonkin, earcut author. three's `ShapeUtils.triangulateShape`, which `city-mesh.ts` L64 uses, is its port (`three/src/extras/Earcut.js`) | https://github.com/mourner · https://github.com/mapbox/earcut |
| Geometry upload, `BufferGeometry` merge, WebGPURenderer | Ricardo Cabello (https://github.com/mrdoob), Michael Herzog (https://github.com/Mugen87), sunag (https://github.com/sunag), Renaud Rohlinger (https://github.com/RenaudRohlinger) | https://threejs.org/docs/ |
| Schema and parse boundary | Colin McDonnell (Zod) | https://zod.dev/ |
| TypeScript | Anders Hejlsberg, Ryan Cavanaugh, Daniel Rosenwasser | `tsc --noEmit` |
| Native boundary (only if §6.6 triggers) | Marc Rousavy | https://github.com/mrousavy · https://nitro.margelo.com/ |
| Simulator asset lineage (models Valdrada ships; not imported here) | CARLA Simulator team | https://carla.org/ |

### Designers

| Name | Why they are the bar | Source |
|---|---|---|
| Massimo Vignelli (roster) | NYC street-information discipline: transit and signage placement must be true to the street | https://standardsmanual.com/ |
| Michael Bierut, Pentagram (roster) | WalkNYC: legible NYC street furniture and wayfinding | https://www.pentagram.com/work/walknyc |
| Kevin Lynch | *The Image of the City*. Paths, edges, districts, nodes and landmarks are the test for whether v3 Harlem reads as Harlem | https://mitpress.mit.edu/9780262620017/the-image-of-the-city/ |
| Justin K. Thompson | Stylised NYC that stays recognisable (Spider-Verse production design) | https://www.cartoonbrew.com/feature-film/spider-man-into-the-spider-verse-production-design-is-about-character-not-style-168137.html |
| Syd Mead | The "futuristic touch" layered on a real city without erasing it | https://sydmead.com/ |

### Design agencies

| Agency | Take | Source |
|---|---|---|
| Pentagram | WalkNYC system thinking for furniture, credit and map UI | https://www.pentagram.com/ · https://www.pentagram.com/work/walknyc |
| Sony Pictures Imageworks | Stylised-NYC production reference | https://www.imageworks.com/node/1371 |
| Chromosphere | Flat-shape city colour scripting | https://chromosphere.studio/ |

### Dev agencies

| Agency | Role here | Source |
|---|---|---|
| Software Mansion | TypeGPU and the cel body the city renders through | https://swmansion.com/ |
| Callstack | Measured bundle, TTI and frame cost of the bigger dataset | https://www.callstack.com/ · https://github.com/callstackincubator/agent-skills |
| Margelo | `api-design` on exported `@acme/*` surfaces; native only behind §6.6 | https://margelo.com/ · https://github.com/margelo/react-native-skills/tree/main/skills |
| Utsubo | WebGPU/TSL production work | https://www.utsubo.com/ |
| Active Theory · Lusion · 14islands (roster) | Real-time city craft bar | https://activetheory.net/ · https://lusion.co/ · https://14islands.com/ |

### Rejected on sight

- Shipping or streaming Valdrada's raw tiles on the phone.
- Offsetting and scaling Valdrada metres into nyc-mon metres without unprojecting first.
- Dropping Valdrada's read-time overrides (that drop puts the Hotel Theresa on the wrong footprint).
- A procedural flag recorded as a fact.
- Importing Valdrada's GLSL materials or its photoreal (MetaHuman) pedestrians.
- Colours outside the palette.
- A new dataset id or version with no save migration.
- An attribution that omits a source.
- "Should work" claims without numbers.

---

## 2. Ground truth (verified 2026-10-17)

Rely on these facts. Anything else gets cited by file and symbol from the pinned sources before use. If a shape is uncertain, stop and ask.

### nyc-mon @ `73733e4`

| Fact | Where |
|---|---|
| The dataset is v2. Building classes: `brownstone`, `brick`, `glass`, `nycha`, `church`, `civic`, `plain`. Landmark keys: `apollo-theater`, `hotel-theresa`, `acp-state-office`. | `features/game/city-dataset.ts` L24, L33 |
| Limits: tile radius 2000 m; 20,000 buildings, 10,000 roads, 4,000 areas, 25,000 trees; 1,200,000 coordinates; 4,096 points per ring. | `city-dataset.ts` L127–135 |
| `CitySource` is one object (`url`, `attribution`, `license`, `retrievedAt`, `query?`). Buildings carry `heightEstimated` and `classEstimated`. | `city-dataset.ts` (`CityBuilding`, `CitySource`) |
| Entry points are `parseCityDataset` and `CITY_DATASET_MIGRATIONS`. Saves key on `(id, version)`, and the lobby passes `datasetMigrations`. | `city-dataset.ts` L332, L341; `lobby/use-lobby-resume.ts` L48 |
| Projection: sphere R = 6,371,008.8 m. x = Δlon·R·cos(lat₀), z = −Δlat·R, about the dataset origin. | `packages/core/world/transform.ts` L14–39 (`projectToScene`) |
| Tile: origin `[-73.94975, 40.81005]`, id `harlem-apollo-20261014`, about 1.7 km on a side. Heights fall back to type defaults. The low-residential brownstone/brick split is a hash of the OSM id. | `docs/implementation/city-world.md` |
| The dataset is bundled into the app as JSON, 1,009,994 bytes today. | `features/game/city-data.ts` L9; `data/harlem-apollo.json` |
| Building detail is invented by hash today: stoops L358, fire escapes L368 and water towers L411 are keyed on `building.id`. Wall tones come from the class (L237); glass vs masonry is chosen at L314. | `world/city-mesh.ts` |
| The map credit is three constants. Settings renders them, and a test keeps them equal to the bundled tile's `source`. | `map-data-credit.ts`; `settings/settings-content.tsx` L86–94; `map-data-credit.test.ts` |
| The ground query is `cityGroundHeight(x, z)`. | `world/bundled-queries.ts` L22 |
| Web UI must use semantic primitives from `packages/ui/html`. Stories live beside components as `*.stories.tsx` in `packages/ui`. | repo layout; standing rule |

### Valdrada @ `v0.4.0` (`2724c79`)

| Fact | Where |
|---|---|
| The tree is `client/`, although the README text still says `boundlessjs/`. Cite tree paths, not README paths. | repo tree |
| The client runs three `^0.185.1` (Vite, WebGL2). World materials are GLSL (`onBeforeCompile` / `ShaderMaterial`) with no node materials, so no shader code is reusable on the WebGPU/TSL path. | `client/package.json`; `client/src/world/materials.js` |
| Tile layout: magic `0x43544c31`, a JSON header, then typed-array sections. Sections include `bldgXZ`, `bldg`, `bholes`, `roadVerts`, `roads`, `furn`, `terrain` and surface meshes. | `client/src/world/tiledata.js` `parseTile`; `compile.mjs` ~L5880 |
| Each building record is 44 bytes: `start`, `len`, `landmarkId`, `baseY`, `height`, `floors`, `style`, `r`/`g`/`b`, `roofKind`, `flags`, `lit`, `floorH`, `winW`, `storeH`, `blind`, `area`, `colorVar`, `frontIdx`. **No BIN, BBL or other source id.** | `tiledata.js` `buildingsOf` |
| Read-time overrides: `BUILDING_OVERRIDES` are matched by point-in-footprint and applied at decode. The decoder also applies the `RW13` window-width bridge. | `tiledata.js`; `client/src/shared/landmarkSpec.js` |
| Landmark ids: 8 Apollo, 9 Hotel Theresa, 10 A.C. Powell Jr. State Office Bldg. The file records that the compile put 9 and 10 on wrong footprints and corrects them. | `landmarkSpec.js` L17–19, L211–213 |
| Road records: `rclass`, `noTraffic`, `oneway`, `width`, `lanes`, `park`, `level`, `speed`, `nameIdx`, `segId`, `mouthA`, `mouthB`. | `tiledata.js` roads |
| Furniture kinds (`FURN`) mix two groups. Some kinds are placed from city records: tree, hydrant, bus shelter, subway entrance, LinkNYC, bike rack. Others are generated by the compiler: lamps, signage, stoops, fire escapes, water towers, roof AC, scaffold and more. | `client/src/shared/geo.js` L22–28; README; `DATA_SOURCES.md` |
| `STYLE` holds facade typologies 0–15 (tenement, pre-war apartment, rowhouse, NYCHA brick and so on). Detail flags (`BF`): water tower, cornice, fire escape, storefront, setbacks, landmark, stoop, gable. Typologies and detail are the compiler's rules over record attributes, not records themselves. | `geo.js` `STYLE`, `BF`; README ("facade typologies with procedural architectural detail") |
| Valdrada projection: `LAT0` 40.7831, `LON0` −73.9712. `M_PER_DEG_LON` = 111,320·cos(`LAT0`), `M_PER_DEG_LAT` = 111,132. 512 m tiles; x east, z south; inverse at `geo.js` L16. **These constants differ from nyc-mon's sphere by about 0.1 %, so always unproject to WGS84 first.** | `geo.js` L2–18 |
| Coverage: the nyc-mon square falls on 20 near tiles (`t_1..5_-8..-5`), 24.9 MB total. Measured from Hugging Face `main` with resolve headers; re-measure at the pinned tag. | Hugging Face dataset |
| Tags `v0.1.0`–`v0.4.0` exist on both GitHub and Hugging Face. The dataset card text still says `v0.3.0`. | `git ls-remote`; HF refs API |
| Licences: the compiled city is ODbL 1.0 (contains OpenStreetMap data), and rendered images are Produced Works that need attribution. Models: CARLA CC BY 4.0, Rocketbox MIT. MetaHuman pedestrians carry a licence that bars building databases or training AI. Textures CC0. Code MIT. Citation requested (BibTeX in README). | `LICENSING.md`, README, dataset card |

**Not yet verified** (each becomes a task or test):

- Which building fields `compile.mjs` copies straight from a record, and which it derives by rule.
- What `furn` params `p0`–`p2` mean per kind.
- Whether any section carries a source id usable for stable building ids.
- Whether `cityGroundHeight` is flat or terrain-backed.
- The exact v3 byte size and device parse time.

---

## 3. Goal and non-goals

**In scope:**

- A `tooling/city/valdrada/` stage that downloads the pinned tiles and decodes them with overrides.
- Reprojection into nyc-mon metres.
- A merge into the existing bake to produce v3.
- The v3 schema, parser and migration.
- `city-mesh.ts` reading v3 facts where present, with today's hash rules kept as the fallback.
- Attribution in Settings.
- Docs, tests and device numbers.

**Out of scope:**

- Valdrada's renderer, GLSL materials, traffic or pedestrian simulation, Python API, or surface meshes.
- Any change to the cel/PBR material lanes beyond reading new building facts.
- Living Ink.

---

## 4. Decision gates (stop and ask Mike)

| Gate | Question | Default if unanswered |
|---|---|---|
| G1 | **Building ids.** Valdrada records carry none. Option (a): spatially join to NYC Building Footprints BIN (record-backed, stable; needs that dataset). Option (b): match to v2 OSM ways by footprint overlap and keep `osm:way:N`, giving unmatched ones `vd:<tag>:<tile>:<index>`. Option (c): tile-index ids (unstable across Valdrada releases). First grep every consumer of `building.id` (hash detail, `landmarks.buildingId`, saves) and report. | (b), with a match-rate report |
| G2 | **Import scope.** Buildings, roads and record-backed furniture only? Or also Valdrada's procedural furniture, marked as decoration like `trees.fill`? | Record-backed only |
| G3 | **Facade colour.** Valdrada's per-building `rgb`, or nyc-mon's palette via class → `WALL_TONES`? | Palette. Do not import `rgb` |
| G4 | **Terrain.** Import `baseY` and the `terrain` grid, or keep today's ground? Decide after checking `cityGroundHeight`. | Keep today's ground; report the elevation range Valdrada has in the square |
| G5 | **Size and delivery.** What is the v3 byte budget, and does it stay bundled or move to a fetched asset? `skills/react-native-nitro-fetch` covers prefetch and cache warming. | Stay bundled. Report bytes and Duo parse time against v2 before Mike sets the number |
| G6 | **Dataset id and version.** New id `harlem-apollo-<YYYYMMDD>`, version 3, with a v2→v3 identity position migration (origin and projection unchanged). | As stated |
| G7 | **Attribution copy and placement in Settings** (ux-copy output). Must name OpenStreetMap (ODbL), Valdrada (with its citation) and the NYC Open Data sources it used. | Draft for review |
| G8 | **Pin.** `v0.4.0` on both hosts, or a later tag if one lands first. Record tag and commit in `source`. | `v0.4.0` |
| G9 | **Licence reading.** The agent reports what the ODbL, CC BY and MetaHuman texts say about each use. It gives no legal conclusion; Mike decides. | Facts only |

ADR: take the next free number in `docs/adr/` (0021 may be taken by the Living Ink actor-seam ADR). Title it "City dataset v3: Valdrada as the building and street source".

---

## 5. Spec

### 5.1 Pipeline

| Step | File (new unless noted) | Does |
|---|---|---|
| Fetch | `tooling/city/valdrada/fetch.mjs` | Download only the tiles intersecting the origin square plus the 2000 m radius limit, and `manifest.json`, at the pinned revision. Use Hugging Face resolve URLs or `hf download --revision <tag> --include` (https://huggingface.co/docs/huggingface_hub/guides/cli). Cache in `tooling/city/.cache/` (git-ignored). Record sha256 per file. |
| Decode | `tooling/city/valdrada/decode.mjs` | Port of `parseTile`, `buildingsOf`, holes, roads and furniture from `tiledata.js`, with `BUILDING_OVERRIDES` applied exactly as the decoder does. Keep the MIT notice and cite source lines. Fail on a bad magic or an unknown section version. |
| Reproject | inside decode | Valdrada (x, z) plus tile origin → WGS84 via `geo.js` inverse → `projectToScene` with nyc-mon's origin. Then round to 0.1 m as v2 does. |
| Merge | `tooling/city/build.mjs` (edit) | Valdrada becomes the source for buildings, roads (geometry, width, lanes, oneway, speed, `segId`), landmarks and record-backed furniture. OSM stays the source for areas and names where Valdrada has none. `trees.fill` logic is unchanged. Every estimate rule is written into `notes`. |
| Check | `tooling/city/print-counts.mjs` (edit) | Print v2 vs v3 counts, bytes, parse ms, and a landmark footprint report. |

### 5.2 Schema v3 (`city-dataset.ts`)

Additive. v1 and v2 still parse and project into v3 shape, as v1 → v2 does now.

**`sources: CitySource[]`** replaces the single `source`. It lists OpenStreetMap/Overpass, Valdrada (tag, commit, Hugging Face revision, citation), and each NYC Open Data source Valdrada's `DATA_SOURCES.md` names for the imported fields.

**`buildings[]`** keeps every v2 field and adds optional ones:

| Field | Meaning |
|---|---|
| `f` | floors |
| `fh` | floor height |
| `vs` | Valdrada `STYLE` id, kept verbatim |
| `sh` | storefront height |
| `ww` | window width |
| `fi` | front edge index |
| `d` | detail bitset in nyc-mon's own order: cornice, fire escape, stoop, water tower, storefront, setbacks, gable |
| `y` | base elevation (G4 only) |

The `e` provenance bits extend per field: height, class, floors, style, detail. A field counts as a fact only when `compile.mjs` copies it from a named record. Typology and detail stay estimates.

**`class`** is derived from `vs` through a mapping table owned by design-handoff (§6.1 #5), with no new classes unless G3 adds palette tokens.

**`roads[]`** gains `l` (lanes), `ow` (oneway), `sp` (speed) and `sid` (`segId`).

**Furniture:**

- `transit.subway` and `transit.shelters` are filled from Valdrada furniture.
- A new `furniture` object holds flat `[x, z, rot]` arrays for `hydrant`, `linknyc` and `bikeRack`.
- Trees: `trees.osm` becomes `trees.census` (record-backed). `fill` is unchanged.
- Procedural kinds are imported only under G2, in a separate `decor` object.

**Limits** stay as in v2 unless G5 says otherwise. **Migration:** v2 → v3 identity position step added to `CITY_DATASET_MIGRATIONS`.

### 5.3 Rendering consumption (`world/city-mesh.ts`)

- Where a v3 fact exists, it replaces the hash:
  - floors and floor height drive window rows;
  - `d` drives stoop, fire escape, cornice and water tower;
  - storefront height drives the shop band.
- Where it does not (v2 tiles, unmatched buildings), today's hash rules run unchanged.
- No new materials. Colours stay palette.
- Merged geometry per material is unchanged, so draw calls must not grow. Report before/after.

### 5.4 Attribution

- `map-data-credit.ts` becomes a list derived from `sources`.
- Settings renders each source with its licence link, and the existing test checks the list against the bundled tile.
- Web uses `packages/ui/html` primitives.
- Copy comes from §6.1 #4.

---

## 6. Skills

Every skill below is named on purpose, and each produces the output listed. A run that skips one says why in the handoff.

The `design:*` and `engineering:*` skills are Claude plugin bundles. In Claude Code, only `/code-review` is bundled, and `frontend-design` comes from the official marketplace. Where a skill is not loadable:

- apply its method;
- write its output anyway;
- say how it ran in the output header;
- never claim a slash command ran when it did not.

### 6.1 UX / design sequence (fixed order)

| # | Skill | Output | Done when |
|---|---|---|---|
| 1 | `design:user-research` | `docs/design/research/harlem-v3-recognition.md` | Plan written: can people who know 125th Street pick out the Apollo, the Theresa, the State Office Building and two corners, in v2 vs v3 frames from fixed camera bookmarks? Covers method, participants and pass criteria |
| 2 | **Mobbin, per screen** (§6.2) | `docs/design/research/harlem-v3-mobbin.md` | Every screen has references or an explicit "no relevant pattern" |
| 3 | `design:design-system` | City section in `docs/DESIGN_SYSTEM.md` and `world/palette.ts` notes | Valdrada `STYLE` 0–15 maps to a nyc-mon class and its `WALL_TONES`. Any new class arrives with its palette tokens (G3). No raw hex |
| 4 | `design:ux-copy` | Credit strings in `docs/COPY_DECK.md` voice | Attribution lines, licence-link labels, the Valdrada citation line, and lobby loading text if G5 changes it |
| 5 | `design:design-handoff` | `docs/design/handoff/harlem-v3.md` | Field-by-field table: Valdrada field → v3 field → record or rule (with `compile.mjs` line) → renderer use → fallback. Plus the `STYLE` → class table and the furniture-kind table |
| 6 | `design:accessibility-review` | `docs/design/review/harlem-v3-a11y.md` | Credit row: link targets meet WCAG 2.5.8, contrast passes, and licence links have screen-reader labels. Lobby progress announcements still accurate with the larger dataset |
| 7 | `design:design-critique` | `docs/design/review/harlem-v3-critique.md` | Device frames of v2 vs v3 at fixed bookmarks, critiqued against Lynch's five elements and the §1 designers |
| 8 | `code-review` (`/code-review`) and the CodeRabbit loop | Findings fixed in the PR | Every finding fixed and retested before re-request |
| 9 | `frontend-design` (official marketplace plugin) | Settings credit row | Built on `@acme/ui` primitives (`packages/ui/html` on web). Any state lives in Zustand, never bare `useState`/`useReducer`. Story updated if one exists |

### 6.2 Mobbin per screen

Follow the method in `docs/design/research/game-lobby-mobbin.md`: Mobbin MCP `search_screens` / `search_flows`, download each screenshot and view it before writing. References inform hierarchy and states, never pixels.

| Screen | File | Search for | Output |
|---|---|---|---|
| Settings, "Legal & credits" | `features/settings/settings-content.tsx` | Open-source and data-licence credit screens, multi-source attribution lists | 3–5 refs, take/reject |
| Game lobby, world loading | `features/game/lobby/GameLobbyScreen.tsx`, `await-world-ready.ts` | Loading and progress for large local content | Refs plus states (loading, slow, failed) |
| Game screen | `features/game/GameScreen.tsx` | Street-name and landmark labelling in map and game HUDs (only if v3 street names surface in UI) | Refs, or "no UI change" |

If any screen work touches adaptive layout, read `skills/mikevocalz-foldable-layouts/SKILL.md` first.

### 6.3 three.js and game skills (repo copies; upstream in each `SOURCE.md`)

- **`skills/three-agent-skills/three-best-practices`** (https://github.com/emalorenzo/three-agent-skills): geometry merging, memory and disposal, `material-reuse`.
- **`skills/threejs-skills/`** (https://github.com/CloudAI-X/threejs-skills):
  - `threejs-geometry`: footprints with holes, `ShapeUtils`.
  - `threejs-fundamentals`: frames and units.
  - `threejs-materials`: confirm no new materials.
- **`skills/awesome-gamedev/`** (https://github.com/gamedev-skills/awesome-gamedev-agent-skills):
  - `performance-optimization`: build time, memory, draw calls.
  - `threejs-scene-setup`.
  - `camera-systems`: critique bookmarks.

### 6.4 Engineering skills

- **`engineering:architecture`:** the ADR (§4), covering options, trade-offs, and consequences for saves, bundle size and licensing.
- **`engineering:testing-strategy`:** the §9 plan in the PR body before tests are written.
- **`engineering:documentation`:**
  - Rewrite `docs/implementation/city-world.md` for v3 (pipeline, schema, provenance, notice).
  - Update `tooling/city/README.md`.
- **`engineering:debug`:** any decode mismatch or device regression. Reproduce, isolate, fix.
- **`skills/mattpocock/`** (https://github.com/mattpocock/skills): schema and parser types; exhaustive unions for `STYLE` and furniture kinds.
- **`skills/margelo/api-design`:** the exported dataset API and `@acme/core` migration surface (repo law R5).

### 6.5 Performance and evidence

- **`skills/callstack-react-native-best-practices`** (https://github.com/callstackincubator/agent-skills): before/after on the bench Duo. Measure:
  - JS bundle size;
  - time to world-ready in the lobby;
  - JSON parse ms;
  - city build ms;
  - `ThreeFrameTiming` `renderMs` and `drawCalls`.

  One cherry-picked run is not a measurement.
- **`skills/agent-device`** (https://github.com/callstackincubator/agent-device): scripted camera bookmarks that capture the §6.1 #1 and #7 frames.
- **`skills/react-native-nitro-fetch`:** only if G5 moves the dataset out of the bundle.

### 6.6 Native gate (Margelo)

This lane adds no native code.

**If** a binary or native parser is proposed because JSON parse misses the G5 budget, stop and tell Mike first. Then load `skills/margelo/cpp` and `skills/margelo/build-nitro-modules`. C++ is Nitro HybridObjects with Nitrogen output committed, plus `swift`/`kotlin` as needed. Source: https://github.com/margelo/react-native-skills/tree/main/skills

### 6.7 Prose and review

- **`skills/no-ai-slop`** (https://github.com/petergyang/no-ai-slop): every doc, comment, ADR and PR body.
- **`ecc:*`** (https://github.com/WorldFlowAI/everything-claude-code): coordination and the review loop.
- **CodeRabbit** (https://github.com/coderabbitai): independent review, fix everything, retest.

---

## 7. Subagents

Lanes follow the repo directive: A research and design, E game systems, F verification and accessibility.

| Subagent | Owns | Skills | Outputs | Starts | Done when |
|---|---|---|---|---|---|
| **E1 Decoder** | Fetch, decode, overrides, reprojection | §6.3, mattpocock | `tooling/city/valdrada/*.mjs` and decoder tests | Immediately | N1–N4 green; record-vs-rule table drafted from `compile.mjs` |
| **A1 Research and design** | Recognition study, Mobbin, style mapping, handoff, copy | §6.1 #1–5 | Those docs | Immediately, in parallel with E1 | G3 and G7 answered; handoff reviewed by F3 |
| **E2 Schema and bake** | v3 schema, parser, migration, merge in `build.mjs`, ADR | `engineering:architecture`, `margelo/api-design` | `city-dataset.ts`, the new `harlem-apollo.json`, ADR | After G1, G2 and G6 | N5–N8 green; `tsc --noEmit` clean |
| **E3 Renderer consumption** | `city-mesh.ts` reads v3 facts with fallback | §6.3 | Diff and frames | After E2 | N9 green; draw calls unchanged |
| **F1 Verification and device** | Bundle, TTI, parse, frames | §6.5, `engineering:debug` | `docs/DEVICE_CHECKS.md` rows and perf report | After E3 | D1–D4 recorded with device, build and command |
| **F2 Licence and attribution audit** | ODbL, CC BY and MetaHuman facts, the source list, the credit row | §6.1 #6, #9 | `docs/implementation/city-world.md` notice section, Settings diff | After E2 | Every imported field traced to a source in `sources`; G9 facts written |
| **F3 Review and prose** | §6.1 #7–8, all prose | `design:design-critique`, `/code-review`, no-ai-slop, CodeRabbit | Critique, resolved review | Last, and on every PR | Zero open findings |

Hand-offs are files. Each subagent ends with a status that separates device-verified, node-verified and not verified.

---

## 8. Phases

| Phase | Work | Exit gate |
|---|---|---|
| P0 Read and cite | No edits. Write the record-vs-rule table for every Valdrada field used, citing `compile.mjs` lines; write the `building.id` consumer report for G1 | Mike answers G1–G4 |
| P1 Decoder | E1 | N1–N4 |
| P2 Schema and bake | E2, ADR | N5–N8; v3 bytes and parse ms reported for G5 |
| P3 Renderer | E3 | N9; frames on web |
| P4 Credits and design docs | A1, F2, §6.1 #4–6 and #9 | Copy and credit row approved |
| P5 Device | F1 on the Duo, then the target matrix | D1–D4 recorded |
| P6 Critique and review | F3 | Zero open findings; roster block appended |

---

## 9. Tests and acceptance

Node tests (`node --test`):

- **N1. Decode round-trip.** For each pinned tile, the record count equals header-declared length / record size, and a bad magic throws.
- **N2. Overrides.** After decode, landmark ids 8, 9 and 10 sit on the footprints `landmarkSpec.js` names. A test asserts the Theresa footprint's height and floors match the override entry.
- **N3. Reprojection.** For known WGS84 points (each landmark's `lat`/`lon` in `landmarkSpec.js`), unproject then `projectToScene` matches nyc-mon's projection within 0.1 m. A test also shows the naive offset-and-scale path is wrong by more than 0.5 m somewhere in the square.
- **N4. Pin integrity.** sha256 of each cached tile matches the recorded value, and `sources` carries the tag and commit.
- **N5. Parser.** v3 parses. v2 and v1 fixtures still parse into v3 shape. Limits are enforced. The Zod errors name the field.
- **N6. Migration.** A v2 save resolves on v3 through `CITY_DATASET_MIGRATIONS`, with no `incompatible-dataset`.
- **N7. Provenance.** Every building has `e` bits for each new field. No detail bit is marked fact unless the handoff table names a record for it.
- **N8. Credits.** `map-data-credit` entries equal `sources` (extend `map-data-credit.test.ts`).
- **N9. Renderer.**
  - `world/shader-graphs.test.ts` still passes.
  - City build on v3 stays within the existing feature cap.
  - Draw-call count is equal to v2's (assert on the built scene's mesh count per material).

Gates: `pnpm --filter @acme/app typecheck`, `lint` and `test`, plus the `@acme/core` package's gates if its types change. No `@ts-expect-error` and no `any`.

Device checks (record device, OS, build and command):

- **D1.** Bundle size and time to world-ready, v2 vs v3, on the Duo.
- **D2.** Parse ms and city build ms on the Duo and on the iPhone SE 3 class device.
- **D3.** Frame timing at fixed bookmarks: `renderMs`, `drawCalls`, triangles.
- **D4.** Frames at every bookmark for §6.1 #1 and #7, including the Apollo, Theresa and State Office Building.

---

## 10. Rules

- No invented APIs, fields or data. Cite file and line. Stop and ask rather than guess a format.
- A field is a fact only if a named public record supplies it. Everything else carries an estimate bit and a rule in `notes`.
- `tsc --noEmit` is a hard gate. State lives in Zustand only; React 19 `useOptimistic`/`useActionState` stay allowed.
- No new dependencies and no upgrades. Hugging Face fetches run in tooling only, never in the app.
- Colours come from the palette only.
- Canon: no invented landmark. A landmark neither source names is left out, as v2 does.
- No AI slop: no placeholders or stubs, hallucinated packages, invented data, narrating comments, speculative abstractions, assertion-free tests, or unverified "should work" claims. The repo must not read as LLM-authored.
- Device claims come only from device runs.

---

## 11. Deliverables

- [ ] `tooling/city/valdrada/fetch.mjs`, `decode.mjs`, tests; `build.mjs` and `print-counts.mjs` updated
- [ ] `city-dataset.ts` v3, migration, fixtures; new `data/harlem-apollo.json`
- [ ] `world/city-mesh.ts` v3 consumption with fallback
- [ ] `map-data-credit.ts`, `settings-content.tsx`, test updated
- [ ] ADR (next free number)
- [ ] `docs/implementation/city-world.md` v3 and notices; `tooling/city/README.md`
- [ ] `docs/design/research/harlem-v3-recognition.md`, `harlem-v3-mobbin.md`
- [ ] `docs/DESIGN_SYSTEM.md` city section; `docs/COPY_DECK.md` credit strings
- [ ] `docs/design/handoff/harlem-v3.md`
- [ ] `docs/design/review/harlem-v3-a11y.md`, `harlem-v3-critique.md`
- [ ] `docs/DEVICE_CHECKS.md` rows and perf report
- [ ] Roster block appended to `docs/design/reference-roster.md`

---

## 12. References

**Valdrada**

- Repository: https://github.com/mkturkcan/valdrada
- Documentation: https://mkturkcan.github.io/valdrada/
- Dataset: https://huggingface.co/datasets/mehmetkeremturkcan/valdrada
- Browser demo: https://huggingface.co/spaces/mehmetkeremturkcan/valdrada
- Key files:
  - https://github.com/mkturkcan/valdrada/blob/main/client/src/world/tiledata.js
  - https://github.com/mkturkcan/valdrada/blob/main/client/tools/pipeline/compile.mjs
  - https://github.com/mkturkcan/valdrada/blob/main/client/src/shared/landmarkSpec.js
  - https://github.com/mkturkcan/valdrada/blob/main/client/DATA_SOURCES.md
  - https://github.com/mkturkcan/valdrada/blob/main/LICENSING.md

**Licences**

- ODbL 1.0: https://opendatacommons.org/licenses/odbl/1-0/
- OSM copyright: https://www.openstreetmap.org/copyright
- OSMF Produced Work guideline: https://osmfoundation.org/wiki/Licence/Community_Guidelines/Produced_Work_-_Guideline
- CARLA: https://carla.org/
- Rocketbox: https://github.com/microsoft/Microsoft-Rocketbox

**NYC records**

- NYC Open Data: https://opendata.cityofnewyork.us/
- PLUTO / MapPLUTO: https://www.nyc.gov/site/planning/data-maps/open-data/dwn-pluto-mappluto.page
- USGS 3DEP: https://www.usgs.gov/3d-elevation-program

**Tools and algorithms**

- Hugging Face CLI: https://huggingface.co/docs/huggingface_hub/guides/cli
- earcut: https://github.com/mapbox/earcut
- GeographicLib: https://geographiclib.sourceforge.io/
- Zod: https://zod.dev/

**Skills**

- https://github.com/emalorenzo/three-agent-skills
- https://github.com/CloudAI-X/threejs-skills
- https://github.com/gamedev-skills/awesome-gamedev-agent-skills
- https://github.com/margelo/react-native-skills/tree/main/skills
- https://github.com/callstackincubator/agent-skills
- https://github.com/callstackincubator/agent-device
- https://github.com/WorldFlowAI/everything-claude-code
- https://github.com/petergyang/no-ai-slop
- https://github.com/mattpocock/skills
- Mobbin: https://mobbin.com

**Link check, 2026-10-17.** Every link returned 200 except four sites that block automated requests (Cloudflare or CDN 403): GeographicLib, MIT Press, NYC Open Data and USGS. Open those by hand.

Cite Valdrada in the docs and in the credit, using the BibTeX in its README. Valdrada is maintained by Mehmet Kerem Turkcan.
