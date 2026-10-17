# Harlem realism pass: research

Owner: `user-researcher`. Written for the realism lane (docs-only): the Flying Roadster look — one sky light, reflective glass, occupied windows, photoscanned surfaces, filmic finish — applied to the baked OSM Harlem tile (`docs/implementation/city-world.md`). Inputs: the Flying Roadster measurement notes, now pinned as named constants in `packages/app/features/game/world/look.ts`; the city palette (`world/palette.ts`); the window pattern (`world/windows.ts`). Companion outputs: `../handoff/realism.md`, `../review/realism-a11y.md`, the Graphics section of `docs/COPY_DECK.md`.

One thing is still missing and everything that depends on it is marked PENDING, not guessed: Mike's photo set of the Apollo block. (Mobbin cards are in, below.)

## What the measurements already decide

Every measured number is named in `look.ts`; nothing here re-litigates them.

- **Filmic finish, light touch:** contrast 1.06, saturation 1.04, vignette 0.22, bloom strength 0.045. The grade reads in the corners and in the glass, not as a filter over the whole frame.
- **Air:** exponential fog at density 0.00028. The scene's linear fog (`index.ts setViewDistance`) becomes exp2.
- **Glass is a mirror first:** curtain-wall roughness 0.03 / metalness 0.75; house windows roughness 0.04–0.12 per pane, seeded. Reflections, not emissive cheats, carry the towers.
- **Windows are rooms:** interior mapping behind the pane — walls, floor, ceiling, light panels, furniture, a door — plus blinds and AC units where the block calls for them.
- **Paint is clearcoat:** clearcoat 1.0, clearcoatRoughness 0.025, baseRoughness 0.38.
- **The frame governor:** render scale drops 0.1, rises 0.05, every 1.5 s, floor 0.5; the phone band is 27–38 fps; env maps are 256 px on phones, 512 on the high tier; AO is 12 samples on the high tier.

Unmeasured values (exposure, window metalness, seeded tilt range, interior-map scale, furniture depth falloff) are `TODO(tune)` starting points in `look.ts`, resolved in the capture session below.

## What makes a street read as real Harlem at player height

Player height is about 1.6 m on a sidewalk built from `street-axes`/`walkability` data. At that height the eye reads a street as Harlem — not "generic game city" — through six things.

### 1. Storefront density

The avenues and 125th Street have a nearly unbroken retail band: bays of 6–9 m, one after another, different sign on each. A bodega, a beauty supply, a fried-chicken counter, a laundromat, a pharmacy. The realism cues are the differences, not the quantity: one bay freshly painted, the next with a roll-down gate (`gate` in the palette) half-lowered for the night, the next's awning faded a tone lighter (`AWNING_TONES`). The current shader draws the band (`shop` in `materials.ts`); the realism pass gives it variety and life — different fascia colours, open bays glowing `windowWarm`, gated bays dark and corrugated.

### 2. Signage hierarchy

Harlem signage stacks in a fixed order of scale: the green street blade (`signGreen`/`signText`) highest and smallest; the shop fascia lettering next; the awning valance under that; window vinyl and hand-written cardboard lowest. Above the street: water towers (`cedar`, `towerSteel`, `towerRoof`), pigeon lofts, the Apollo's marquee (`marquee`, `marqueeLights`). The pass keeps this order legible: fascia type stays biggest in view, blades stay MUTCD green, nothing glows that shouldn't.

### 3. Window life

This is where Flying Roadster's occupied-window spec earns its keep. On a real block every window does something different:

- **Blinds** drawn to a seeded height — never two neighbouring panes the same.
- **AC units** sagging in a share of summer windows, a metal box (`gate`-family tones) that catches the sky.
- **Lit rooms** behind a share of panes at dusk and night: `windows.ts` already seeds 25–75 % per building and picks warm/amber/cool per pane (`windowWarm`, `windowAmber`, `windowCool`); the pass puts a room behind the glow — back and side walls, floor, ceiling, light panels, furniture, a door — so the lit rectangle has depth, not just colour.
- **Glints:** per-pane roughness 0.04–0.12 and a seeded tilt mean reflections slide and break as the camera moves, which is what makes glass read as glass at walking pace.

### 4. Curb furniture

The street's small metal is what sells scale: hydrants (`hydrant`, `hydrantCap`), corner trash baskets (`basket`), bus-stop shelters (`shelterGlass`, `shelterFrame`), subway entrances with their green globes (`subwayRail`, `subwayGlobe`), street-name and parking signs on shared poles (`pole`), bike racks, scaffolding where a facade is being repointed. `street-furniture.ts` and `street-props.ts` place these; the pass's job is material honesty — painted metal gets the PAINT clearcoat, glass shelter panels get the GLASS range.

### 5. Asphalt wear

Real 125th Street asphalt (`asphalt`, `ink[700]`) is never uniform: bus-stop lanes polished to a lower roughness by tyres, trench patches a half-tone darker, faded lane paint (`laneYellow`, `laneWhite`) worn to ghosts at intersections, manholes and seams, darker gum-and-spill fields at the curb and around the trash baskets. The handoff's asphalt roughness range is how this lands; the research point is that wear clusters where wheels and feet actually go — lane lines, stops, crosswalk mouths — not as noise sprayed evenly.

