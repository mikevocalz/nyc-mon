# PixiJS 3D evaluation — Phase 5 (PR 5)

Status: evaluation only. No runtime change, no commit, no dependency added —
`pixi.js`/`@pixi/*`/`pixi3d` appear nowhere in `package.json`,
`pnpm-workspace.yaml` or `pnpm-lock.yaml` (verified by grep, matching audit
§1's "no `pixi`/`@pixi/*` installed anywhere"). The only network writes were
read-only npm registry GETs and one throwaway `/tmp` install (since removed).
No device was attached; nothing below is a device measurement.

Skills consulted: `skills/pixijs-skills/` (26 skills, upstream commit
`83760c6`, MIT — covers **PixiJS v8 2D only**; its own `PerspectiveMesh`
reference punts real 3D: *"There is no Z axis, no depth buffer, and no
camera. For real 3D, use a full WebGL/WebGPU library on top of PixiJS"* —
`pixijs-scene-mesh/references/mesh-perspective.md:134-136`), `skills/renderer-bench/`
(**absent** — not in the `skills/` registry), repo `AGENTS.md`, plus the
prior gate doc `docs/performance/pixijs3d-vs-three-2026-10-16.md` and the
audit (`docs/performance/engine-audit-2026-10-31.md` §5-§7).

## Verdict up front

**Can't evaluate without (a) public/authorized access to PixiJS 3D and
(b) an attached physical device.** The evaluation subject — the official
"PixiJS 3D" — is a **closed-beta product with no public npm package, no
published API, and no public license terms**. Nothing that can be installed
today is the thing the directive asks about. Separately, even a valid
three-side `physical-device` capture cannot be produced in this environment:
`adb devices` is empty and the iPhone is unreachable (audit §7). Two valid
captures are the comparator's minimum input; today we can produce zero.

Until the unblockers in §4 land, Three.js WebGPU + TypeGPU stays the
production renderer — the same disposition the Oct-16 gate doc and the
audit do-not-revive list already carry.

## 1. PixiJS 3D status — what is actually obtainable

| Item | Status today | Evidence |
|---|---|---|
| Official "PixiJS 3D" | **Closed beta, signup-gated** | `pixijs.com/3d` shows "Sign up for the closed beta"; official @PixiJS account (Oct 6, 2026): *"Still in closed beta for now!"* — claims ~6x WebGPU perf gains "since the beta launch" against a beta-internal benchmark tool ("benchy"), i.e. marketing numbers with no reproducible public artifact. |
| npm package for official PixiJS 3D | **Does not exist** | Registry GETs: `@pixi/3d` → `Not Found`, `pixi.js-3d` → `Not Found`, `@pixi3d/dev` → `Not Found`. npm search "pixijs 3d" surfaces only unrelated/community packages. |
| `pixi.js` (public) | 8.22.0, MIT | Latest release, verified via registry metadata. **2D renderer only** — see §5 smoke: no Camera/Light/Model exports; only 3D-*texture* helpers (`Gpu3dMipmapGenerator`, `assertMipmap3dTexture`). |
| `pixi3d` (jnsmalm) | 2.5.0, MIT | **A different, community project** — "3D renderer for PixiJS" compatible with PixiJS **v5/v6/v7**, last published **2023-12-17** (registry `time`). Predates v8's rewritten systems-and-pipes renderer; `@eva/pixi3d` 2.1.0-beta.17 and `@xysspon/pixi3d` 2.5.1 are third-party v8 forks. Not the evaluation subject and not maintained as such. |
| Vendored skill pack | v8 2D only | 26 skills: application, scene graph, sprites/graphics/text/mesh, filters, particles, assets, events, math, ticker, performance, environments, v7→v8 migration. **Zero coverage of any 3D renderer** — no scene 3D, no camera, no lighting, no glTF skill. The snapshot (copied 2026-10-16) captured exactly what was public then: the 2D renderer's docs. |
| License | `pixi.js` MIT; **beta terms unknown publicly** | `pixi.js` registry metadata: MIT. The 3D beta's license/distribution/commercial terms are behind the signup — the directive's "license/access approval" gate cannot even be read today. |
| Native (RN/Dawn) support | **Undocumented** | The vendored pack's environments skill covers Web Workers (`OffscreenCanvas`, `WebWorkerAdapter`) and Node/SSR via a user-implemented `DOMAdapter` — nothing about React Native, Hermes, or Dawn. Any RN claim is a separate feasibility gate (gate doc line 24). |

**What access the evaluation needs:** an invite into the closed beta (or the
public release whenever it ships), including the SDK package, API docs,
license terms, and enough of a material/scene/lighting API to port our
scene. None of that is public today — and per the task's guardrail this
report does **not** require or request beta access; the finding stands on
public artifacts.

## 2. What a fair comparison requires

### 2a. The comparator's contract (`tooling/renderer-bench/compare.ts`)

`compareCaptures` refuses to rank unless **all** of the following match
across the two `RendererCapture` JSONs (lines 69-76, 38-51):

- `backend` — `webgpu` vs `webgpu` only (or webgl2 vs webgl2); never mixed.
- `deviceClass`, `gpuModel` — same physical device and GPU.
- `sceneId`, `cameraPathId`, `buildId` — same scene, same scripted route.
- `datasetDigest` — shared canonical OSM tile geometry + content hash,
  *not* engine-specific bytes.
- `widthPx`/`heightPx`/`devicePixelRatio` — identical viewport and DPR.
- `triangles` — **must match exactly**; a Pixi port that drops geometry
  throws `Not comparable`.
- `qualitySignature` — lights/shadows/post must match ("no missing
  shadows/particles", gate doc line 25).
- `frameIntervalsMs` **and** `cpuSubmitMs` — each ≥120 samples, ≤200 000,
  every value finite, 0 < x < 2000 ms, equal-length series (lines 34-37,
  48-49).
- `capturedFrom` — **both must be `physical-device`**; `synthetic-test`
  throws "No production renderer recommendation from synthetic samples"
  (line 75-76).
- The gate doc adds on top: SHA-256'd assets, GPU timestamps + memory where
  supported, retained color/depth/normal/object-ID screenshots with
  matching camera poses plus **human visual-similarity review**, three
  device tiers, and native as a separate gate
  (`pixijs3d-vs-three-2026-10-16.md` lines 19-25).

Grounded workload (gate doc lines 19-22): PR #46's baked Harlem v2
Apollo/125th St district — 3,761 buildings, 2,414 mapped ways, 172 areas +
street props; same saved coordinates and camera path; frozen daypart,
weather, vehicle/NPC state, gameplay tick, collision and texture inventory.
On our side that scene today is ~283 553 triangles at spawn / ~152-164
draws stream-off (`baseline-duo-2026-10-17.md`, audit §6).

### 2b. What a real PixiJS-vs-Three capture would need us to build

| Requirement | Today | Blocked on |
|---|---|---|
| PixiJS 3D SDK + docs | **Nothing installable is the subject** | Closed beta / public release |
| Identical geometry on both engines | VDN cell bytes + `harlem-apollo` datasets exist, engine-agnostic | A Pixi-side loader/importer for the same bytes → same `triangles` count + same `datasetDigest` |
| Identical materials/look | Ours is TypeGPU→TSL cel (`cel/cel-shading.ts`) + Slop `physical/*` lanes — no Pixi equivalent authored | Re-authoring cel + physical looks in PixiJS 3D's material API (which is undocumented until beta) |
| Identical lighting + post | Sun rig, shadow map, physical chain SSR→exposure→bloom→grade→ACES | Whatever PixiJS 3D's post/lighting surface turns out to be; `qualitySignature` must match |
| Identical camera path | Scripted 125th St walk exists (`cell-stream.walk.test`) | Port the same path ticks to the Pixi scene |
| Same physical device, `physical-device` provenance | **None attached** — `adb devices` empty; iPhone 17 unreachable; iOS unmeasured entirely (audit §7) | Duo re-attached, or another physical tier from the matrix |
| Presented-frame intervals ≥120 | Our host runs produce scene-build/budget numbers and *recording-device* frames — `synthetic-test` at best | The device, on both engines |
| Visual equivalence evidence | `renderer.info`-style captures on the three side exist | Pixi-side color/depth/normal/object-ID retention + human review |
| Native lane | three runs under rn-webgpu/Dawn | Proof PixiJS 3D can even execute under Dawn/rn-webgpu — unverifiable pre-release |

The comparator itself is ready — it has simply never seen a real capture
(audit §6). `compare-cli.mjs` runs today; `compare.test.ts` (6 tests) proves
the guards fire. What is missing is everything upstream of it.

## 3. Candidate use-cases — could PixiJS matter outside 3D?

What already draws 2D in this tree (verified by manifest/grep):

- **Skia** — `react-native-skia` 3.8.1 native + `canvaskit-wasm` 0.41.1 web:
  charts (`DonutCanvas`/`BarCanvas`/`LinePlot` `.skia` variants), care meter
  ring, hatch/incubation rings, hlynk `ScannerFan`, backgrounds
  (`skia-vertices`), splash. Under `WORLD_PHYSICAL` Skia's Graphite device
  is imported so Skia, three and TypeGPU share **one** Dawn device
  (`gpu/gpu-store.ts`, ADR 0026) — a Pixi canvas cannot join that device;
  it would be a second GL context competing for the same phone.
- **Rive** — `@rive-app/react-native` + `@rive-app/react-webgl2`: lobby
  surfaces, leaderboard, neon switch, beam/notch frames, game transitions.
  Measured at **0.031 ms/frame** — exonerated (audit §5). Not a bottleneck.
- **TypeGPU-direct canvas** — `gpu/GpuCanvas.tsx` for GPU-surface UI.
- **DOM/RN views + uniwind** — everything else on web and native.

Honest scoping: a `pixi.js` v8 2D layer could plausibly complement as a
**web-only HUD/effects canvas** — the gate doc already leaves that door
open ("optional 2D effect/HUD layer where it earns its extra canvas and
memory cost", line 29). But the need is unmeasured: UI-stage cost is
RenderThread buffer backpressure, not 2D paint (audit §5), and the 2D
slots are filled by libraries already sharing or near the device. On
native, PixiJS v8 has no RN adapter — a `DOMAdapter` implementation must
supply canvas, Image, fetch and XML parsing (`pixijs-environments`), which
is a porting project to reach parity with what Skia already does. Running
two 3D renderers on a phone is explicitly ruled out by the gate doc.

The directive's interest — "whether PixiJS 3D's renderer can replace or
complement Three.js" — is a **3D question**, and the 3D subject is not
publicly available. The 2D-complement option survives only as an open
note, not a recommendation.

## 4. Go/No-Go verdict

| Question | Verdict |
|---|---|
| Can PixiJS 3D replace Three.js? | **Cannot evaluate** — no public SDK, no API docs, no license terms, no capture input possible. |
| Can PixiJS complement for X? | Only *plausibly* as a web 2D HUD/effects layer on the public `pixi.js` v8 — unmeasured need, third context cost, no RN story. Not recommended on current evidence. |
| Can we measure anything valid today? | **No.** Zero `physical-device` captures possible on either engine in this environment; the Pixi side cannot produce a capture at all. |

**Exactly what unblocks a real measurement, in order:**

1. **Public release or authorized beta invite** for PixiJS 3D — SDK
   package, API documentation, license/commercial terms. (The directive's
   license/access-approval gate is itself unreadable until this lands.)
2. **A physical device attached** — Duo re-attached or any reachable tier
   from `hardware-matrix.md`. Needed for *both* engines, not just Pixi.
3. **The Pixi-side scene port** — same Harlem-v2 dataset digest, identical
   triangle count, cel + physical material equivalents, sun/shadow rig,
   post chain matching `qualitySignature`, same camera path, same
   viewport/DPR. This is a porting project scoped by an API we cannot read
   today.
4. **Capture plumbing on the Pixi side** — presented-frame timestamps,
   CPU-submit series, draw/tri counters, and retained
   color/depth/normal/object-ID buffers for the visual review.
5. **Native feasibility proof** — PixiJS 3D under Dawn/rn-webgpu (or a
   documented Expo path) as a *separate* gate before any native claim;
   a browser pass certifies nothing about the phone.
6. Then, and only then, `compare-cli.mjs` on two `physical-device` JSONs,
   plus human visual-similarity review, before any integration is even
   proposed.

No fabricated data appears in this report: the only numbers cited are
registry metadata dates/versions, audit-recorded baselines, and the Oct-6
vendor tweet quoted as vendor claim.

## 5. Minimal proof attempt — run and documented

A throwaway `/tmp` install (since removed — no tree changes) verified the
edge of what exists:

```text
pnpm add pixi.js@8.22.0        # 11 packages, pure JS, installs clean
import('pixi.js')              # imports under node 24 — Application, Container present
new Application(); app.init()  # throws "document is not defined" — needs DOMAdapter
3D-ish exports                 # Gpu3dMipmapGenerator, assertMipmap3dTexture — 3D *textures*, no renderer
```

Conclusions:

- **The evaluation subject cannot be smoke-tested at all** — there is no
  package for it. `pixi.js` 8.22.0 contains no 3D scene/camera/lighting
  surface.
- Even a **2D** smoke in bare Node is not minimal: `app.init` needs a
  complete `DOMAdapter` implementation (canvas creation, Image loading,
  fetch, XML parsing per `pixijs-environments`), i.e. a headless-canvas
  dependency or a hand-rolled adapter — exactly the class of "new risky
  deps" the task rules out.
- Installing `pixi3d` was deliberately skipped: it would pull a
  Pixi-v5/7-era community renderer, and a passing smoke of *that* would be
  misleading evidence about the official product.

## Honest-pending list

- Whether the official beta's API surface (scene, materials, post, native
  story) can even express our cel/physical looks and post chain.
- Whether a beta/public PixiJS 3D would run under Dawn/rn-webgpu — no
  adapter is documented anywhere public.
- The beta license and redistribution terms.
- All performance numbers — none exist; the vendor's "~6x/~30x" beta
  improvements are self-reported against their own benchmark tool.
- Whether the 2D-complement slot is worth anything: needs a measured
  2D-paint bottleneck first, and none is on record.

## Per-path verdicts

| Path | Verdict |
|---|---|
| Replace three as the city renderer | **NO-GO / cannot evaluate** — subject not publicly obtainable; zero valid captures possible. |
| Complement — 3D side-by-side | **NO-GO** — gate doc already rules out two 3D renderers on a phone; and there is no 3D renderer to run. |
| Complement — web 2D HUD/effects (`pixi.js` v8) | **OPEN NOTE, not a recommendation** — public MIT package exists; no measured need; extra canvas/context cost on a shared-device architecture; no native adapter. |
| Complement — native 2D | **NO-GO** — Skia fills the slot and shares the Dawn device; Pixi would need a full `DOMAdapter` port for Hermes. |
| renderer-bench readiness | **Ready but starved** — validator + CLI + guard tests exist; first real feed requires unblockers §4.1-§4.5. |
