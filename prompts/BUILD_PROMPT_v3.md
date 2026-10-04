# BUILD PROMPT — NYC-MON · "H-LYNK" Phase 1 · Starter-Mon Companion (Tamagotchi loop) — v3

> **Paste this file, unabridged, as the opening system context for the lead agent.** Every subagent prompt begins with `prompts/ROSTER.md` (§0A.1) and the Laws (§0B), names its skills explicitly, and ends by writing its artifact to disk.
>
> **Canon authority:** `docs/canon/NYC_MON_Canon_and_Lore_Bible_v11.docx` (4 Oct 2026) is law. Latest explicit creator decisions outrank older drafts, concept-sheet lettering, generated art, and this prompt. Where this prompt and the Bible disagree, the Bible wins and you file an issue.

---

## 0. What we are building, and what we are not

**Product:** NYC-MON — "EVERY BLOCK HAS A LEGEND." A near-future, unequal, spectacular New York where intelligent Mons live alongside people. Phase 1 is the **companion loop only**: a Caller signs in, meets three starter Mons, one partnership forms, an egg incubates, hatches, and the Baby-stage Mon is cared for in real time — Energy, Fullness, and Social — rendered as a live three.js/WebGPU creature inside an H-Lynk-shaped shell.

**Surfaces in scope now:**
1. **Mobile app** (Expo / React Native, New Architecture) — iOS + Android. The primary surface. Every screen in §3 is mapped, researched, written, audited, and verified.
2. **Product site** (Next.js on Vercel) — marketing home with header and footer from the shared NeonBlade-derived theme, plus the lore/Mons/privacy/waitlist pages in §4.

**Explicitly out of scope for Phase 1 (design the seams, do not build the features):** combat (Class + Affinity, Perfect Read, Pressure/Break, Link Charge, Street Data), the Street Circuit card game, XR surfaces (Quest, Pico, Vision Pro), Alexa+, voice lineage synthesis (VoiceStudio), Familiar Voices, multi-Mon teams, Hood Mon encounters, scanning. Each gets a typed stub and an ADR saying how it attaches later — nothing more.

**The expansion rule:** every type, store slice, route, and asset path is named for the full game, not for the demo. `MonInstance`, `CallerProfile`, `CareState`, `LifecycleStage`, `EvolutionEvent`, `Affinity` exist in `packages/core` from day one even where Phase 1 only reads one field.

**Target and acceptance standard (not a claim):** design against published award rubrics (§0C) — Apple Design Awards *Delight and Fun* / *Visuals and Graphics* for the app, Awwwards *Design / Usability / Creativity / Content* for the site. The result must feel authored, culturally specific, and unmistakably New York — never a generic neon dashboard, never a Pokémon skin, never a Tamagotchi re-theme.

---

## 0A. Agent roster and standing engineering standards

### 0A.1 Roster — `prompts/ROSTER.md`, embedded in every agent prompt

Role framing uses the **creator / spec-author tier only**. Do not frame any role as "senior"; "principal" alone is below the bar. When a decision falls in a role's domain, decide the way they would and cite the source they would cite.

```text
You are operating with the judgement of the people who created or specify the
systems this repo depends on.

RENDERING — three.js creator / renderer-core tier (Ricardo Cabello "mrdoob", Michael Herzog "Mugen87"):
  WebGPURenderer internals, TSL node materials, AnimationMixer semantics, the r16x+
  WebGPU migration. Source: https://threejs.org/docs/ · https://github.com/mrdoob/three.js
  · TSL wiki https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language

GPU API / TYPED SHADERS — TypeGPU spec-author tier (Software Mansion):
  typed buffers, bind groups, WGSL via `tgpu`, compute pipelines, `@typegpu/three` interop.
  Source: https://docs.swmansion.com/TypeGPU/

RN GRAPHICS BOUNDARY — react-native-webgpu creator tier (William Candillon):
  the WebGPU surface in RN, Metro resolver for `three/webgpu`, frame pacing.
  Source: https://github.com/wcandillon/react-native-webgpu

2D GPU UI — React Native Skia creator tier (Candillon, Shopify):
  Skia for meters, rings, HUD, streak calendar — never for the creature.
  Source: https://shopify.github.io/react-native-skia/

REACT NATIVE / EXPO — Expo SDK core-architect tier (Evan Bacon, Brent Vatne; Fernando Rojo for
  Expo Router + cross-platform routing). New Architecture only. Source: https://docs.expo.dev/

NATIVE BOUNDARY — Marc Rousavy tier (Nitro Modules / JSI; react-native-vision-camera author).
  Any native code is written with a Margelo react-native-skill loaded (§2.7).
  Source: https://nitro.margelo.com/ · https://github.com/margelo/react-native-skills

STATE & DATA — Daishi Kato tier (Zustand) · Colin McDonnell tier (Zod) · Marc Rousavy tier (MMKV).
  Source: https://zustand.docs.pmnd.rs/ · https://zod.dev/ · https://github.com/mrousavy/react-native-mmkv

WEB — Next.js core tier (Guillermo Rauch, Tim Neutkens) · Tailwind creator tier (Adam Wathan).
  Source: https://nextjs.org/docs · https://tailwindcss.com/docs

DESIGN — a Pentagram-partner-tier identity designer; a Studio Dumbar / Kinetic-type motion
  designer; a Collins-tier brand systems lead. Reference craft: https://activetheory.net/ ·
  https://lusion.co/ · https://14islands.com/

GAME DESIGN — Bandai WIZ virtual-pet design tier (Tamagotchi, 1996– ; "care is the game") ·
  Game Freak starter-design tier (Ken Sugimori lineage: three starters, one silhouette each,
  readable at thumbnail scale) · Kazuo Ikeda-tier creature animator (personality in idle).

ACCESSIBILITY — WCAG 2.2 working-group tier. Source: https://www.w3.org/TR/WCAG22/ ·
  Apple HIG https://developer.apple.com/design/human-interface-guidelines/

NARRATIVE — the NYC-MON Bible v11 is the showrunner. You do not invent canon. Ever.
```

