# M14 Feed: copy

`{name}` as in M13. All `voice: "ui"`. Food names come from `content/food` only, never from this file.

| ID | String | Voice | Max | Notes | Canon |
|---|---|---|---|---|---|
| `m14.title` | Feed {name} | ui | 28 | sheet heading, visually hidden on compact (the Mon is the heading) | |
| `m14.tray.a11y` | Food | ui | — | list label | |
| `m14.tile.a11y` | {food}{note} | ui | — | e.g. "{food}, favourite" when content marks it | Q24 |
| `m14.tile.hint` | Double-tap to feed {name} | ui | — | | |
| `m14.trackpad.label` | {food}, {index} of {count} | ui | — | | |
| `m14.trackpad.hint` | Tap to feed. Flick for other food. | ui | — | | |
| `m14.drag.hint` | Drag food to {name}, or tap it. | ui | 48 | shown once, first visit only | |
| `m14.eating.a11y` | {name} is eating. | ui | — | polite live region | |
| `m14.eaten.a11y` | {name} finished eating. Fullness {percent} percent. | ui | — | | |
| `m14.full.body` | {name} is full. Another meal now makes {name} slow for a while. | ui | 80 | full state, above the tray | brief M14 "sluggish, not sick" |
| `m14.overfed.a11y` | {name} ate and is full and slow for a while. | ui | — | | |
| `m14.declined.asleep` | {name} is asleep. Food can wait until {name} wakes up. | ui | 80 | | sim `declined: asleep` |
| `m14.declined.asleep.action` | Go to Rest | ui | 16 | routes to M15 | |
| `m14.declined.sluggish` | {name} is still full. Try again a little later. | ui | 80 | | sim `declined: sluggish` |
| `m14.close` | Close | ui | 8 | | |
| `m14.empty.blocked` | — | — | — | No string ships: with no food content the Feed button is not routable (see `08-handoff.md` B1). A "No food yet" empty state would be a designed dead end | |

## Rules

- The consequence of overfeeding is stated before it happens and in plain words ("slow for a while"). The word "sick" never appears.
- "Try again a little later" names no time, because `sluggishUntil` is tuning and the Caller should not watch a clock.
- No "favourite" mark appears until Q24 makes favourites canon.
