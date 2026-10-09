# M17 Dex entry / Mon profile: copy

All `voice: "ui"`. `{name}` = nickname, else the Baby form name. Form and bloodline names come from `@acme/content` only. No pronoun (PS-005).

| ID | String | Voice | Max | Notes | Canon |
|---|---|---|---|---|---|
| `m17.back.a11y` | Back | ui | — | | |
| `m17.dex` | No. {dex} | ui | 8 | `{dex}` zero-padded to 3, as the site does | Decision #9 |
| `m17.dex.a11y` | Dex number {dexSpoken} | ui | — | "Dex number 2", not "zero zero two" | |
| `m17.bloodline` | {bloodlineName} Bloodline | ui | 40 | via `bloodlineLabel()` | Decision #11 |
| `m17.life.a11y` | Life stages | ui | — | group label | `V11 ¶25` |
| `m17.life.done.a11y` | {formName}, done | ui | — | | |
| `m17.life.current.a11y` | {formName}, now | ui | — | | |
| `m17.life.later.a11y` | Later stages, not reached yet | ui | — | one label for all `later` slots, read once | Law 7, PS-029 |
| `m17.fact.name` | Name | ui | 12 | | |
| `m17.fact.hatched` | Hatched | ui | 12 | value: locale long date, e.g. "4 October 2026" | |
| `m17.fact.caller` | Caller | ui | 12 | value: `caller.callerName` | Law 9 |
| `m17.photo` | Photo | ui | 10 | button; only rendered when photo mode is available | |
| `m17.photo.title` | Photo of {name} | ui | 32 | photo-mode heading (visually hidden) | |
| `m17.photo.hint` | The picture has a clear background and nothing else in it. | ui | 64 | under the shutter, once | |
| `m17.photo.shutter.a11y` | Take photo | ui | — | | |
| `m17.photo.cancel` | Cancel | ui | 10 | | |
| `m17.photo.share` | Share | ui | 10 | export-done primary | |
| `m17.photo.done` | Done | ui | 10 | | |
| `m17.photo.saved` | Photo ready. | ui | 24 | toast | |
| `m17.photo.error` | That photo didn't save. Try again. | ui | 48 | export failure | |

Not shipped (no canon): bond, likes, culture note. No strings exist for them, so nothing can render them by accident.
