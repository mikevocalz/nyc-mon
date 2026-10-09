# M15 Rest: copy

All `voice: "ui"`. No pronoun for the Mon.

| ID | String | Voice | Max | Notes | Canon |
|---|---|---|---|---|---|
| `m15.settling` | Settling in. | ui | 24 | awake→sleep | |
| `m15.sleeping` | Asleep. Energy is coming back. | ui | 48 | | `V11 ¶51` Energy |
| `m15.sleeping.leave` | You can close the H-Lynk. {name} keeps resting. | ui | 64 | under the line, once per session | Law 9 "H-Lynk" |
| `m15.wake.button` | Wake {name} | ui | 24 | | |
| `m15.wake.cost` | {name} is still tired. Waking now leaves {name} a little less social. | ui | 90 | shown only while Energy < early-wake line | sim `earlyWakeSocialCost` |
| `m15.wake.confirm` | Wake {name} | ui | 24 | confirm row primary | |
| `m15.wake.cancel` | Let {name} sleep | ui | 24 | confirm row secondary | |
| `m15.trackpad.label` | {name}, asleep | ui | — | | |
| `m15.trackpad.commit` | Wake {name} | ui | — | `commitLabel` | |
| `m15.trackpad.hint` | Hold to wake. | ui | — | | |
| `m15.woke.rested.a11y` | {name} woke up rested. | ui | — | | sim `woke: rested` |
| `m15.woke.early.a11y` | {name} is awake. | ui | — | no cost repeated after the fact | |
| `m15.declined.already` | {name} is already asleep. | ui | 40 | sim `declined: already-asleep`; shown only on a race | |

Rule: the cost is stated once, before, and never repeated as blame afterwards.
