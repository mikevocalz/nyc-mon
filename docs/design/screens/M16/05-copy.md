# M16 Social (play): copy

All `voice: "ui"`. No pronoun for the Mon.

| ID | String | Voice | Max | Notes | Canon |
|---|---|---|---|---|---|
| `m16.intro.title` | Play Peek with {name} | ui | 32 | | |
| `m16.intro.body` | {name} hides. You find {name}. Flick to look, tap to peek. | ui | 72 | | |
| `m16.intro.start` | Start | ui | 12 | CTA | |
| `m16.intro.tired` | {name} is too sleepy to play. A rest comes first. | ui | 64 | sim `declined: too-tired` (Energy < 0.1) | |
| `m16.intro.tired.action` | Go to Rest | ui | 16 | | |
| `m16.intro.asleep` | {name} is asleep. Play after {name} wakes up. | ui | 64 | sim `declined: asleep` | |
| `m16.round.a11y` | Round {n} of {total} | ui | — | | |
| `m16.spot.left` | Left | ui | 8 | spot names; with set dressing names later | |
| `m16.spot.middle` | Middle | ui | 8 | | |
| `m16.spot.right` | Right | ui | 8 | | |
| `m16.trackpad.label` | Looking at: {spot} | ui | — | | |
| `m16.trackpad.hint` | Tap to peek. Flick to look somewhere else. | ui | — | | |
| `m16.twin.back` | Look left | ui | 12 | | |
| `m16.twin.peek` | Peek | ui | 8 | | |
| `m16.twin.forward` | Look right | ui | 12 | | |
| `m16.found.a11y` | Found {name}! | ui | — | polite | |
| `m16.peekout.a11y` | {name} was at {spot}. Found! | ui | — | wrong peek still counts | |
| `m16.result.body` | {name} had fun playing with you. | ui | 48 | same for every quality; no score | |
| `m16.result.again` | Play again | ui | 16 | CTA; disabled with `m16.intro.tired` if Energy now < 0.1 | |
| `m16.result.done` | Done | ui | 8 | | |

The result line never varies with quality, so a slower round never reads as worse company.
