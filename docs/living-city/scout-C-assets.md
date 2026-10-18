# Scout C — Asset provenance ledger

Scout report for Living City PR01 (spec §3, §4). Verified 2026-10-17.
The canonical registry draft lives at `docs/living-city/asset-ledger.md`
(started here); a follow-on lane may promote it to the spec's
`docs/assets/LIVING_CITY_ASSETS.md` location.

**Rule (spec §3):** never claim CC0/MIT from a filename or a repo's
presence — verify the package page, bundled license file, or CREDITS.
`PENDING` = not yet verified to the standard required to ship.

## 1. Vehicles

### Kenney Car Kit 3.1 GLBs — bundled inside fable-cities

- **Location:** `/tmp/lc-refs/fable-cities/public/assets/simulation/models/`
  (10 files, 172–268 KB each): `hatchback-sports`, `sedan`, `sedan-sports`,
  `suv`, `suv-luxury`, `van`, `race`, `race-future`, `truck`, `truck-flat`.
- **License:** `public/assets/simulation/models/KENNEY_LICENSE.txt` —
  full **CC0** text, attributed "Car Kit (3.1), Car Kit (1.7) Kenney Vleugels
  (www.kenney.nl), creation date 02-04-2026". Also listed CC0 in
  `public/assets/CREDITS.md:30`. Original source:
  kenney.nl Car Kit (CC0 per publisher site).
- **Red flags:** (a) license file was bundled by fable's author, not
  fetched by us — before vendoring, re-fetch kenney.nl Car Kit 3.1 and
  hash-compare GLBs; (b) stylized low-poly — a taxi/bus class is **absent**
  from this kit (taxi must be a sedan variant + rooftop sign or another
  pack; bus needs three.js generator or another source); (c) palette
  texture in `textures/` — verify texture references inside GLB on import;
  (d) scale/pivot unverified (registry must record wheelbase + bounds).
- **Registry role:** starter `vehicle.sedan.city`, `vehicle.suv.city`,
  `vehicle.van.city`, `vehicle.sedan.sport` … behind semantic ids.

### Night Street procedural cars

- **Location:** `/tmp/lc-refs/night-street/src/world/cars.ts` (1969 ln, 17 files total).
- **License:** **MIT** (`LICENSE`, Prasenjit). Code/algorithm, not a GLB
  pack — no redistribution issue.
- **Red flags:** WebGLRenderer + GLSL + desktop post stack; geometry math
  is portable, shading is not. Triangle budget is desktop-class → near/hero
  LOD only, or a quality bar for the procedural fallback.
- **Registry role:** none directly; informs `body.procedural.night-street`
  fallback geometry for hero parked cars.

### three.js 0.186.1 city generators (installed)

- **Location:** `packages/app/node_modules/three/examples/jsm/generators/`
  (`city/CarGenerator.js`, `city/PersonGenerator.js`, `TrafficlightGenerator.js`,
  `StreetlightGenerator.js`, `SkyscraperGenerator.js`, `CityGenerator.js`,
  `city/{Bench,Hydrant,Trashcan,Sidewalk,StreetTree}Generator.js` …).
- **License:** **MIT** (three.js authors) — vendored inside our own
  dependency; no hotlinking, no extra download.
- **Red flags:** they are *generators*, not GLB assets — output geometry at
  build/runtime; `TrafficlightGenerator` material is decorative (hardcoded
  lit green lens); `PersonGenerator` is low-poly posed, not rigged.
- **Registry role:** `vehicle.sedan.city`/`vehicle.suv.city`/
  `vehicle.taxi.city` procedural candidates, `crowd.person.starter`,
  `signal.head.nyc` geometry source.

## 2. Characters / animation

### Quaternius — Universal Base Characters

- **Source:** https://quaternius.com/packs/universalbasecharacters.html
  (v1.0, Aug 2025).
- **License stated on page:** **CC0 / public domain** ("released under
  CC0… public domain, no attribution required").
- **Contents (per page):** 6 characters (~13k tris, humanoid rig);
  GLTF + FBX exports + Blender source.
- **Red flags:** Quaternius site distributes 60–70 % of each pack free;
  verify the *exact* downloaded zip + its included license before vendoring.
  13k tris is heavy for a crowd — foreground/hero tier only.
- **Registry role:** `person.rigged.universal` hero-tier pedestrians.

### Quaternius — Universal Animation Library

- **Source:** https://quaternius.com/packs/universalanimationlibrary.html
  (Mar 2025).
- **License stated on page:** **CC0** (standard version; source .blend
  files only in the paid tier).
- **Contents:** 45 of 120+ clips free (walk/run/idle/sit/jump set verified
  listed), retargetable to the universal humanoid rig.
- **Registry role:** `anim.set.locomotion` — retarget source for walk
  cycles; pairs with Universal Base Characters.

### Kenney animated characters

- **Sources:** kenney.nl/assets/animated-characters-protagonists;
  kenney-assets.itch.io/animated-characters-3.
- **License:** **CC0** per Kenney publisher pages (itch.io page states CC0).
- **Red flags:** stylized; verify each pack's bundled license file at
  download time; rig convention may differ from Quaternius (keep a per-pack
  `rig` field in the registry).
- **Registry role:** `person.rigged.kenney` alternative/variety rigs.

### Mixamo — www.mixamo.com

- **License:** **NOT CC0.** Adobe FAQ (helpx.adobe.com/creative-cloud/faq/
  mixamo-faq.html): Mixamo assets may be used royalty-free *in your
  projects*, but redistribution of the raw character/animation files is
  restricted; the service also requires an Adobe account.
- **Red flags:** do not ship Mixamo skeletons/clips as a redistributable
  pack; if used for prototyping, output must be recorded as provenance and
  reviewed before shipping. Prefer Quaternius (CC0) for the shippable
  baseline.
- **Registry role:** `PENDING` — prototyping only; never tag `license: cc0`.

## 3. Street furniture / environment (from fable CREDITS.md)

- **Poly Haven** `street_lamp_01/02` — **CC0** (public/assets/CREDITS.md:30).
  Repo already has procedural LED lamps; keep ours, use Poly Haven only if
  a hero lamp close-up is wanted. Role: `lamp.head.hero` (optional).
- **ambientCG** asphalt textures — **CC0** (same credit). Repo asphalt is a
  procedural shader; ambientCG is a reference for the wet-look scenario.
  Role: `texture.ref.ambientcg` (reference only).
- **Google Fonts Inter (OFL)** bundled in fable — our pixel-font atlas
  (`world/pixel-font.ts`) already covers signage/glyph needs; OFL allows
  bundling but we don't need it. Role: none.

## 4. Ledger verdicts

| Candidate | License | Ship-now? |
|---|---|---|
| Kenney Car Kit 3.1 GLBs (via fable) | CC0 | **Yes** — after kenney.nl re-fetch + hash check |
| three.js generators (installed) | MIT | **Yes** — already vendored |
| night-street car geometry | MIT | **Yes** (code only, near-LOD) |
| Quaternius UBC / UAL | CC0 | **PENDING** — verify downloaded package license |
| Kenney animated characters | CC0 | **PENDING** — verify bundled license file |
| Mixamo | Adobe terms, **not CC0** | **No** (prototype only, never tag cc0) |
| Poly Haven lamp / ambientCG | CC0 | Optional/reference |
| Fable sim/network code | MIT | **Yes** (port, keep attribution note) |

**Fallback chain (spec §4):** every registry entry must resolve to the
built-in box-car/person generator if its source fails — the city loads
regardless.