### 6. Dusk glow

The reference build's signature: the sun is one light, low; the sky carries the gradient (rose `skyHorizon` → royal `skyMid` → night `skyZenith`); and the warmth on the street comes from sodium lamps and interiors, not from a warm sun slapped on everything. In the palette terms this is `windowWarm`/`windowAmber` panes and `lampHalo`/`lampHead` pools against `ink`-family walls, with bloom at 0.045 blooming only the bright cores. The dusk set exists in `palette.ts` already; morning and night keys are new entries marked `TODO(tune)` until the photos rule on them.

## Acceptance test: captures beside Mike's photos

The pass is done when captures from the game sit beside Mike's Apollo-block photos and a viewer can name which cues differ — and the list is short.

**Positions** (scene coordinates from `docs/implementation/city-world.md`; exact camera anchors are set from Mike's photos once provided — see PENDING):

| # | Position | Anchor |
|---|---|---|
| A | Apollo frontage, 125th Street sidewalk | about (-28, 22), looking west along the block |
| B | Opposite sidewalk / carriageway centre, looking at the marquee | about (-34.7, 33.6) |
| C | Mid-block east on 125th toward Adam Clayton Powell Jr Blvd | TODO(position): fix from the third photo |

**Times:** morning, dusk, night — the three `SKY_BY_TIME` looks in `look.ts`.

**What each pair must match** before the grade is signed off: sky gradient shape; where the warmth sits (interiors and lamps, not the sun disc); window lit share and tone spread; glass reflectivity at walking height; storefront readability at dusk; asphalt tone. The measured constants hold unless a photo pair contradicts one, in which case the `TODO(tune)` constant moves, not the photo's story.

**Device:** captures on the target phone (the 27–38 fps band) and, for the hinge-line check in `../review/realism-a11y.md`, a foldable in book posture. Simulator/browser captures are labelled as such and never counted as device passes.

## Mobbin cards

Collected 2026-10-16 via Mobbin search (iOS). Each card tagged borrow or reject.

### Game HUD over the 3D world

- [Tolan — 3D world with edge icon row](https://mobbin.com/screens/06ee91af-d314-4713-b15c-afea6aba596c) — **borrow**: chrome-free HUD, icons parked at the edges, the scene owns the frame; nothing competes with the world.
- [Starlink — dark scene with central ring + corner compass](https://mobbin.com/screens/5ee07936-271f-4ffc-96ac-7f8964fdfcfc) — **borrow**: one high-contrast element reads instantly over a dark 3D field; compass sits quietly in a corner.
- [Best Buy — AR view with floating pills](https://mobbin.com/screens/de210925-0c2f-4764-8f9f-05025a2d916a) — **borrow** the floating-pill grouping over a live view; **reject** the top-center 3D/AR segmented control, which crowds the middle of the frame.

### Settings: graphics quality tiers

- [NBA — Video Quality with "Automatic (recommended)"](https://mobbin.com/screens/f3fe1242-7bf7-4f1e-9346-bb9ef21b9e97) — **borrow**: radio list leading with an automatic default, each option carrying a consequence line.
- [Riveo — export sheet with fps pills](https://mobbin.com/screens/2ccc629d-680d-4e03-8767-fc649fbe3cae) — **borrow**: compact segmented pills (25/30/50 fps) with a descriptor under the row — the density our tier picker needs.
- [Prime Video — streaming quality with per-option cost](https://mobbin.com/screens/df1e14b5-42ec-4ef5-8203-ff3e20338e56) — **borrow**: each tier states its cost (GB/hr); ours states render scale / battery impact the same way.
- [Ultrahuman — battery mode cards](https://mobbin.com/screens/520b63e7-7755-4288-9a47-737fe3541ab2) — **reject** the heavy card chrome for a settings row; **borrow** the per-tier consequence label ("High Battery Usage").

### Loader progress over the world build

- [QUITTR — dark ring, large %, status sublabel](https://mobbin.com/screens/e44d9c81-e261-4322-9bcb-7ca8ac2c03ca) — **borrow**: near-black scene with a ring, a big percent and a "Building…" line — the shape a shader-compile wait wants.
- [Flo — ring + percent on light](https://mobbin.com/screens/3878bc48-a6d7-427a-ae5a-492504ca84c1) — **borrow** the percent-forward treatment; **reject** the light background (the game loader sits over the world build, which is dark).
- [MyDyson — thin indeterminate ring on black](https://mobbin.com/screens/3f80714b-8587-4412-b9b5-5f415cda53b1) — **reject**: an indeterminate spinner with no number gives no affordance for a multi-second compile.

## Mike's photos — PENDING

Not yet provided. Needed: three positions on the Apollo block (§ Acceptance test), each at morning, dusk and night, handheld at walking height. Until they land, position C's anchor, the morning/night sky tones (`palette.ts`, marked `TODO(tune)`), and the acceptance gate stay open.
