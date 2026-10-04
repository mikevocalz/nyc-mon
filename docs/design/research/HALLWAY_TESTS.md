# Hallway tests: the 5-user hatch test and per-milestone scripts

Owner: `research-lead`. For Mike to run. Written 2026-10-04.

BUILD_PROMPT_v3 §0C measures *Delight and Fun* with a "5-user hallway test (`user-research`)". This file defines that test and one short script per milestone in §9.

## Ground rules for every session

- **Five people per round, then fix, then test again.** Nielsen's model has five users finding most usability problems; he recommends spending a 15-user budget on three rounds of five rather than one big study (https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/). With distinct user groups he suggests 3–4 per group for two groups, 3 per group for three or more.
- **Five users find problems; they do not measure rates.** Report "3 of 5 hesitated at the eggs", never a percentage.
- **Minors need a guardian's written consent** to take part, and the guardian should be allowed in the room. Don't record a minor's face or voice without that consent; record the screen only.
- **Think-aloud, no help.** If a participant asks "what do I do?", reply "what would you try?" Help only after 60 seconds stuck, and log it as a failure.
- **Build under test:** write the commit SHA on the notes sheet. A finding from an unknown build is not a finding.
- **Devices:** the §0C matrix (iPhone SE 3rd gen, iPhone 16 Pro Max, Pixel 8). Rotate devices across participants.
- **Notes template:** per task, record *completed / completed with help / failed*, time, quotes verbatim, and one line on what they did that surprised you.
- **Language check (Law 9):** note every word the participant uses for the player, the Mon, the device and the Bloodline. If they say "owner", "pet", "wild" or "the phone thing", log it. That is data on whether canon terms land, not a mistake by the participant.

## Recruiting mix

| Round | Teen Caller 13–17 | Adult Caller 18+ | Lapsed player | Parent of under-13 |
|---|---|---|---|---|
| Hatch test (5) | 3 | 1 | 1 (a player of any care game who stopped) | 0 |
| Milestone 1 (5 + 3) | 3 | 2 | 0 | 3, separate mini-session on M05 |

Screener: plays at least one mobile game in a typical week. Exclude anyone who has seen NYC-MON art or builds.

---

## The 5-user hatch test (milestone 3, the §0C *Delight and Fun* gate)

**Question:** does the meeting → incubation → hatch → naming sequence produce a moment people want to show someone, and does the Caller understand that the Baby is the egg they chose?

**Setup:** a test build with a 1-minute incubation option hidden behind a debug flag, so the session isn't 15 minutes of waiting. Fresh install. Notifications allowed. Sound on, then ask whether they would normally play with sound.

### Tasks

1. **Meet.** "Someone is going to show you something. Go ahead." (Start at M08; Santoro presents the three eggs.)
   - Success: chooses an egg without help; can say why they picked it.
   - Observe: how long they look at each egg; whether they open each Bloodline card; whether they read "Hood Ratti Bloodline", "Bodega Baddiee Cee Bloodline", "Yote Bloodline" aloud and how they pronounce them; whether they expect the egg to react to them.
2. **Incubate.** "Get it ready."
   - Success: picks a length and understands nothing is gained by picking longer.
   - Observe: which length; ask afterwards "what do you get for 60 minutes?"
3. **Leave.** "Put the phone down. We'll talk for a minute." Wait for the notification.
   - Success: the notification text alone tells them what happened.
   - Observe: do they tap it at once? Do they read it aloud?
4. **Hatch.** (They tap the notification.)
   - Success: watches through; can say afterwards which egg this came from.
   - Observe: facial reaction at the first crack and at the Baby's first look toward them (§3.5); whether they reach for screen record or say "wait, look"; whether they use Skip (available after 2 s) and why.
