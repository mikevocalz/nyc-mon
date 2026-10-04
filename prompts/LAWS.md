# Laws

Verbatim from `prompts/BUILD_PROMPT_v3.md` §0B (Laws) and §0A.2 (standing standards), followed by the repo laws. Every agent prompt includes this file after `prompts/ROSTER.md`. A violation of any law here blocks merge.

## Laws (§0B)

1. **No invented canon.** Every creature name, species label, culture note, stage, meter, device, or line of dialogue traces to the v11 Bible or to an explicit creator decision recorded in `docs/canon/DECISIONS.md` with date. Unknown → `TODO(canon)` + issue, never a guess.
2. **No invented APIs.** Every seam — `three` / `three/webgpu` / `three/tsl`, `react-native-webgpu`, `typegpu` + `@typegpu/*`, `@shopify/react-native-skia`, `zustand`, `zod`, `react-native-mmkv`, `expo-notifications`, `expo-haptics`, `expo-router`, `next` — is verified against installed source before use.
3. **The sim core is pure TypeScript.** `packages/core/sim` imports nothing from `react`, `three`, `expo-*`, or the DOM. Deterministic given `(state, now, seed)`. Runs headless in Vitest.
4. **No `useState` for business state.** Care, lifecycle, hatch, and bond live in the sim core and are mirrored into sliced Zustand stores.
5. **Zod at every boundary.** Save file, migrations, `content/` (Mon data), server payloads, notification payloads — schema-parsed, never trusted.
6. **Hatch is atomic.** One `monInstanceId` per egg, minted server-side (or by a server-replayable deterministic function when offline), idempotent on reconnect, skip-animation, process death, and device handoff. A duplicated individual is a P0 bug (Bible: "A device session is a surface, not a new creature").
7. **Baby stays Baby.** No evolution fires without an authored `EvolutionEvent` in `content/`. Phase 1 ships Egg → Baby only; Baby → Small is a stubbed, feature-flagged path with its content schema present.
8. **Faint is never death.** No code path converts a Mon to an egg or deletes an instance on 0 HP. Phase 1 has no HP combat, but the `CareState` type and the copy deck already encode this.
9. **Language is canon.** `Caller` in code, data, and UI. `Callah` only inside Mon dialogue strings flagged `voice: "character"`. `Hood Mon`, never `wild`. `H-Lynk`, never "device" in UI copy. `Bloodline` for a Dex family in UI and data, never "family" or "line" (Decision #11).
10. **Palette ships only with a measured contrast table** (§1.3). A token without a WCAG 2.2 measurement does not exist.

## Standing standards (§0A.2, apply in every PR)

- **TypeScript strict.** No `any`, no `as unknown as`, no `// @ts-ignore`. Exhaustive `switch` on every discriminated union (`LifecycleStage`, `CareNeed`, `HatchState`).
- **Verify before writing.** Every third-party seam is read in `node_modules` (types + source) before a line of code targets it. Record what you read in the PR body.
- **Skills and subagents are mandatory** (§6). The lead plans, dispatches, integrates. It does not do specialist work inline.
- **References carry URLs.** Every doc, ADR, and PR cites sources as full links, never as names alone.
- **Reduced motion is a first-class variant**, not a fallback. Every animation has a reduced-motion sibling authored, not derived.
- **Semantic HTML only on web, from `/ui/html`.** Every web page is built from the semantic primitives in `packages/ui/html` (`<header>`, `<nav>`, `<main>`, `<section aria-labelledby>`, `<article>`, `<figure>`/`<figcaption>`, `<footer>`, one `<h1>` per page, heading levels never skipped). No `<div>` soup, no `<div onClick>` buttons, no landmark emulated with ARIA that a native element provides. Lint: `eslint-plugin-jsx-a11y` strict + an axe pass in CI.
- **Logos come from the repo.** NYC-MON wordmark, H-Lynk mark, and any partner/store badges are the files already in the monorepo (`packages/theme/assets/logos/*` or wherever the repo keeps them — read the repo, do not ask). Agents never regenerate, redraw, trace, or "clean up" a logo. SVG as-is; raster only where the source is raster.
- **Never ship placeholder content.** No "Lorem", no "Mon Name Here", no `#FF00FF` debug material in `main`.

## Repo laws (nyc-mon)

R1. **No git worktrees or extra checkouts; all work happens in the nyc-mon folder.** Several agents share `/Users/mikevocalz/nyc-mon` on `main`. Each one commits only its own files with explicit pathspecs (`git commit -- <paths>`), never `git add -A`.

R2. **Package scope stays `@acme/*`.** New packages (`packages/core`, `packages/content`, `packages/render`, `packages/auth`) are `@acme/core`, `@acme/content`, `@acme/render`, `@acme/auth`.

R3. **Every screen and page is built from our NYC-Tron UI kit (`@acme/ui`, `packages/ui`) components.** A new visual pattern becomes a kit component or variant with a story first, then gets used; no one-off styled Views/divs in apps. The kit inventory is `docs/REPO_MAP.md` §5.

R4. **Every task runs with its named skills loaded, through subagents, and passes the §6 handoff gate (`08-handoff.md`) before implementation.**

- **R5. API design uses Margelo's `api-design` skill** (https://github.com/margelo/react-native-skills/tree/main/skills/api-design) for every public surface: `@acme/*` exports, hooks, options objects, events, errors, and the `/v1` server contract.
- **R6. Payload work uses the `payload` skill** (https://github.com/payloadcms/skills), checked against the installed Payload 4 canary source (Law 2).
