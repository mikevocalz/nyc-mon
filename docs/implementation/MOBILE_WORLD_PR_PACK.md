# Mobile World Skeleton — Per-screen PR Execution Pack

## Canon
Native tabs: HOME | GAME | raised H-LYNK | MONS | CALLER. Home is landing/choice, Game is playable NYC, H-Lynk is device + care, Mons is species dex, Caller is player identity. No Battles tab. Web remains Mon Space companion only.

## Nonnegotiables
- React Native feature screens live under `packages/app/features/<feature>/`, imported through `@acme/app/features/*`. Expo Router files under `apps/mobile/app/` only re-export/mount those features; keep feature implementations outside that route tree.
- Reuse existing `packages/ui`, theme tokens, and semantic components. No raw HTML screens, Tamagui, Bento, CSS-shader substitute, Unity.
- Game uses Three.js WebGPU + react-native-webgpu + TypeGPU. Audit compatibility and exact installed package versions before edits; do not blindly upgrade.
- Zustand for cross-feature state; Reanimated/Gesture Handler and Kinetrell for motion. No GSAP/Lenis directly.
- Preserve current H-Lynk/care functionality and one persistent Mon.
- Web never gets full Game screen.
- Accessibility, safe areas, orientation, RTL, reduced motion, screen reader labels, touch target sizes, no regressions.