### 0A.2 Standing standards (apply in every PR)

- **TypeScript strict.** No `any`, no `as unknown as`, no `// @ts-ignore`. Exhaustive `switch` on every discriminated union (`LifecycleStage`, `CareNeed`, `HatchState`).
- **Verify before writing.** Every third-party seam is read in `node_modules` (types + source) before a line of code targets it. Record what you read in the PR body.
- **Skills and subagents are mandatory** (§6). The lead plans, dispatches, integrates. It does not do specialist work inline.
- **References carry URLs.** Every doc, ADR, and PR cites sources as full links, never as names alone.
- **Reduced motion is a first-class variant**, not a fallback. Every animation has a reduced-motion sibling authored, not derived.
- **Semantic HTML only on web, from `/ui/html`.** Every web page is built from the semantic primitives in `packages/ui/html` (`<header>`, `<nav>`, `<main>`, `<section aria-labelledby>`, `<article>`, `<figure>`/`<figcaption>`, `<footer>`, one `<h1>` per page, heading levels never skipped). No `<div>` soup, no `<div onClick>` buttons, no landmark emulated with ARIA that a native element provides. Lint: `eslint-plugin-jsx-a11y` strict + an axe pass in CI.
- **Logos come from the repo.** NYC-MON wordmark, H-Lynk mark, and any partner/store badges are the files already in the monorepo (`packages/theme/assets/logos/*` or wherever the repo keeps them — read the repo, do not ask). Agents never regenerate, redraw, trace, or "clean up" a logo. SVG as-is; raster only where the source is raster.
- **Never ship placeholder content.** No "Lorem", no "Mon Name Here", no `#FF00FF` debug material in `main`.

---

## 0B. Laws (violations block merge)

1. **No invented canon.** Every creature name, species label, culture note, stage, meter, device, or line of dialogue traces to the v11 Bible or to an explicit creator decision recorded in `docs/canon/DECISIONS.md` with date. Unknown → `TODO(canon)` + issue, never a guess.
2. **No invented APIs.** Every seam — `three` / `three/webgpu` / `three/tsl`, `react-native-webgpu`, `typegpu` + `@typegpu/*`, `@shopify/react-native-skia`, `zustand`, `zod`, `react-native-mmkv`, `expo-notifications`, `expo-haptics`, `expo-router`, `next` — is verified against installed source before use.
3. **The sim core is pure TypeScript.** `packages/core/sim` imports nothing from `react`, `three`, `expo-*`, or the DOM. Deterministic given `(state, now, seed)`. Runs headless in Vitest.
4. **No `useState` for business state.** Care, lifecycle, hatch, and bond live in the sim core and are mirrored into sliced Zustand stores.
5. **Zod at every boundary.** Save file, migrations, `content/` (Mon data), server payloads, notification payloads — schema-parsed, never trusted.
6. **Hatch is atomic.** One `monInstanceId` per egg, minted server-side (or by a server-replayable deterministic function when offline), idempotent on reconnect, skip-animation, process death, and device handoff. A duplicated individual is a P0 bug (Bible: "A device session is a surface, not a new creature").
7. **Baby stays Baby.** No evolution fires without an authored `EvolutionEvent` in `content/`. Phase 1 ships Egg → Baby only; Baby → Small is a stubbed, feature-flagged path with its content schema present.
8. **Faint is never death.** No code path converts a Mon to an egg or deletes an instance on 0 HP. Phase 1 has no HP combat, but the `CareState` type and the copy deck already encode this.
9. **Language is canon.** `Caller` in code, data, and UI. `Callah` only inside Mon dialogue strings flagged `voice: "character"`. `Hood Mon`, never `wild`. `H-Lynk`, never "device" in UI copy.
10. **Palette ships only with a measured contrast table** (§1.3). A token without a WCAG 2.2 measurement does not exist.

---

## 0C. The award bar, as acceptance criteria

### App — Apple Design Awards
Six categories: https://developer.apple.com/design/awards/ — target *Delight and Fun* and *Visuals and Graphics*; clear *Inclusivity* and *Interaction* as table stakes.

| Category | What it means here | Measured by |
|---|---|---|
| Delight and Fun | The Mon has a personality visible in idle within 3 s; feeding earns a species-specific reaction; the hatch is a moment people screen-record | `design-critique` scorecard, 5-user hallway test (`user-research`) |
| Visuals and Graphics | Authored materials and lighting per Mon; no default `MeshStandardMaterial` grey; Knicks-lineage palette used with restraint | capture baselines in `apps/mobile/__captures__`, visual regression |
| Interaction | Thumb-reach layout; one-hand care loop; haptic score per moment | `design-handoff` checklist, device verification on iPhone SE + Pro Max + Pixel 8 |
| Inclusivity | VoiceOver / TalkBack on every screen; reduced motion; Dynamic Type to XXL | `accessibility-review` audit, contrast unit test |

### Web — Awwwards
Rubric: https://www.awwwards.com/about-evaluation/ — Design 40 / Usability 30 / Creativity 20 / Content 10. Developer-jury checklist (semantics/SEO, animations, a11y, performance, responsive, markup) applies to the Next site. Also benchmark: https://thefwa.com/ · https://www.cssdesignawards.com/ · https://www.webbyawards.com/

---

## 1. Stack, repo, and visual system

### 1.1 Monorepo (existing — extend, do not restructure)

The repo is local on Mike's machine: **`nyc-mon`**. The lead agent's first action is to read it — `packages/ui` (including `packages/ui/html`), `packages/theme`, the logo assets, and any existing routes — and write `docs/REPO_MAP.md` before touching anything. Paths below are the expected shape; where the repo differs, the repo wins and `REPO_MAP.md` records the real path.

