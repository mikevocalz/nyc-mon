# M15 Rest: critique

| §0C row | Score /10 | Evidence | Gap |
|---|---:|---|---|
| Delight and Fun | 7 | A real lighting change and a curl-up clip; "you can close the H-Lynk" gives permission to leave | Needs authored `sleep_in`/`sleep_loop`/`wake` per bloodline |
| Visuals and Graphics | 7 | Night key of the time-of-day rig is the visual; HUD reduced to one ring | Rig night key not yet designed by `3d-lookdev` |
| Interaction | 8 | Hold-to-wake prevents accidental wakes; button twin with confirm | — |
| Inclusivity | 8 | Hold has a timeout-free alternative; text contrast held on the dark scene by the scrim | — |

## Product decisions

| # | Decision | Disposition | Reason |
|---|---|---|---|
| R-1 | Show the early-wake cost before the commit, in plain words, never after | BUILD | A cost revealed after the fact is a trap (H5, product-decisions §4) |
| R-2 | No timer or ETA on screen | BUILD | Removes the "check back at 01:14" loop; the ring is enough |
| R-3 | Tapping a sleeping Mon on M13 never wakes it; only M15's hold or button does | BUILD | Error prevention |
| R-4 | Manual rest only (follows the sim); scheduled sleep windows go to Q25 | DEFER (canon: Q25) | The sim implements manual rest; v7's owner-chosen 8 h window is a proposal |

## Systems note for Q25

With manual rest and 1/3 per hour recovery, the Mon wakes itself within 3 h of bedtime and then decays awake through the night. A Caller who puts the Mon to bed at night will usually find it awake and asking in the morning. Recommend (proposal, not canon) that Q25 adopt a night window in which a sleeping Mon stays asleep after reaching full Energy until the window ends.