Architecture reference: the existing [`apps/mobile/app/(home)/index.tsx`](https://github.com/mikevocalz/nyc-mon/blob/f794374f84912ebd01f1d68bba9bee5b862a1db8/apps/mobile/app/%28home%29/index.tsx) mounts `@acme/app/features/companion/HomeIndexScreen.tsx`; [`packages/app/package.json`](https://github.com/mikevocalz/nyc-mon/blob/f794374f84912ebd01f1d68bba9bee5b862a1db8/packages/app/package.json) exposes that feature path. [Expo Router requires non-navigation components to live outside its route directory](https://docs.expo.dev/router/basics/core-concepts/#6-non-navigation-components-live-outside-the-srcapp-directory).

## Mandatory skill roster (inspect actual skill files before implementation)
- `expo/skills`
- `mattpocock/skills`
- `Argent/agent-device`
- `coreyhaines31/marketingskills` (product copy/launch, not world rendering)
- `pbakaus/impeccable`
- `petergyang/no-ai-slop`
- `FloWritesCode/fwc-swiftui-skills` → `swiftui-iphone-duo` transferable foldable/adaptive principles; SwiftUI APIs Apple-only
- `react-native-arrangement-view` documentation and installation guide: https://thiagobrez.github.io/react-native-arrangement-view/index.html and /guide/installation; evaluate alongside current split-view implementation rather than duplicating it
- existing Harlem Might adaptive panes, rail, hinge-safe Inspector, RTL/tabletop patterns; audit implementation and port semantics, not copy visuals indiscriminately
- repo-native React Native, Expo, TypeGPU, WebGPU, Three, accessibility, Storybook, testing and security skills
- repo hygiene: `deslop`, `petergyang/no-ai-slop`, `gg-mo/repo-hygiene` in controlled reviewable passes
- Mobbin references when accessible; research games, monster companions, map navigation and adaptive layouts

## Senior expert roster (roles, not claims that people have been hired)
Principal React Native/Expo architect; Staff cross-platform navigation engineer; Staff Android WindowManager/foldables engineer; Senior Apple adaptive-layout engineer; Principal Three.js/WebGPU graphics engineer; TypeGPU/WGSL specialist; OpenStreetMap geodata/compiler engineer; realtime simulation/gameplay engineer; game UX director; AAA environment art director; principal design systems designer; accessibility lead; performance engineer; senior QA automation/device-lab engineer; security reviewer; technical producer. Each reviews its domain with explicit evidence.

## Subagents
Spawn independent read-only discovery subagents for (A) repo architecture + dependencies, (B) Harlem Might foldable parity, (C) metro-live OSM/rendering architecture/license, (D) design/UX references, (E) device test matrix. Consolidate into a dependency graph before writing code. Use a separate integration reviewer to detect duplicate components and conflicts.

## Per-screen PRs — separate, independently testable
**PR 1 — Native shell / navigation:** Home, Game, H-Lynk, Mons, Caller tab structure; Home launch; raised center action; deep linking; all feature ownership in `packages/app/features/`; preserve auth/care. Tests: navigation, tab persistence, safe areas.

**PR 2 — Home placeholder:** Named Home screen, a clear Enter Game action and no fabricated live content. Tests: launch and action route.

**PR 3 — Game world vertical slice:** Port/adapt architectural ideas from https://github.com/vietgangzz/vg-demos-all (especially metro-live). Inspect upstream license and source first. NYC-only offline OSM tile sample, recognizable streets/buildings, camera orbit/zoom + mobile movement, stable loading/error states, device GPU capability checks. Three/WebGPU/TypeGPU only. No massive five-borough build yet. Show real moving 3D scene on physical mobile device. Tests: scene mounts, first visible frame, movement, tile reload, memory and performance.

**PR 4 — H-Lynk placeholder / preservation:** Keep current active Mon → Mon Space working; other tools named placeholders. Tests: no lost care state, accessible center button.

**PR 5 — Mons placeholder:** Dex named screen only, preserve future scan/collection route contract. Tests: navigation and accessibility.

**PR 6 — Caller placeholder:** Named identity screen, no mock ranking data. Tests: auth/guest states and navigation.

**PR 7 — Foldable/tablet/rail parity:** Follow `AGENTS.md` and the mikevocalz-foldable-layouts skill (#24; implementation in draft #31): hardware family picks native navigation, not window width. Ordinary phones use bottom tabs; foldables (cover and tabletop included), tablets and headsets keep a rail on the physical right, also in RTL; an unproven family stays on bottom tabs. Usable space picks content panes independently. Keep the extra-large labeled rail, fold/hinge exclusion zones, book/tabletop postures, two-pane master-detail and trailing Inspector. Foldable Game retains uninterrupted world canvas while details occupy a hinge-safe secondary pane. Verify `react-native-arrangement-view` fit and native WindowManager posture signals. Tests: phone portrait/landscape, tablet, book fold, tabletop, trifold simulation, RTL, font scaling, rotate/unfold state retention.

**PR 8 — Integration + Storybook + device gates:** Every screen has Storybook coverage, screenshot baselines and accessibility assertions; integration verifies Game renderer does not unmount on Inspector open/close or rotation unless intentional; native device smoke checks; no blank GPU screen; no duplicate navigation shell.

## Immediate scope lock — City Renderer Only (2026-10-13)

The first Game milestone renders **only the NYC environment**. It must be visible and explorable on mobile before any gameplay work.

**In scope:** NYC-specific OSM geometry; one recognizable, geographically grounded NYC sample area; roads, sidewalks, building masses and a simple ground plane; camera orbit/pan/zoom and touch navigation; Three.js WebGPU + TypeGPU rendering in a React Native feature; tile streaming/LOD scaffolding; foldable/tablet viewport parity; loading/error/unsupported-GPU states; measured first-frame and memory diagnostics.

**Explicitly out of scope for this milestone:** Mons, Caller characters, combat, encounter AI, spawning, multiplayer, NPCs, mission logic, trains in motion, MTA realtime, futuristic ad campaigns, EngineX robots, complex physics and interactive storefronts. Preserve interfaces for later additions but do not implement them now.

**Definition of done:** Opening Game displays recognizable NYC geometry rather than a black/empty screen on supported physical iOS and Android devices; touch navigation works; phone/tablet/foldable resizing does not lose the camera/world position; no raw HTML UI; other tabs remain named placeholders. Validate upstream `vg-demos-all` license and adaptation boundaries before porting code. The first implementation PR should be the smallest working world renderer, not a city-wide content import.

## Game rendering stages after first skeleton
1. OSM geometry compiler / NYC sample tile
2. visible city scene + camera + Caller proxy
3. tile streamer + LOD + instancing
4. simplified building/sidewalk colliders and walkability
5. track graph + MTA-time-anchored train motion
6. authored futuristic facades + addressable AdSurfaces
7. spawn/encounter + battle snapshot/restore
8. Battle Grounds and full gameplay from canon v12

## Quality gates
- A visible nonblack rendered frame on iOS and Android hardware; simulator screenshot alone is not enough.
- 3D scene stays interactive and does not crash on GPU feature mismatch.
- Baseline frame-time, memory and tile load metrics captured before optimization claims.
- No unverified “60 FPS” or complete NYC assertions.
- Foldable hinge-safe rail and Inspector parity verified on device/emulator.
- No raw HTML UI; `packages/app/features/` feature boundaries and thin `apps/mobile/app/` routes enforced.
- No invented assets or copyrighted source transplant without license verification.
- PRs small and ordered; no merge before tests/review.

## Future NYC visual layer — skyscrapers and holographic AdSurfaces

Preserve the real NYC base map and recognizable borough identities. Author selected tall towers, retrofitted rooftops, elevated structures, neon signage and futuristic façades as a **separate optional world-decoration layer**, not replacements for OSM road/building geometry.

Visual direction: near-future New York inspired by the atmosphere of Blade Runner and Ghost in the Shell, with original NYC-Mon designs. Harlem and the Bronx must retain their street-level cultural character. No wholesale copy of protected film designs, brands or signage.

Residential exception: public housing gets the NYCHA exterior facelift below. No arbitrary advertising on real residences (creator, 2026-10-13).

**Addressable AdSurface contract:** each eligible billboard/façade/holographic anchor gets a stable world-space ID, geo/borough/neighborhood metadata, orientation, dimensions, occlusion and visibility limits, permitted creative formats, LOD priority, and campaign placement eligibility. Keep inventory data-driven so ad content can change without rebuilding the city.

**CMS pipeline:** Payload defines business, creative, campaign, schedule, daypart, target geography, approval/moderation, venue/POI link, community inventory and analytics. Bunny media delivery can be used for approved creative. Clear sponsorship labels and no pay-to-win effects. Community placements for nonprofits and small local businesses.

**Rendering:** Three.js WebGPU + TypeGPU for scene geometry, shader-based holograms, emissive surfaces, volumetric-looking effects where performance permits, animated texture/video surfaces, projection/occlusion and distance-based quality tiers. React Native owns UI; no HTML-in-canvas ad UI or raw DOM overlay as a substitute for the world renderer. Avoid autoplaying high-cost media when offscreen.

**Future PR sequence, after city-first visible frame:**
1. Skyline art direction and building overlay registry.
2. Authored futuristic towers/rooftop add-ons with spatial metadata.
3. Holographic AdSurface component and WebGPU/TypeGPU effect presets.
4. Payload campaign/creative/approval collections and API contracts.
5. Local-business targeting, scheduling, fallback content and community inventory.
6. Impression/interaction measurement, privacy safeguards, accessibility and device performance gates.

The first city-rendering milestone remains **city only**. Do not gate the visible city on the CMS, advertisers, holograms or future tower assets.

## Approved art direction: futuristic NYCHA exterior facelift (creator, 2026-10-13)

Source: creator comment on PR #29 and PR #20, 2026-10-13. The concept render it approves is not committed yet. This section sets scope only; nothing here is implemented.

The facelift is an additive styling layer on the existing NYC map and renderer. It replaces nothing.

**Art direction**
- Keep the real NYC footprint, road geometry, project massing, brick-and-concrete housing identity and neighborhood character.
- Exteriors get a substantial modern facelift: refined red-brick and concrete palettes, charcoal window framing, modular facade panels, planted balconies and roof gardens, vertical architectural lighting, upgraded entrances, wayfinding, and landscaped ground-level courtyards.
- Sci-fi elements are selective. The result stays believable and lived-in, not uniform neon cyberpunk.
- Several NYCHA kits by building typology and borough, so blocks don't share one facade.
- Train and transit visuals are creator-owned and out of scope. Leave integration hooks; don't add or alter train assets.
- Project names and facade text in the generated concept are non-canonical. Don't import "Riverdale Homes", slogans or any generated label as a real NYC name without an authoritative source.

**Constraints**
1. Inspect the existing world renderer, metro-live integration, building IDs, LOD/instancing, materials and asset pipeline first. Do not rebuild the NYC dataset or world.
2. Overlays are reversible and semantic, keyed by stable building IDs. Original OSM building shapes and topology stay unchanged.
3. Classify housing against verified NYC/NYCHA datasets before targeting it. Appearance alone never marks a building as public housing.
4. Kits (facade, roof, courtyard, entrance) follow the Kaiju-Tamagotchi-inspired skill workflow: concept → generation receipt → Blender mesh/material cleanup → GLB optimization → runtime integration → screenshot QA.
5. Hold the Three.js WebGPU / TypeGPU / React Native budget, with visual and performance gates for near/mid/far LOD, device GPU memory, the fallback render and borough variety.
6. No arbitrary advertising on real residences. Keep public pathways accessible and cultural identity intact.

**Follow-on lanes** (after the city-only milestone, alongside stage 6 above)
- FUT-01: verified NYC housing classification and the semantic attachment layer.
- FUT-02: at least 3 facade kit families with material variants, rooftops and entrances.
- FUT-03: vegetation, courtyards, warm lighting and resident-scale detail.
- FUT-04: environment-generation skills and a reproducible Blender asset pipeline.
- FUT-05: screenshot and performance gates on web, mobile and XR where supported.