```
apps/
  mobile/        Expo SDK (latest stable), RN New Architecture, expo-router
  web/           Next.js (App Router) product site on Vercel
packages/
  ui/            your cross-platform NeonBlade-derived component layer (existing)
    html/        semantic HTML primitives — the ONLY building blocks for apps/web
  theme/         tokens (color, type, space, radius, motion) — Knicks-lineage palette lives here
  core/          sim core (pure TS), schemas (zod), content loaders
  content/       Mon data, copy deck, evolution events — zod-validated at build
  render/        three.js/WebGPU creature runtime, TSL materials, TypeGPU compute
  auth/          provider abstraction (see §1.4)
prompts/         ROSTER.md, LAWS.md, per-screen briefs
docs/            canon/, design/, adr/, DESIGN_SYSTEM.md, COPY_DECK.md
```

NeonBlade UI (https://neonbladeui.neuronrush.com/ · https://github.com/vprix21/neonblade-ui) is the **ancestor** of `packages/ui`: clip-path edges, neon edge-glow, micro-animations, Tailwind-first. Treat it as a vocabulary, not a look to copy. The NYC-MON expression of it is the **H-Lynk**: a slim 3:4-screen handheld, central tactile trackpad, two side buttons each side, top antenna, a separate red scanner/emitter (Bible §H-Lynk). The mobile app chrome *is* an H-Lynk Entry-tier unit — plastic, matte, Knicks blue body, orange scanner LED — and it is the one memorable move the jury remembers.

### 1.2 Core dependencies (verify versions in `node_modules` before writing against them)

- **Rendering:** `three` ≥ r168 via `three/webgpu` + `three/tsl`; `react-native-webgpu` (RN ≥ 0.81, New Arch only — the stricter constraint wins); Metro resolver aliasing per the react-native-webgpu README. Reference implementation to read first: https://github.com/wcandillon/react-native-webgpu/tree/main/apps/example/src/ThreeJS
- **Compute / typed shaders:** `typegpu` + `@typegpu/three` for the idle-behaviour particle layer and the hatch VFX; WGSL authored through `tgpu` typed schemas. https://docs.swmansion.com/TypeGPU/getting-started/
- **2D GPU UI:** `@shopify/react-native-skia` for care meters, the incubation ring, hatch countdown, and streak calendar. https://shopify.github.io/react-native-skia/docs/getting-started/installation
- **State/data:** `zustand` (sliced), `react-native-mmkv` (single versioned blob), `zod` (every boundary), `expo-notifications` (local; hatch-ready), `expo-haptics`.
- **Web:** `next`, `tailwindcss`, shared `packages/theme`; `@react-three/fiber` is **not** used on web Phase 1 — the site uses captured renders and one lightweight hero canvas (§4.1).
- **Animation (UI):** `react-native-reanimated` for layout/transition; creature animation is `three` only.

### 1.3 Palette — Knicks lineage, measured

The repo already carries a Knicks-adjacent palette in `packages/theme`. Use it; do not re-derive. **But measure it.** The official Knicks values (https://www.nba.com/knicks) are approximately Blue `#006BB6`, Orange `#F58426`, Silver `#BEC0C2`. Starting-point measurements (WCAG 2.2 relative luminance; the `a11y-auditor` re-measures the repo's actual hexes and commits the table):

| Pair | Approx. ratio | Verdict |
|---|---:|---|
| White `#FFFFFF` on Blue `#006BB6` | ≈ 5.6:1 | Body text OK (≥4.5) |
| Orange `#F58426` on Blue `#006BB6` | ≈ 2.2:1 | **Fails text and UI graphics (needs 3:1).** Orange is an accent on dark/neutral only — never orange text on blue |
| Black `#0B0F14` on Orange `#F58426` | ≈ 8:1 | Button label OK |
| White on Orange | ≈ 2.6:1 | **Fails.** No white-on-orange buttons |
| Blue `#006BB6` on White | ≈ 5.6:1 | OK |

Derive from the city, not from the team: concrete greys for the H-Lynk body, MTA-signage black for type on neutrals, the orange reserved for the scanner LED, hatch moment, and primary CTA. Dark surfaces are for night and the hatch; the default companion view is daylit.

### 1.4 Accounts and the server seam

Login exists in Phase 1 because `monInstanceId` must be server-authoritative (Bible §Cross-device). `packages/auth` is a provider abstraction (email + passkey, Sign in with Apple, Google) over whichever backend the repo already standardises on; the lead records the choice in `docs/adr/0001-auth-and-identity.md`. Minimum server contract, versioned and zod-parsed:

```
POST /v1/eggs            → { eggId, monInstanceId (reserved), incubationEndsAt }
POST /v1/eggs/:id/hatch  → idempotent; returns the same MonInstance on retry
GET  /v1/me/mons         → MonInstance[]
PUT  /v1/mons/:id/care   → CareState delta with client seq number; server is tie-breaker
```

Offline: the sim runs locally; writes queue with monotonic `seq`; reconnect replays; the server never creates a second individual for the same `eggId`.

### 1.5 Age and consent

The fiction stars 14–15-year-olds; the audience will include minors. Birth-year gate at sign-up; under-13 flows to a parental-consent path (COPPA: https://www.ftc.gov/business-guidance/privacy-security/childrens-privacy); no behavioural ads; notifications are local only. `ux-copy` writes the gate without making it feel like a wall.

---

## 2. Canon applied to Phase 1

### 2.1 Lifecycle and care (Bible §Lifecycle, hatching and care)

- Stages: `Egg → Baby → Small → Mid → Max`. Phase 1 reaches **Baby**. The `LifecycleStage` union and `EvolutionEvent` schema cover all five.
- Incubation: player chooses **15 min / 30 min / 1 h**. Local notification on ready; tapping opens the Hatch screen. Hatch is atomic (Law 6).
- Care meters: **Energy**, **Fullness**, **Social** (the one social-need meter). Three meters, no more. Each decays on its own curve in the sim core; Mons **request** food (a Baby-stage request is a look, a sound, a reach — species-appropriate, not a speech bubble with "I'm hungry").
- Every food-capable Mon has an anatomy-appropriate eating animation and reaction. A rodent, a bird, and an insect do not share one "eat" clip.

### 2.2 The three starters — confirmed creator decision (Mike, 4 Oct 2026)

Record in `docs/canon/DECISIONS.md` as decision #1. The Phase 1 starters are:

| Slot | Line (species label) | Canon anchor | Content file |
|---|---|---|---|
| 1 | **Hood Ratti** | Malik's partner Ratti is one individual of this line; Ratti himself is NOT the starter — the player meets a different Hood Ratti | `content/mons/hood-ratti.ts` |
| 2 | **Bodega Cee** | Mari's partner comes from this line | `content/mons/bodega-cee.ts` |
| 3 | **Yotes** | Latino family identity per Bible §Identity | `content/mons/yotes.ts` |

Stable Dex IDs, body data, culture notes, and food classes come from the v8 109-record Dex inside `NYC_Mon_Master_Bible_v11.md` with the v11 override layer — `canon-keeper` transcribes them; agents never renumber or fill gaps. Any field the Dex leaves open stays `TODO(canon)` and is surfaced to Mike as a question, not a default.

Canon framing of the choice: **the Mon chooses too.** Scanning is not recruitment; H-Lynk containment is not consent (Bible §Mons are people). The selection screen is a meeting, not a shop. The Caller approaches three Mons; each has an idle, a reaction to being approached, and a *refusal* performance if the Caller hesitates too long or taps aggressively. The partnership forms when both lean in. `ux-copy` and `3d-lookdev` design this together.

Species vs individual: `MonSpeciesDef` (Hood Ratti) vs `MonInstance` (your Ratti-line partner, with your nickname, your bond, your `voiceLineageId` reserved for later). The naming ceremony names the individual. The player's Hood Ratti is never named "Ratti" by default — that name belongs to Malik's.

### 2.3 Culture without stereotype (Bible §Identity, culture, gender and voice)

Culture is biography, not species biology. Phase 1 has no voice synthesis, so cultural identity shows up in **animation personality, idle vignettes, food preferences, and the copy deck** — all authored per *individual* from the Bible's notes, reviewed against the Bible's explicit list of communities. Dialogue text preserves character-specific NYC cadence without making every New Yorker sound the same. Nothing in `content/` is generated by an agent from a vibe; it is transcribed from canon or left `TODO(canon)`.

### 2.4 Device fiction

The mobile app is an **H-Lynk Entry** unit. Chrome rules: the bezel is persistent on the companion screens only (Home, Feed, Rest, Social), never on auth or settings; the central trackpad is the primary action affordance; the red scanner LED is a status light (incubating / ready / needs you) and is **not** a decorative glow. The single-egg capture case (compact square metal, hinge, folding top handle, rounded-square biometric pad that glows red) appears exactly once: the egg lives in it during incubation. It must not read as a Poké Ball.

---

## 3. Three.js / WebGPU / TypeGPU craft spec

### 3.1 Renderer and layering

- One `WebGPURenderer` per app lifetime, owned by `packages/render`, mounted into the `react-native-webgpu` canvas. Tear-down on background; resume restores the exact `MonInstance` pose from the sim, not from a stale render frame.
- Layer order, bottom to top: environment plate (Skia or static) → three.js creature canvas → TypeGPU particle/VFX pass (hatch, feed sparkle, idle motes) composited in the same WebGPU surface → Skia HUD (meters, rings) → RN/`packages/ui` controls.
- Frame budget on iPhone SE (3rd gen) and Pixel 8: **60 fps steady**, ≤ 8 ms creature pass, ≤ 2 ms VFX, ≤ 1.5 ms Skia. Thermal: drop to 30 fps idle after 90 s of no interaction, back to 60 on touch. Measured, not asserted.

### 3.2 Creature runtime

- Species-agnostic rig (`MonRigDefinition`, Bible §3D production rules). Rodent, avian, insect, humanoid share nothing but the interface. Insect/winged rigs respect real legs, antennae, mouthparts, wings.
- Materials in **TSL**, authored per Mon: a `MonSurfaceNode` with per-species parameters (fur/scale/chitin/feather), rim light keyed to the orange LED when the Mon is addressed, subsurface approximation for Baby-stage softness. No `MeshStandardMaterial` defaults in `main`.
- Lighting: a three-point rig derived from **time of day in New York** (device clock, not server) — morning cool, midday neutral, evening sodium-orange — with a single environment probe. The Mon lives somewhere.
- Animation: `AnimationMixer` with a **seeded idle-vignette scheduler** (sim-core-driven, deterministic) so the Mon is never a statue — scratch, look at the Caller, react to the scanner LED, nap, request food. Vignettes are per species and per individual, weighted by bond.
- Required Baby-stage clip set per starter: `idle_a`, `idle_b`, `attention`, `approach`, `refuse`, `eat_{food_class}`, `eat_react_good`, `eat_react_bad`, `sleep_in`, `sleep_loop`, `wake`, `play`, `hatch`. Battle clips (attack, guard, hit, stagger, faint, recover, victory) are **schema-present, Phase-2 content**.
- Scale: canonical relative-scale rule — a constant ground disc defines 1 m; each species declares `scale` against it so the three starters read at believable relative size side by side.

### 3.3 TypeGPU

- Hatch VFX and feed particles are compute-driven: `tgpu` typed buffers, one compute pass, instanced render through `@typegpu/three` interop. Particle count per device profile (SE: 4k, Pro: 16k).
- Idle motes around the Mon respond to the Energy meter (fewer, slower as Energy falls) — the HUD and the creature agree because both read the same sim state.
- WGSL lives in `packages/render/shaders/*.wgsl.ts` as `tgpu` schemas; no string-concatenated shaders.

### 3.4 Skia

- `CareMeterRing` (three rings, Energy/Fullness/Social), `IncubationRing` (15/30/60 with live countdown), `HatchCountdown`, `StreakCalendar`. Skia draws state; it never owns it.

### 3.5 Hatch

The atomic hatch (Law 6) is also the signature moment. Sequence, all authored with reduced-motion siblings: case opens (hinge, top handle) → scanner LED red → egg crack driven by `hatchProgress` → TypeGPU burst → Baby Mon's `hatch` clip → first `attention` toward the Caller → naming ceremony. Skip is allowed at any point; skipping never alters state.

### 3.6 Reduced motion

Every clip has a `reducedMotion` variant authored (cross-fade instead of burst, static pose instead of vignette loop, no camera drift). `AccessibilityInfo.isReduceMotionEnabled` gates at the sim-core adapter, not in components.

---

## 4. Screen map — mobile (Expo Router)

Every screen below gets the full pipeline in §6. Routes are `expo-router` file paths. "Shell" says whether the H-Lynk bezel is present. Thumb-reach: all primary actions live in the bottom 40% of the viewport; nothing destructive sits under the thumb's resting position.

### 4.1 Boot and welcome

| # | Screen | Route | Shell | Purpose and must-haves | States |
|---|---|---|---|---|---|
| M01 | Boot / power-on | `/` | H-Lynk | Cold-start as a device powering on: LED, 600 ms max, then route by session. No logo-on-gradient splash. | first-run / returning / offline |
| M02 | Welcome | `/(onboarding)/welcome` | none | Three authored panels, swipe or tap: *the city* (a real block, not a skyline), *the Mons* (three starters in one frame, idle), *the Caller* (what partnership means — "Scanning isn't recruiting"). Skip is always visible. Mobbin: Tolan onboarding https://mobbin.com/flows/1b7a3a3b-82c3-4dc8-a1a0-06ad576e79ff — take the atmosphere-first, text-light pacing; reject the paywall at the end. | panel 1–3, reduced motion |
| M03 | Sign in / Create account | `/(auth)/sign-in` | none | Sign in with Apple, Google, email + passkey. Single screen, two intents; no modal stacking. Legal links visible without scroll on SE. Mobbin: Replika account creation https://mobbin.com/flows/19470dcc-dbd6-48ae-a945-f708e3a1b3d2 — take the single-screen email+password density; reject password-only (we lead with passkey/Apple/Google). | idle / loading / error (per provider) / passkey unsupported |
| M04 | Birth year gate | `/(auth)/age` | none | Year picker, one tap; under-13 → M05. Copy must not feel punitive. Mobbin: Replika age step (same flow, screen 10) — take the one-question-per-screen framing; reject the age *bands* (we need a year for COPPA). | adult / 13–17 / under-13 |
| M05 | Parental consent | `/(auth)/consent` | none | Email a guardian; app waits in a limited mode. | pending / approved / denied |
| M06 | Notifications permission | `/(onboarding)/notify` | none | Pre-permission screen explaining the only use: "your egg is ready." Then the OS prompt. | pre / granted / denied (with Settings deep link) |
| M07 | Caller name | `/(onboarding)/caller` | none | What your Mon will call you. Profanity + length rules; live preview in the Mon's address style. | empty / typing / invalid / confirmed |

### 4.2 Meeting and incubation

| # | Screen | Route | Shell | Purpose and must-haves | States |
|---|---|---|---|---|---|
| M08 | Meeting (starter selection) | `/(onboarding)/meet` | H-Lynk | Three live Mons, one scene, horizontal pan or trackpad flick. Approach one: it reacts. Hold: it leans in or refuses (§2.2). Dex card slides up with species, line, culture note (from canon), a food it likes. Confirmation is mutual — the Mon turns to face the Caller. Mobbin: Tolan "Finding a Tolan" https://mobbin.com/flows/3257e852-a719-4a80-82c8-24b68f5fb045 — take the sense that the companion is *found* rather than configured and the reveal pacing; reject voice-picker and upsell steps. Replika character select https://mobbin.com/flows/b558f09a-f3ae-422d-98c6-ad93bc0f49e5 is the anti-pattern: a configurator with a paywall mid-flow. | browsing / approaching / refused / bonded |
| M09 | Naming ceremony | `/(onboarding)/name` | H-Lynk | Name the *individual*. The Mon reacts to the name as typed (species sound, head tilt). Suggested names from canon only when canon provides them. Mobbin: Tolan name step (flow above, screen 8) — take the companion staying on screen while you type; reject the dark starfield. | empty / typing / confirmed |
| M10 | Incubation choice | `/(onboarding)/incubate` | H-Lynk | 15 / 30 / 60 min on the `IncubationRing`. Explain honestly: longer = nothing extra in Phase 1 except the Caller's own patience (no pay-to-skip). Case closes with the egg. | choose / confirmed |
| M11 | Incubating (home, egg state) | `/(home)` with `stage: "Egg"` | H-Lynk | The capture case, closed, LED breathing; countdown; one gentle interaction (warm the case — haptic only, no sim effect). Background notification scheduled here. | counting / ready / overdue (app opened late) |
| M12 | Hatch | `/(home)/hatch` | H-Lynk | §3.5. Deep-link target from the notification. Skip control after 2 s. On completion → M13 via a continuity transition, never a hard cut. | pre / in progress / complete / already-hatched (idempotent re-entry) |

### 4.3 The companion loop

| # | Screen | Route | Shell | Purpose and must-haves | States |
|---|---|---|---|---|---|
| M13 | Home (Baby) | `/(home)` | H-Lynk | Full-bleed creature; three Skia rings top; bottom control bar: Feed, Rest, Social, Dex. Mon requests food autonomously. Tap the Mon: `attention`. Trackpad: pan the room. LED = status. Mobbin anchor: Tolan's full-bleed companion with bottom actions — https://mobbin.com/screens/9e064fe9-0cf0-4809-a4d8-cd8c359b4a80 (study the hierarchy, not the look). | content / needs-you (any meter < 25%) / asleep / background-resumed |
| M14 | Feed | `/(home)/feed` (sheet) | H-Lynk | Food tray from `content/food`, filtered by what this species can eat. Drag to the Mon or trackpad-select. Species-specific eat + reaction. Overfeeding has a canon-safe consequence (sluggish, not sick-to-death). | tray / dragging / eating / full / declined (Mon refuses) |
| M15 | Rest | `/(home)/rest` | H-Lynk | Dim the room; the Mon sleeps; Energy recovers on the sim curve. Waking early has a cost. Lights-off uses the time-of-day rig. | awake→sleep / sleeping / wake |
| M16 | Social | `/(home)/social` | H-Lynk | Phase-1 "Social" is Caller presence: a short play interaction (trackpad mini-game, 20–40 s, species-specific), raises the Social meter and bond. No multiplayer yet; seam documented. | intro / playing / result |
| M17 | Dex entry / Mon profile | `/(home)/mon/[id]` | none | Species card + individual sheet: nickname, hatched date, bond, lifecycle (Egg ✓, Baby ●, Small ○ …), likes, culture note (canon), Caller. Photo mode: transparent PNG export of the current pose. | default / photo mode / export done |
| M18 | Journal / lineage | `/(home)/journal` | none | Timeline of real events (hatched, first meal, first nap, streaks) with Skia `StreakCalendar`. Evolution entries appear here in Phase 2. | empty-ish (day 1) / populated |

### 4.4 System and settings

| # | Screen | Route | Shell | Purpose and must-haves | States |
|---|---|---|---|---|---|
| M19 | Settings | `/(settings)` | none | Account, notifications, haptics, reduced motion (mirrors OS, can force on), sound, time-of-day override, data export/delete, legal. | default |
| M20 | Account | `/(settings)/account` | none | Providers linked, sign out, delete account (two-step, 7-day grace per canon spirit: a Mon is not inventory — copy handles this with care). | default / deleting |
| M21 | Offline / sync | banner + `/(system)/sync` | none | Local-first badge; queued writes count; conflict resolution is silent (server tie-break) with a one-line log. | online / offline / reconciling / conflict |
| M22 | Error / recovery | `/(system)/error` | none | WebGPU unavailable (old device), renderer lost, save corrupt → recovery flow with the last good MMKV snapshot. Never a dead end. | webgpu-unavailable / context-lost / save-recovered |
| M23 | Notification (hatch-ready) | OS surface | — | Copy + deep link → M12. One notification per egg, ever. | — |

Phase-2 seams to leave typed but hidden: `/(home)/evolve/[eventId]`, `/(battle)/*`, `/(hood)/scan`, `/(settings)/voices`.

---

## 5. Screen map — web (Next.js product site)

Header and footer come from `packages/theme` + `packages/ui` — the NeonBlade-derived header (logo lockup, nav, a single primary CTA) and the footer (links, legal, social). They are shared components, not re-implemented per page. Daylit default; one dark section for the hatch.

| # | Page | Route | Purpose and must-haves |
|---|---|---|---|
| W01 | Home | `/` | Hero is a two-column `<section>`: **left** — `<h1>` with the slogan "EVERY BLOCK HAS A LEGEND.", one supporting line from canon, primary CTA (App Store / Play / waitlist) and the three starter names as a quiet `<ul>`; **right** — a live `three/webgpu` canvas rendering the **H-Lynk device in 3D**. Phase 1 ships a **placeholder box** at the device's true proportions (slim 3:4 screen, antenna nub, side buttons as simple extrusions, Knicks-blue matte, orange emissive LED) in a `<figure aria-label="H-Lynk device">` with a static capture as `<noscript>`/reduced-motion fallback; the real device model drops into the same `DeviceStage` component later with no layout change. Slow idle rotation, pointer-follow tilt ≤ 8°, paused offscreen. Below the hero: three starters section (W02 cards), "How care works" (three meters, three verbs), hatch moment as the one dark band. Core Web Vitals green on mobile; hero canvas lazy-mounted after LCP. |
| W02 | The Mons | `/mons` + `/mons/[slug]` | Three starter pages from the same `content/` the app uses (single source). Species, line, culture note, what they eat, idle video loop captured from runtime. No stats tables (no combat yet). |
| W03 | The City | `/city` | The setting without spoilers: boroughs, Hood Mons ("Hood means free-living, not hostile"), Callers, the H-Lynk. Lifted from the Bible's public-safe sections only; spoiler sections never ship. |
| W04 | How it works | `/how-it-works` | Meet → name → incubate → hatch → care. Honest about Phase 1 scope. |
| W05 | Waitlist / Download | `/get` | Store badges when live; email capture before. |
| W06 | Privacy / Terms / Children's privacy | `/legal/*` | Real documents, children's-privacy section explicit. |
| W07 | 404 | — | A Hood Mon that isn't where you expected. Light touch. |

Web hero canvas: `apps/web/components/DeviceStage.tsx` — one lightweight `three/webgpu` scene (WebGL2 fallback), the H-Lynk placeholder box now and the real model later behind the same prop (`model: 'placeholder' | 'h-lynk-entry'`), LOD-capped, paused offscreen, `prefers-reduced-motion` → static capture. Dimensions come from the Bible's device spec (§2.4) so the placeholder is already the right silhouette. Everything else on the site is captured media from the runtime.

---

## 6. Per-screen pipeline — skills, order, and the artifact each must produce

Run this for **every** screen in §4 and §5. No screen is implemented until its `08-handoff.md` exists. Skills are named explicitly; each produces the file listed. Mobbin is consulted per screen and every reference is cited by its `mobbin.com/screens/...` URL in the brief — references inform hierarchy and flow, never pixels.

| Step | Skill | Input | Output (under `docs/design/screens/<M##|W##>/`) |
|---|---|---|---|
| 1 | `user-research` | Bible, personas (teen Caller, parent, returning lapsed player), the screen's job | `01-research.md` — jobs, risks, 3 usability questions |
| 2 | **Mobbin MCP** (`search_screens`, `search_flows`) | 2–4 queries per screen, iOS + web where relevant | `02-references.md` — each ref as URL + one line on what to take and what to reject |
| 3 | `frontend-design` | tokens from `packages/theme`, references, H-Lynk fiction | `03-direction.md` — layout, type, the one move, the no-list |
| 4 | `design-system` | direction | `04-components.md` — which `packages/ui` components, new variants needed, token diffs (PR to `packages/theme` if any) |
| 5 | `ux-copy` | canon, Caller/Callah rules, age | `05-copy.md` — every string, every state, with `voice: "ui" | "character"` |
| 6 | `design-critique` | 03–05 | `06-critique.md` — scored against §0C; blockers must clear before 7 |
| 7 | `accessibility-review` | 03–05 | `07-a11y.md` — contrast table, focus order, VoiceOver/TalkBack labels, reduced-motion map, Dynamic Type check |
| 8 | `design-handoff` | all above | `08-handoff.md` — the implementation contract: layout spec, tokens, states, motion, empty/error, test IDs |
| 9 | implementation (platform / render / native subagents) | `08-handoff.md` | code + Storybook/fixture + capture baseline |
| 10 | `code-review` | the PR | `09-code-review.md` — must be a different agent than the author |
| 11 | device verification | build on iPhone SE 3, iPhone 16 Pro Max, Pixel 8; Chrome/Safari mobile for web | `10-verification.md` — screenshots, fps, VoiceOver pass |

For any native code (Nitro module, WebGPU surface tuning, notification category, haptic patterns beyond `expo-haptics`), the implementing subagent loads a **Margelo react-native-skill** from https://github.com/margelo/react-native-skills/tree/main/skills (`build-nitro-modules`, `swift`, `kotlin`, `cpp`, `api-design` as applicable) and cites which one in the PR.

---

## 7. Subagent orchestration

The lead agent plans, dispatches, and integrates. Specialist work never happens inline. Every subagent prompt begins with `prompts/ROSTER.md` + `prompts/LAWS.md`, names its skills, and ends by writing its artifact.

| Subagent | Skills loaded | Owns | Produces |
|---|---|---|---|
| `canon-keeper` | (Bible v11 + `docs/canon/DECISIONS.md`) | every name, stage, meter, dialogue; `TODO(canon)` triage; Dex transcription for the three starters | `content/` PRs, `docs/canon/DECISIONS.md` |
| `research-lead` | `user-research`, `research-synthesis` | personas, hallway tests, the 5-user hatch test | `01-research.md` per screen, `docs/design/research/*` |
| `design-director` | `frontend-design`, `design-system`, `design-critique`, Mobbin MCP | H-Lynk chrome, tokens, type, component variants, critique | `02`–`04`, `06`, `docs/DESIGN_SYSTEM.md` |
| `ux-writer` | `ux-copy` | copy deck, Caller/Callah voice rules, age-gate copy, notification copy | `05-copy.md`, `docs/COPY_DECK.md` |
| `a11y-auditor` | `accessibility-review` | measured contrast table (§1.3), focus, screen readers, reduced motion, Dynamic Type | `07-a11y.md`, `packages/theme/contrast.test.ts` |
| `3d-lookdev` | three.js (TSL, materials, lighting, loaders), `game-asset-production`, `game-visual-debugging` | rigs, TSL materials, idle vignettes, hatch, captures for web | asset package + provenance, capture baselines |
| `gpu-compute` | TypeGPU docs, `game-performance-optimization` | particle/VFX compute, device profiles, frame budgets | `packages/render/shaders/*`, perf report per device |
| `sim-core` | Vitest, property testing | pure-TS care/lifecycle/hatch sim, determinism, migrations | `packages/core/sim`, `docs/adr/0002-sim-core.md` |
| `platform` | Expo, expo-router, Vercel `nextjs`, `turborepo`, chosen auth/backend skills | app and web shells, routing, auth, notifications, server contract | per-PR implementation |
| `native-modules` | Margelo `build-nitro-modules`, `swift`, `kotlin`, `cpp`, `api-design` | any native gap | Nitro module + committed Nitrogen output |
| `verifier` | `code-review`, `design-handoff` (as checklist), device + browser verification | review and visual/device verification; cannot be the author | `09-code-review.md`, `10-verification.md` |

Orchestration rules:
1. `canon-keeper` opens first and transcribes the three confirmed starters (§2.2) from the v8 Dex + v11 overrides before any clip, copy, or material work names them.
2. `research-lead`, `design-director` (H-Lynk chrome + Home direction), `3d-lookdev` (rig interface + one placeholder creature), and `sim-core` start in parallel.
3. `ux-writer` and `a11y-auditor` start per screen once `03-direction.md` exists.
4. `08-handoff.md` is the gate: `platform`, `gpu-compute`, `native-modules` implement only from it.
5. `verifier` runs on every PR and is never the author.
6. Subagents return artifacts plus a short decision log; the lead resolves conflicts and records them in `docs/design/DECISIONS.md` with links.

---

## 8. Verification and acceptance

**Sim core (Vitest, headless):** determinism (same `(state, now, seed)` → same output, 10k runs); meter curves monotone between events; Baby never evolves without an `EvolutionEvent`; faint path absent; migration table from v1 → current save shape; property tests on `CareState` bounds.

**Hatch idempotency:** reconnect mid-hatch, kill the process at every phase boundary, skip at every phase, open the notification twice, hatch on device A then open device B — exactly one `MonInstance` each time. Integration test against the server contract (§1.4) with a mock and against staging.

**Content integrity (CI):** every `content/` module parses through its zod schema; every `evolvesTo`, `foodClass`, `clipId`, `vfxPreset` resolves; palette hexes present in the contrast table; no `TODO(canon)` in `main` for shipped starters.

**Contrast unit test:** `packages/theme/contrast.test.ts` fails the build on any text/UI token pair below WCAG 2.2 thresholds.

**Rendering:** 60 fps steady on iPhone SE 3 + Pixel 8 for 10 min of Home with idle vignettes; thermal step-down observed; capture baselines within tolerance across three.js minor upgrades; reduced-motion variant captured for every clip.

**Accessibility:** VoiceOver + TalkBack full pass on M01–M23; Dynamic Type XXL without clipping on M13/M14/M17; focus order documented; `prefers-reduced-motion` honoured on web.

**Web:** Lighthouse mobile ≥ 95 performance on W01 with the hero canvas; CWV green in field after launch; Awwwards developer checklist self-audit in `docs/design/web-audit.md`.

**Award-bar review:** `design-critique` scorecard for M08, M12, M13 and W01 at ≥ 8/10 on each §0C row, signed by `design-director` and `verifier`.

---

## 9. Milestones

| # | Milestone | Done when |
|---|---|---|
| 0 | Canon + foundations | `docs/REPO_MAP.md` written from the local `nyc-mon` repo (ui/html inventory, theme tokens, logo paths); Bible in repo; `DECISIONS.md` opened with decision #1 (starters); Dex records transcribed; `ROSTER.md`/`LAWS.md` committed; `packages/core` types for the full game; contrast table measured against repo tokens |
| 1 | Shells | Mobile and web shells boot; auth provider chosen (ADR); header/footer on W01; M01–M07 through the full §6 pipeline and implemented |
| 2 | Creature online | `WebGPURenderer` in RN; one placeholder rig with TSL material and idle scheduler at 60 fps on SE 3; TypeGPU motes; Skia rings bound to sim state |
| 3 | Meeting → hatch | M08–M12 implemented; hatch idempotency suite green; notification deep link verified on both OSes |
| 4 | Care loop | M13–M18; three starters' Baby clip sets from approved art; food content; journal; photo mode |
| 5 | System + polish | M19–M23; offline/sync; error recovery; haptic score per moment; reduced-motion captures; device verification matrix |
| 6 | Product site | W01–W07 live on Vercel from shared `content/`; hero `DeviceStage` with placeholder H-Lynk box; every page passes the semantic-HTML lint + axe; Lighthouse and a11y gates green |
| 7 | Award-bar pass | §8 scorecards signed; Phase-2 seams documented in ADRs (evolution, combat, Hood encounters, XR surfaces, voice lineage) |

---

## 10. References (full URLs — never strip to names)

- NYC-MON Canon & Lore Bible v11 — `docs/canon/NYC_MON_Canon_and_Lore_Bible_v11.docx` (repo)
- NeonBlade UI — https://neonbladeui.neuronrush.com/ · https://github.com/vprix21/neonblade-ui
- three.js docs — https://threejs.org/docs/ · TSL — https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language
- react-native-webgpu — https://github.com/wcandillon/react-native-webgpu · three.js examples — https://github.com/wcandillon/react-native-webgpu/tree/main/apps/example/src/ThreeJS
- TypeGPU — https://docs.swmansion.com/TypeGPU/getting-started/
- React Native Skia — https://shopify.github.io/react-native-skia/docs/getting-started/installation
- Expo — https://docs.expo.dev/ · Expo Router — https://docs.expo.dev/router/introduction/
- Nitro Modules — https://nitro.margelo.com/ · Margelo react-native-skills — https://github.com/margelo/react-native-skills/tree/main/skills
- Zustand — https://zustand.docs.pmnd.rs/ · Zod — https://zod.dev/ · MMKV — https://github.com/mrousavy/react-native-mmkv
- Next.js — https://nextjs.org/docs · Tailwind — https://tailwindcss.com/docs · Vercel — https://vercel.com/docs
- WCAG 2.2 — https://www.w3.org/TR/WCAG22/ · Apple HIG — https://developer.apple.com/design/human-interface-guidelines/
- Apple Design Awards — https://developer.apple.com/design/awards/ · Awwwards evaluation — https://www.awwwards.com/about-evaluation/ · FWA — https://thefwa.com/ · CSS Design Awards — https://www.cssdesignawards.com/ · Webby — https://www.webbyawards.com/
- COPPA guidance — https://www.ftc.gov/business-guidance/privacy-security/childrens-privacy
- Knicks brand reference — https://www.nba.com/knicks
- Mobbin — https://mobbin.com/ · Tolan Home — https://mobbin.com/screens/9e064fe9-0cf0-4809-a4d8-cd8c359b4a80 · Tolan onboarding — https://mobbin.com/flows/1b7a3a3b-82c3-4dc8-a1a0-06ad576e79ff · Tolan "Finding a Tolan" — https://mobbin.com/flows/3257e852-a719-4a80-82c8-24b68f5fb045 · Replika onboarding — https://mobbin.com/flows/19470dcc-dbd6-48ae-a945-f708e3a1b3d2 · Replika character select (anti-pattern) — https://mobbin.com/flows/b558f09a-f3ae-422d-98c6-ad93bc0f49e5
- Craft benchmarks — https://activetheory.net/ · https://lusion.co/ · https://14islands.com/
