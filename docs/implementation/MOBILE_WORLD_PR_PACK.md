# Mobile World Skeleton — Per-screen PR Execution Pack

## Canon
Native tabs: HOME | GAME | raised H-LYNK | MONS | CALLER. Home is landing/choice, Game is playable NYC, H-Lynk is device + care, Mons is species dex, Caller is player identity. No Battles tab. Web remains Mon Space companion only.

## Nonnegotiables
- React Native screens under `apps/mobile/app/features/<feature>/` (or existing app/features root verified in repo); Expo Router route files only re-export/mount features.
- Reuse existing `packages/ui`, theme tokens, and semantic components. No raw HTML screens, Tamagui, Bento, CSS-shader substitute, Unity.
- Game uses Three.js WebGPU + react-native-webgpu + TypeGPU. Audit compatibility and exact installed package versions before edits; do not blindly upgrade.
- Zustand for cross-feature state; Reanimated/Gesture Handler and Kinetrell for motion. No GSAP/Lenis directly.
- Preserve current H-Lynk/care functionality and one persistent Mon.
- Web never gets full Game screen.
- Accessibility, safe areas, orientation, RTL, reduced motion, screen reader labels, touch target sizes, no regressions.

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
**PR 1 — Native shell / navigation:** Home, Game, H-Lynk, Mons, Caller tab structure; Home launch; raised center action; deep linking; all feature ownership in app/features; preserve auth/care. Tests: navigation, tab persistence, safe areas.

**PR 2 — Home placeholder:** Named Home screen, a clear Enter Game action and no fabricated live content. Tests: launch and action route.

**PR 3 — Game world vertical slice:** Port/adapt architectural ideas from https://github.com/vietgangzz/vg-demos-all (especially metro-live). Inspect upstream license and source first. NYC-only offline OSM tile sample, recognizable streets/buildings, camera orbit/zoom + mobile movement, stable loading/error states, device GPU capability checks. Three/WebGPU/TypeGPU only. No massive five-borough build yet. Show real moving 3D scene on physical mobile device. Tests: scene mounts, first visible frame, movement, tile reload, memory and performance.

**PR 4 — H-Lynk placeholder / preservation:** Keep current active Mon → Mon Space working; other tools named placeholders. Tests: no lost care state, accessible center button.

**PR 5 — Mons placeholder:** Dex named screen only, preserve future scan/collection route contract. Tests: navigation and accessibility.

**PR 6 — Caller placeholder:** Named identity screen, no mock ranking data. Tests: auth/guest states and navigation.

**PR 7 — Foldable/tablet/rail parity:** Mirror Harlem Might responsive policy: compact portrait bottom tabs, compact-height landscape bottom, medium/expanded/large start-edge rail, extra-large labeled rail, RTL rail placement, fold/hinge exclusion zones, book/tabletop postures, two-pane master-detail and trailing Inspector. Foldable Game retains uninterrupted world canvas while details occupy a hinge-safe secondary pane. Verify `react-native-arrangement-view` fit and native WindowManager posture signals. Tests: phone portrait/landscape, tablet, book fold, tabletop, trifold simulation, RTL, font scaling, rotate/unfold state retention.

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
- No raw HTML UI; app/features feature boundaries enforced.
- No invented assets or copyrighted source transplant without license verification.
- PRs small and ordered; no merge before tests/review.
