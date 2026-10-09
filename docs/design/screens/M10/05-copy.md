# M10 Incubation choice: copy

Owner: `ux-writer`. Inputs: `01-research.md`, `03-direction.md`, `04-components.md`; `V11 ¶49`; canon #5, #8; P2; Q4, Q27; `docs/COPY_DECK.md` ("No pressure", "Promise only what ships").

All strings are `voice: "ui"`. No character speaks on M10.

Tokens: `{eggName}` from `eggs` (`@acme/content`) for the route's `bloodline`; `{time}` is the device-locale clock time of `now + minutes` (e.g. "4:45 PM", "16:45"), no date unless it crosses midnight, then `{time} tomorrow` via `m10.ready.tomorrow`.

## Strings

| ID | String | Voice | Max | Notes | Canon / source |
|---|---|---|---|---|---|
| `m10.title` | How long should the egg incubate? | ui | 48 | `Heading level={1}`, two lines on SE | `V11 ¶49` |
| `m10.body` | The time you pick doesn't change your Mon. Pick the wait that fits your day. | ui | 90 | The honest line the brief asks for | Brief §4.2 M10; Phase 1 code (`mintMonInstance`); Q27 open, see note |
| `m10.option.15` | 15 min | ui | 7 | Ring stop label | `V11 ¶49` |
| `m10.option.30` | 30 min | ui | 7 | | `V11 ¶49` |
| `m10.option.60` | 1 hour | ui | 7 | | `V11 ¶49` |
| `m10.option.15.a11y` | 15 minutes | ui | — | Radio label | |
| `m10.option.30.a11y` | 30 minutes | ui | — | | |
| `m10.option.60.a11y` | 1 hour | ui | — | | |
| `m10.ring.a11y.label` | Incubation time | ui | — | Radio group name | |
| `m10.ready` | Ready at {time} | ui | 24 | Shown once a stop is chosen; refreshed each minute | |
| `m10.ready.tomorrow` | Ready at {time} tomorrow | ui | 30 | When `now + minutes` crosses local midnight | |
| `m10.egg.a11y.label` | The {eggName} | ui | — | Egg image inside the ring | Decision #9 |
| `m10.cta.start` | Start incubating | ui | 24 | `cta`, disabled until a stop is chosen | |
| `m10.cta.start.a11y.hint.disabled` | Pick a time first | ui | — | | |
| `m10.cta.starting.a11y` | Starting | ui | — | `loading` state label | |
| `m10.trackpad.label` | {option}, incubation time | ui | — | e.g. "30 minutes, incubation time"; before a choice: `m10.ring.a11y.label` | |
| `m10.trackpad.hint` | Flick to change the time. Tap to start. | ui | — | | DIRECTION.md "Controls" |
| `m10.action.prev` | Shorter | ui | 10 | `TrackpadActions` `stepBackLabel` | |
| `m10.action.next` | Longer | ui | 10 | `stepForwardLabel` | |
| `m10.case.a11y.closed` | The {eggName} is in the case. | ui | — | Image label once closed | `V11 ¶65` ("case", never "capture", Q4) |
| `m10.confirmed.a11y.announce` | Incubating. Ready at {time}. | ui | — | Polite, after the case closes | |
| `m10.led.chip` | Incubating, {minutes} minutes left | ui | 32 | The `hlynk.led.incubating` refinement DIRECTION.md specifies; `{minutes}` rounds up | DIRECTION.md LED table |
| `m10.led.chip.hour` | Incubating, 1 hour left | ui | 32 | When 60 minutes remain | |
| `m10.error.title` | The egg didn't go into the case. | ui | 40 | Save write threw | |
| `m10.error.body` | Nothing was saved. Try again. If it keeps happening, restart NYC-MON. | ui | 90 | | |
| `m10.error.retry` | Try again | ui | 20 | | |
| `m10.back.a11y.label` | Back | ui | — | Back key before confirm → M08 with the egg still focused | |

Shared, used as written: `hlynk.led.incubating`, `hlynk.led.a11y`, `hlynk.key.*.label`, `m05.badge.pending`, and every `m06.*` string (the sheet, P2). `m06.body.15/.30/.60` already key off the minutes chosen here.

## Note on `m10.body` and Q27

The line describes what Phase 1 does: `mintMonInstance` uses `incubationMinutes` only to set `incubationEndsAt` and `hatchedAt`. Canon has not said whether length matters (Q27). If Mike rules that it does, this string is rewritten to say exactly how, and nothing else on the screen changes. It must never be softened into "it doesn't matter much".

## Never on M10

"Hurry", "only", "best", "recommended", "speed up", "skip the wait", "capture", "device", any price, any mention of ads.

## Reduced motion

No copy changes.

## Localisation notes

- `{time}` uses the device locale and 12/24-hour setting; never hard-code "PM".
- "min" is an abbreviation; locales without a short form use the long form and the ring label wraps under the arc.

## Open questions

1. **Q27.** Does incubation length change anything about the Mon? Drives `m10.body`.
2. **Q4.** Is the case the incubation cradle in canon? The screen assumes yes (brief §2.4, M10) and never says "capture".
