# M12 Hatch: direction

Inputs: `01-research.md`, `02-references.md`, `screens/M11/03-direction.md`, `docs/design/hlynk/DIRECTION.md`, `packages/core/schemas/hatch.ts` (`HATCH_PRESENTATION_PHASES`), `packages/theme/tokens.ts`. Route `/(home)/hatch`. Shell: H-Lynk Core, scheme forced to night (Decision #4), trackpad `accent="hatch"` (orange rim, Decision #7).

## Position

M11 "Hatch your egg" → **M12 in progress**. M23 notification tap → **M12 pre**. Out: M09 naming when `mon.nickname === null` (Decision #5), else M13. Always by continuity, never a hard cut.

## The one move

The egg starts its own hatch. It is already sitting in the hatch scene; something inside it shifts, the shell swells, then light builds under the shell until the first crack lets it out, orange, the hatch accent. The light comes from inside the egg and nowhere else. The H-Lynk's scanner LED stays a status light. Everything else in the sequence stays quiet so the egg's movement reads.

> Superseded by Decision 29 (2026-10-21): this section described the scanner LED handing its light to the egg through a red scan line. The capture case and scanner are not part of hatching.

## Sequence (full motion)

> Superseded by Decision 29 (2026-10-21): the `case-open` (lid, hinge, handle, cradle) and `scanner` (red scan line, LED hand-off) rows were replaced by the egg-only `stir` and `pressure` rows below, at the same timings.

Times are from the start of `in progress` (the `open` event). Every phase ends with `{ type: 'advance' }`; the screen never decides state, it only asks `transitionHatch`.

| Phase (`HatchPresentationPhase`) | Starts | Length | Picture | Haptic (`react-native-pulsar` preset) |
|---|---:|---:|---|---|
| `stir` | 0 | 1000 ms | The egg, already in view, shifts from inside: two asymmetric nudges, the second stronger (≤ 3° tilt), back to rest by the phase end. No device or case moves | `System.impactLight` (`tap`) as it starts |
| `pressure` | 1000 | 800 ms | The shell swells in two growing pulses (≤ 3% scale) and light builds inside the egg, back to rest size as `crack` starts. No scan line, no red light, no LED change | `selection` as it starts |
| `crack` | 1800 | 2400 ms | `hatchProgress` 0→1. Three cracks at 0.25, 0.55, 0.85, each opening in 120 ms then holding. The holds carry the anticipation: the egg is still between cracks, then a 2° tilt toward the next crack 150 ms before it. Orange light leaks along each crack | `snap` on each crack |
| `burst` | 4200 | 500 ms | The crack light blooms outward: `orange-300` radial, peak 60% opacity at 180 ms, gone by 500 ms. Shell halves part. No white, no rays, no particles leaving the screen | `bloom` at peak |
| `emerge` | 4700 | 1800 ms | The Baby's `hatch` clip. 2D now: egg plate cross-fades to the Baby plate, Baby plate settles 1.04 → 1.00 scale with 6 pt rise | `unfurl` at 300 ms |
| `attention` | 6500 | 1500 ms (lean-in) / open (hesitate) | The first look (below) | `heartbeat` once, on the lean-in |

Total ≈ 8 s on the lean-in path. The skip control appears at 2000 ms (inside `crack`), never before.

## The first look (Decision #14)

The Baby looks at the Caller first. That look is its choice. Two authored performances, picked by a deterministic seed from `monInstanceId` so every device and every replay shows the same choice:

- **Lean in.** Ears/head up, a short forward lean toward camera, settles facing the Caller. Ends the sequence.
- **Hesitate.** The Baby looks, tucks partly behind the larger shell half, peeks again. It never turns its back, never steps away from the Caller, never makes a distress sound. The trackpad label becomes "Stay close". Holding the trackpad (the same hold the Caller learned keeping the egg warm on M11, with the same `breath` haptic) brings the Baby out: it leans in and the sequence ends with the lean-in ending. After 8 s with no input, a caption hint appears; nothing times out.

Hesitation reads as shy. Creature-animation rule for the art pass: the hesitate clip keeps the eyes on the Caller the whole time. Eyes off the Caller would turn shy into no.

The choice is a performance in Phase 1. It changes no state: bond growth is open (Q26) and `mintMonInstance` sets `bond: 0` for everyone. Proposed weights: 2 lean-in : 1 hesitate (a design default, not canon; Mike to confirm).

## States

| State | When | Screen | Trackpad | Skip |
|---|---|---|---|---|
| pre | Arrived from the notification and hatch state is `ready` | The egg, still, in the hatch scene; night scheme fades in (`motion-scheme`) | "Hatch your egg" → `open` | hidden |
| in progress | After `open` (from M11's tap, or pre's tap); also `presenting` on re-entry, resuming at the saved phase | Sequence above | hold on hesitate; otherwise inert | from 2000 ms |
| complete | Hatch state `hatched` after the sequence or a skip | Baby settled facing the Caller; `SignagePlate` with the Baby form name ("Squeaklet") and the Bloodline line under it | "Name Squeaklet" (→ M09) or "Go to {nickname}" (→ M13) | hidden |
| already-hatched | Entered with hatch state `hatched` (second notification tap, device B, stale link) | No hatch UI renders. The creature layer is already up; continuity runs straight to M09/M13 and one polite line is announced | — | — |
| early | Entered with hatch state `incubating` (clock skew, a test link) | `router.replace('/(home)')`: M11 counting, no error | — | — |

Resume rule: a `presenting` hatch replays from the **start of its saved phase**, not from `stir`. A save from before Decision 29 that stopped at `case-open` or `scanner` resumes at the start of `stir` or `pressure` (save v3 migration). The Caller sees the part they missed, not the whole show again.

Skip always lands on the settled pose of the lean-in ending, because the first look is a performance and skipping is the Caller's choice not to watch it. Skip calls `{ type: 'skip' }`; the end state is identical to finishing (`transitionHatch` carries the same Mon).

## Continuity into M09 / M13 (never a hard cut)

The creature layer (the render canvas now; the 2D plate until models arrive) and the `HLynkShell` live in `/(home)/_layout.tsx`, above the route. M12's route content is only the egg, the plate, skip and the CTA. Leaving M12 swaps route content while the Baby stays drawn in the same place.

| Beat | Start | Length | Full | Reduced |
|---|---:|---:|---|---|
| Hatch UI out (plate, CTA) | 0 | 200 ms | fade | fade |
| Scheme night → clock scheme | 0 | 500 ms | `motion-scheme` | instant |
| Trackpad rim `hatch` → `ring` | 0 | 500 ms | colour tween | instant |
| LED `ready` → M13's state (`off` or `needsYou`) | 0 | 240 ms | ramp | instant |
| Framing: hatch close-up → M13 framing | 0 | 700 ms | 3D: camera dolly back, emphasized easing. 2D: plate scale 1.06 → 1.00 and recentre | instant |
| M13 rings and control bar in | 400 | 300 ms | `motion-enter` | fade 200 ms |
| M09 field and plate in (if naming) | 400 | 300 ms | `motion-enter` | fade 200 ms |

Requirement on other lanes: M09 must live under `/(home)` (e.g. `/(home)/name`), not `/(onboarding)/name` as the brief's table lists it, or the Baby is unmounted between M12 and M09.

## Reduced motion (authored, §3.6)

| Phase | Reduced |
|---|---|
| `stir` | egg holds still, no wobble; 300 ms |
| `pressure` | one fuller still of the egg (1.02 scale) held 400 ms; no pulse |
| `crack` | three static crack frames swapped by 150 ms cross-fades at the same beats; crack light shown, not grown |
| `burst` | absent; a 300 ms cross-fade from the cracked egg to the parted shell |
| `emerge` | 400 ms cross-fade egg → Baby, no scale |
| `attention` | static lean-in pose; hesitate: static peek pose, then a 300 ms cross-fade to lean-in on hold |

Reduced total ≈ 4 s. Haptics are unchanged by reduced motion (they follow the haptics setting, M19).

## Light and flash budget

The burst is one rise and fall of `orange-300` at ≤ 60% opacity (≤ 40% in the Quest 2D window, where the panel fills more of the visual field). No full-screen white, no second flash, no strobe on the cracks. `maxFlashesPerSecond` for the sequence is 1.

## The no-list

- No confetti, no rays, no stars, no particles leaving the screen.
- No struggle, no goo, no sound or pose of distress (soft side of Q30).
- No turned back, step away or "no" in the hesitate performance.
- No Mon name before M09; the plate shows the Baby form name only (Decision #6).
- No pronoun for the Mon (PS-005).
- No speech or baby-talk from the Baby (Q32 open); species sounds only, when audio lands.
- No `evolve` intent and no evolution language (Law 7).
- No network spinner during the show. The server confirmation is never awaited.
- No auto-advance from complete to Home: the Caller leaves when ready.
