# M32 Mon Space: handoff

Implementation contract for lanes (b)–(f). Inputs: `01`–`07` here, canon Decisions #33–#37, design D20, the lead's contract (2026-10-29). Data comes from `@acme/core/sim` only; this file names no new API.

## Blockers before implementation

| # | Blocker | Owner | Blocks |
|---|---|---|---|
| B1 | `stepMonCare`, `applyMonCareAction`, `selectMonCareView`, `heartsFor`, save v4 | lane (b) | everything |
| B2 | `MemoryLcd` + `LcdLayerSpec` with stories; LCD tokens with `contrast.ts` rows | lane (d) | the LCD |
| B3 | `playCareCue` | lane (f) | sound (screen ships silent without it) |
| B4 | Route file and store wiring (`applyMonCare`, `tickMonCare`) | lane (c) | screen |
| B5 | Widget target and notification scheduling | lane (e) | keychain, Mon calls |

Not blocked on: canon numbers. Every rate is `TODO(canon)` tuning (Decisions #34–#36).

## Route and intent

Native `/(home)/mon-space`, active Mon (final path is lane (c)'s); web `/mon-space` (Decision #23). Shell: none. Entry: Home hub, the H-Lynk, M13, a widget tap, a Mon call notification. A notification or widget tap opens with focus on the open call's icon.

| Priority | Intent |
|---|---|
| P1 | In two seconds, show whether the Mon is calling and for what |
| P2 | Answer with one B press (or one tap) |
| P3 | Keep the Mon present: idle vignettes, step out and in |
| P4 | Never imply loss, blame or death |

## States

| State | Condition (`MonCareView`) | Lamp | Status line |
|---|---|---|---|
| content | `attention: 'none'`, awake | off | `monspace.status.content` |
| call | `attention: 'call'` | `call` | `monspace.call.<kind>` |
| false call | `attention: 'false-call'` | `false-call` | `monspace.call.false_call` |
| asleep, lights off | `asleep && lights === 'off'` | off unless a call | `monspace.status.lights_out`; LCD inverted |
| bedtime, lights on | call kind `bedtime` | `call` | `monspace.call.bedtime` |
| cold | `cold !== null` | per call | `monspace.status.cold` + doses |
| paused | `paused` | off | `monspace.status.paused`; all icons but Pause disabled |
| evolve ready | `evolution-ready` event | off | `monspace.evolve.ready` |
| loading | save not read | off | `monspace.loading` |
| no Mon | no active Mon | off | `monspace.empty.*` with a route to Home |
| error | save unreadable | — | M22 recovery |
| offline | queue pending | unchanged | M21 banner; care still works locally |

## Outcomes to copy

| `MonCareOutcome` | Line |
|---|---|
| fed (meal) / snack | `monspace.result.meal` / `monspace.result.snack` |
| played | M16 result, then `monspace.result.play` |
| `cleaned` | `monspace.result.clean` |
| `dosed` | `monspace.result.dose.one` / `.many` |
| `cured` | `monspace.result.cured` |
| `disciplined` | `monspace.result.boundary` |
| `nothing-to-discipline` | `monspace.decline.no_false_call` |
| `lights` | `monspace.result.lights_off` / `.lights_on` |
| `paused` / `resumed` | `monspace.result.paused` / `.resumed` |
| declined `paused` | `monspace.decline.paused` |
| declined `has-cold` | `monspace.decline.cold` |
| declined `no-cold` | `monspace.decline.no_cold` |
| Clean with no piles | `monspace.decline.nothing_to_clean` |

## test IDs

`m32-lcd`, `m32-lamp`, `m32-status`, `m32-hearts-fullness`, `m32-hearts-energy`, `m32-hearts-social`, `m32-menu-meal`, `m32-menu-snack`, `m32-menu-play`, `m32-menu-lights`, `m32-menu-clean`, `m32-menu-medicine`, `m32-menu-boundary`, `m32-menu-status`, `m32-menu-pause`, `m32-key-a`, `m32-key-b`, `m32-key-c`, `m32-back`, `m32-pause-confirm`, `m32-notify-ask`.

## Gate

Ready for implementation when B1–B2 have stories and this folder's copy is in `docs/COPY_DECK.md` (done in this PR). Acceptance: every row of `07-a11y.md` verified with VoiceOver, sound off and Reduce Motion on an iPad and an iPhone; lamp rhythm passes `maxFlashesPerSecond <= 3`; no banned word in any bound string.
