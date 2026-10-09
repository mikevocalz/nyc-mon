# M11 Incubating: copy

Owner: `ux-writer`. Inputs: `01-research.md`, `03-direction.md`; Law 9; Decision #8; PS-005; `screens/M06/05-copy.md` (the `m11.status.notify_off*` and `m11.status.schedule_failed` rows already drafted there, reused unchanged). Glossary: `docs/COPY_DECK.md`.

All strings are `voice: "ui"`. No string says "capture" (Q4), "device" (Law 9), "late", or "hurry". The egg may be "it"; PS-005 covers an individual Mon, and there is no Mon yet.

## Length budget

Text plate inside the screen on SE: 351 pt minus 32 pt padding = 319 pt. `type-body-strong` about 30 characters; `type-caption` about 44.

## Strings

| ID | String | Voice | Max | Notes | Canon |
|---|---|---|---|---|---|
| `m11.time.minutes` | {minutes} min left | ui | 16 | counting, ≥ 1 minute; `{minutes}` rounds **up** so it never reads "0 min" | `V11 ¶49` |
| `m11.time.under_minute` | Less than a minute left | ui | 24 | the only sub-minute string; no seconds | — |
| `m11.time.ready_at` | {eggName} · ready at {clockTime} | ui | 44 | counting; `{clockTime}` in the device locale's short time ("4:12 PM", "16:12") | egg names: Decision #9 |
| `m11.time.ready` | Ready to hatch | ui | 24 | ready; same words as `hlynk.led.ready` on purpose | `V11 ¶49` |
| `m11.time.overdue.today` | Ready since {clockTime} | ui | 24 | overdue, same calendar day | — |
| `m11.time.overdue.yesterday` | Ready since yesterday | ui | 24 | overdue, previous day | — |
| `m11.time.overdue.earlier` | Ready since {weekday} | ui | 24 | overdue, 2–6 days; past 6 days use `{shortDate}` | — |
| `m11.time.resume` | Your egg started hatching | ui | 30 | `resume` sub-state | Law 6 |
| `m11.caption.counting` | Your egg is resting in its case. | ui | 44 | below the time line on first arrival from M10 only; hidden on later visits | v7 egg quiet state "rested" (`[v7] M7 L388`, via JOURNEY) |
| `m11.led.incubating` | Incubating, {minutes} min left | ui | — | chip refinement of `hlynk.led.incubating`; spoken via `hlynk.led.a11y` as "Status light: Incubating, 12 minutes left" (spoken form spells "minutes") | — |
| `m11.trackpad.warm` | Warm the case | ui | 20 | trackpad label and `TrackpadActions` button, counting | — |
| `m11.trackpad.warm.a11y.hint` | Hold to keep your egg company. It won't hatch any sooner. | ui | — | states the truth: no sim effect | brief §4.2 M11 |
| `m11.trackpad.open` | Open the case | ui | 20 | ready, overdue and resume; same label in all three | — |
| `m11.trackpad.open.a11y.hint` | Starts the hatch | ui | — | | `V11 ¶49` |
| `m11.case.a11y.label` | {eggName} in its closed case | ui | — | `CaptureCase` image label | — |
| `m11.case.a11y.label.ready` | {eggName} in its case, ready to hatch | ui | — | | — |
| `m11.a11y.announce.ready` | Your egg is ready to hatch. | ui | — | polite, once, on the ready edge while foregrounded | — |
| `m11.a11y.announce.warm` | You warm the case. | ui | — | polite, on hold start, at most once per 10 s | — |

`m23.notification.title` "Your egg is ready to hatch" and `m23.notification.body` "Open NYC-MON whenever you're ready." are owned by M06 and scheduled from here unchanged.

## Rejected lines

| Line | Why not |
|---|---|
| "Your egg is waiting for you" (overdue) | Puts the wait on the Caller; guilt |
| "Almost there!" (last minute) | Cheerleading a timer is countdown pressure |
| "Keep it warm" | Implies it gets cold if you don't: a false care rule |
| "Hatching soon…" | Ellipsis status reads as a loader (Abode reference) |

## Localization notes

`{minutes}` needs plural rules (ICU `{minutes, plural, one {# min left} other {# min left}}` for English; other locales differ). Clock time and weekday come from `Intl.DateTimeFormat`, never hand-formatted. "Warm the case" is literal: translators should keep "warm" as a verb of touch, not temperature control.
