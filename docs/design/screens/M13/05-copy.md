# M13 Home (Baby): copy

Owner: `ux-writer`. Voice and glossary: `docs/COPY_DECK.md`. `{name}` is `MonInstance.nickname`, falling back to the Baby form name from `@acme/content` (`formName`) when the nickname is null. No pronoun for a Mon (PS-005). "H-Lynk", never "device" (Law 9). Every string here is `voice: "ui"`; the Mon has no lines (Q32: Babies use species sounds only, pending).

## Strings

| ID | String | Voice | Max | Notes | Canon |
|---|---|---|---|---|---|
| `m13.ring.energy` | Energy | ui | 10 | ring caption | `V11 ¶51` |
| `m13.ring.fullness` | Fullness | ui | 10 | | `V11 ¶51` |
| `m13.ring.social` | Social | ui | 10 | Q18 may rename | `V11 ¶51`, Q18 |
| `m13.ring.low` | Low | ui | 6 | under a low ring | — |
| `m13.ring.a11y` | {meter}, {percent} percent | ui | — | add ", low" when low | — |
| `m13.status.content` | Content | ui | 24 | dark LED | — |
| `m13.status.asleep` | Asleep | ui | 24 | dark LED | — |
| `m13.status.sluggish` | Full and slow | ui | 24 | overfed window | brief M14 "sluggish" |
| `m13.status.food` | Asking for food | ui | 24 | pending food request; LED chip | `V11 ¶51` "Mons can request food" |
| `m13.status.energy` | Needs rest | ui | 24 | | |
| `m13.status.social` | Wants to play | ui | 24 | | |
| `m13.status.many` | Needs you: {list} | ui | 40 | list = meter names joined with ", " | `hlynk.led.needs_you` |
| `m13.bar.feed` | Feed | ui | 8 | | |
| `m13.bar.rest` | Rest | ui | 8 | becomes `m13.bar.wake` while asleep | |
| `m13.bar.wake` | Wake | ui | 8 | opens M15 wake state, never wakes directly | |
| `m13.bar.play` | Play | ui | 8 | opens M16 | |
| `m13.bar.dex` | Dex | ui | 8 | opens M17 | |
| `m13.trackpad.label` | {name}'s room | ui | — | trackpad name | |
| `m13.trackpad.hint.food` | Tap to feed. Drag to look around. | ui | — | while asking for food | |
| `m13.trackpad.hint.energy` | Tap to put {name} to bed. Drag to look around. | ui | — | | |
| `m13.trackpad.hint.social` | Tap to play. Drag to look around. | ui | — | | |
| `m13.trackpad.hint.idle` | Tap to say hi. Drag to look around. | ui | — | tap = attention | |
| `m13.mon.a11y` | {name}, {bloodline}. {status}. | ui | — | the Mon's node; double-tap = attention | Decision #11 bloodline label |
| `m13.mon.a11y.hint` | Double-tap to say hi | ui | — | | |
| `m13.resumed.a11y` | {name} is here. {status}. | ui | — | announced once, politely, on return | |
| `m13.choose.title` | Which Mon is with you? | ui | 32 | Decision #18 chooser | Decision #18 |
| `m13.choose.body` | You can switch any time from the Menu key. | ui | 60 | | |

## Language rules applied

- A low meter is described as what the Mon wants ("Asking for food"), never as a failure ("Starving", "Neglected", "Sad").
- The return line names the Mon and the current state only. No elapsed time, no "you were gone".
- `m13.bar.rest` turns into "Wake" while asleep so the bar always names the next real action.

## Open copy questions

1. Q18: if the meter is renamed (e.g. "Social HP"), `m13.ring.social` and `m13.status.many` change; "Wants to play" stays.
2. Does a Baby's request ever carry character voice? Q32 says no for now; nothing here assumes otherwise.
