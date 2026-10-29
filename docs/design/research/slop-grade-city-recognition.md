# Slop-grade city: recognition study plan

Lane A1, 2026-10-27, for `docs/plans/slop-grade-city-prompt.md` §6.1 #1. Skill: `design:user-research`, loaded through the Skill tool; its research-plan and interview-guide structure is used below. Status: **plan only.** Nobody has been recruited and no session has run. Nothing below is a finding.

## Question

The physical mode (D19) changes how the Apollo tile looks. Two things must survive the change:

1. **Is this Harlem?** Someone who knows 125th Street recognises the place from the frame.
2. **Is this a believable near future?** The facelift reads as a lived-in New York a few years on, not as uniform neon (MOBILE_WORLD_PR_PACK § Approved art direction: "believable and lived-in, not uniform neon cyberpunk").

The study compares the current build against the physical build at the same camera bookmarks. Kevin Lynch's five elements (paths, edges, districts, nodes, landmarks; `reference-roster.md`) give the probes for question 1.

## Method

Paired-frame comparison with a short structured interview, run in person or over a video call with the frames on the participant's own phone or tablet.

| Item | Plan |
|---|---|
| Stimuli | Device captures from iPhone 17 and iPad Pro hardware only, at the six bookmarks in `docs/design/handoff/slop-grade-city.md` § Camera bookmarks. Current build: flag off. New build: `EXPO_PUBLIC_WORLD_PHYSICAL=1` with `EXPO_PUBLIC_WORLD_FUTURE=1`, preset `twilight` (G2 default), plus `midday` and `midnight` at the two 125th Street bookmarks. Same device, camera and resolution for each pair. No HUD in the frame. |
| Order | Each participant sees current and new in counterbalanced order (half see current first), bookmarks in a randomised order. Pairs are never labelled "old" and "new". |
| Questions per frame | Q1 "Is this Harlem?" yes / no / not sure, then "What tells you?" Q2 (new frames only) "Is this a believable New York a few years from now?" yes / no / not sure, then "What feels off, if anything?" |
| Landmark probe | Without prompting, at the Apollo bookmark: "Name a building you can see." A correct name for the Apollo counts; prompting is recorded separately. |
| Length | About 25 minutes: warm-up 3, frames 15, comparison 5, wrap-up 2. |
| Recording | Audio and notes, with consent. Answers go into a sheet keyed by participant code, bookmark, build and preset. No names in the repo. |

### Session guide

1. **Warm-up (3 min).** How the participant knows 125th Street (lives, works, studies, visits), and how often they are there.
2. **Frames (15 min).** Q1 and Q2 per frame as above. The facilitator does not say which build a frame comes from.
3. **Comparison (5 min).** Both builds of the Apollo and the 125th-east bookmarks side by side: "Which one looks more like the street?" and "Which one looks more like the future?" with a reason for each.
4. **Wrap-up (2 min).** "Is there anything on 125th that you expected and didn't see?"

## Participants

| Criterion | Plan |
|---|---|
| Who | People who know 125th Street between Morningside Avenue and Fifth Avenue first-hand: residents, people who work or study there, regular visitors |
| How many | 8 for the first round (the skill's usability range is 5–8; 8 gives four per order) |
| Screener | "How often have you been on 125th Street in the last year?" Weekly or more qualifies. Familiarity with Slop New York or nyc-mon disqualifies |
| Exclusions | Anyone on the nyc-mon team, under 13s (the app's COPPA line, ADR 0001) |
| Recruitment | Not started. Channel and incentive are Mike's call |

## Pass criteria (proposed thresholds, for Mike to accept or change)

These numbers are proposals set before any data exists, so they can't be tuned to a result.

| # | Criterion | Pass |
|---|---|---|
| P1 | Recognition holds | At the two 125th Street bookmarks and the Apollo bookmark, the new build gets "yes, Harlem" from at least as many participants as the current build |
| P2 | Recognition is high | At the Apollo bookmark, at least 6 of 8 answer "yes, Harlem" for the new build |
| P3 | The landmark reads | At least 6 of 8 name the Apollo unprompted on the new build |
| P4 | Near future is believable | At least 6 of 8 answer "yes" to Q2 on the new build at `twilight` |
| P5 | No uniform-neon read | Fewer than 2 of 8 describe the new build with words like "neon", "cyberpunk", "sci-fi" or "fake" as a complaint (coded from the "what feels off" answers) |

A fail on P1 or P3 is a blocker for G8. A fail on P4 or P5 sends the facelift density (handoff § Facelift elements) back for revision.

## Analysis

- Tally Q1 and Q2 per bookmark, build and preset.
- Affinity-map the "what tells you" and "what feels off" answers into Lynch's five elements plus "facelift" and "rendering artefact".
- Report counts, not percentages, at n = 8.
- Write the synthesis to `docs/design/research/slop-grade-city-recognition-results.md` once sessions run.

## Dependencies

- Device captures of both builds at all six bookmarks (spec D2). None exist: the physical mode has not rendered on hardware yet (`docs/DEVICE_CHECKS.md` § Slop-grade city).
- The facelift density table approved inside G6.