5. **Name.** "It's yours now."
   - Success: names the Baby in under a minute, or decides to wait, without confusion.
   - Observe: whether they try "Ratti" (reserved by Decision #1) and how the refusal lands; whether they notice the Baby reacting to the name as they type.
6. **Interrupt (moderator only, one session per round):** force-quit the app mid-hatch, relaunch. Success: the same Baby, no second egg, no second hatch beyond a resume (Law 6). This is a verification check, not a usability task; log it separately.

### Debrief (2 minutes)

- "Tell me what just happened, like you're telling a friend." (Comprehension: egg → same individual → named by them.)
- "Would you show this to anyone? Who?" (Delight proxy; listen for names, not "yes".)
- "Did that Mon pick you, or did you pick it?" (Tests the §2.2 canon that the Mon chooses too, under Decision #5.)

### Pass bar for the gate

- At least 4 of 5 can retell egg → hatch → their named Baby as one individual.
- At least 3 of 5 react visibly at the hatch or name someone they'd show it to.
- 0 of 5 believe a longer incubation buys a better Mon.
- Any participant calling the case a "Poké Ball" is a blocker (§2.4: "must not read as a Poké Ball").

These thresholds are design targets for a qualitative gate, not statistics.

---

## Per-milestone scripts

Each runs 15–20 minutes with five participants unless noted.

### Milestone 1: shells (M01–M07)

**Question:** can a first-time player get from cold start to the meeting without help, and does the age gate feel like a door rather than a wall?

| Task | Prompt | Success | Observe |
|---|---|---|---|
| 1 | "Open it." (cold start) | Reaches M02 without tapping during boot | Do they read the LED as power-on or as a loading spinner? |
| 2 | "Get started." | Reaches M03 having read or skipped the panels | Skip use; which panel they stop on; whether "Scanning isn't recruiting" makes sense |
| 3 | "Make an account." | Account created with their chosen provider | Which provider; passkey comprehension; whether legal links are seen |
| 4 | Birth year | Picks a year in one gesture | Hesitation; any comment like "why do they need this"; whether teens consider lying (ask after, not during) |
| 5 | Notifications | Makes a choice they can explain | Can they say what the notification will be for? Re-run with the prompt moved to M10 if Mike approves question 2 in `JOURNEY.md` |
| 6 | Caller name | Confirms a name | Do they know who will use this name? Do they understand "Caller"? |

**Parent mini-session (3 parents, M05):** show the consent email on their own phone in a test inbox. Tasks: "What is this email asking you?", "What happens if you ignore it?", "Approve it" / "Say no". Success: each parent can state what data is kept and what saying no does. Observe: scam suspicion, where they look for the sender, time to decide.

### Milestone 2: creature online

**Question:** does the placeholder creature show personality within 3 seconds of idle (§0C)?
Task: show Home for 10 seconds with no instruction, then ask "What is it doing? What's it like?" Success: 4 of 5 describe a behavior (scratching, looking at them), not "it's moving". Observe: whether they try to touch it; whether reduced-motion users (recruit at least one) still read personality from the static pose.

### Milestone 3: meeting to hatch

The 5-user hatch test above.

### Milestone 4: care loop (M13–M18)

**Question:** can a Caller read what the Baby needs without a speech bubble (§2.1: "a look, a sound, a reach")?

| Task | Prompt | Success | Observe |
|---|---|---|---|
| 1 | "Check on it." (Fullness set below the needs threshold) | Identifies hunger from the Mon's request | Do they read the request from the Mon or the rings? |
| 2 | "Feed it." | Completes a feed with drag or trackpad | Which method; the species reaction; drag misses |
| 3 | "It looks tired." | Starts Rest | Do they understand the cost of waking early? |
| 4 | "Play with it." | Completes the Social mini-game | Length tolerance (20–40 s) |
| 5 | "Find out more about it." | Opens M17; reads the Bloodline | Whether "Bloodline" is understood without explanation |

Language check: the Baby's request must never be read as distress. Note any participant who says it is "dying", "sick" or "starving" (Law 8).

### Milestone 5: system and polish (M19–M23)

**Question:** do return, offline and deletion flows respect the Mon and the Caller?
Tasks: (1) the lapsed return: set the save to 5 days without play and say "you haven't opened this in a week, go ahead". Success: they find their Mon and describe how they feel, with no guilt words. Observe: hesitation before opening, first words on seeing the Mon. (2) Airplane mode, then feed. Success: they don't notice a problem or understand the sync badge. (3) "Delete your account." Success: they reach it and understand the grace period. Observe: emotional reaction to the copy about the Mon.

### Milestone 6: product site (W01–W07)

Five participants on a phone browser. Tasks: "What is NYC-MON?" (from W01, 10 seconds); "Find out what it does with your kid's data" (the privacy page); "Join the waitlist". Success: a one-sentence correct description; the privacy answer found in under a minute.

### Milestone 7: award-bar re-run

Re-run the hatch test with five new participants on the release candidate, plus the milestone 4 script. Results feed the §8 `design-critique` scorecards for M08, M12 and M13.

---

## After each round

Synthesize within 48 hours using the `research-synthesis` format: themes with "N of 5", verbatims, insight → opportunity table. File to `docs/design/research/rounds/<date>-<milestone>.md` and update `PERSONAS.md` assumptions that were confirmed or killed.
