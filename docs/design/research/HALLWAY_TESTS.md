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

---

## Premium site — Phase 7 hallway script (2026-10-07)

Owner: `research-lead`. For Mike to run against the redesigned home page (`/`) on `feat/premium-home-redesign` or its successor. It tests hypotheses H1–H6 in `docs/design/site/PREMIUM_SITE_AUDIT.md` §3. It replaces the milestone 6 script above for the home page. The privacy task from milestone 6 is kept as task F5.

**Question:** does a first-time visitor understand NYC-MON in five seconds, and does each segment find its reason to join the waitlist before a store listing exists?

### Setup

- **Build:** a preview or production deploy of the Phase 7 page. Write the commit SHA and URL on every notes sheet. A finding from an unknown build is not a finding.
- **Devices:** a phone browser at 390 px wide for every session (iPhone SE 3rd gen or Pixel 8, rotated across participants). In one session per round, turn on the OS reduced-motion setting and note it.
- **State:** a fresh private browser tab, no cookies, sound off. Load the page and keep it covered or face-down until the timer starts.
- **Waitlist form:** a participant never types their own email. Hand them a test address (for example `hallway+p3@<a domain you control>`) on the notes sheet. If the form cannot take a test address safely, stop the task at the form and log "reached form".
- **Recording:** screen only. Faces and voices only with written consent, and never a minor's face or voice.

### Consent

- **Adults:** verbal consent to take part and to have the screen recorded, noted on the sheet.
- **Teens, 13–17:** a guardian's written consent before the session, and the guardian may stay in the room (ground rules above). The teen also agrees out loud and can stop at any time.
- **Under 13:** do not recruit for this round. NYC-MON's COPPA posture (`docs/adr/0001-auth-and-identity.md` §Age and consent; canon Decision #15) collects nothing from an under-13 without verified guardian consent. A hallway session must not be the exception. If an under-13 turns up with a parent, the parent is the participant and the child does not touch the form.
- **Any participant under 18** follows the waitlist rule above: no personal data typed, test address only.

Read aloud: "We're testing the website, not you. There are no wrong answers. Think out loud, and if you get stuck, say what you'd try."

### 1. Five-second test (H1)

1. "I'm going to show you a web page for five seconds, then hide it. Just look."
2. Uncover the phone with the page at the top, no scrolling. Show it for five seconds by a timer. Cover it again.
3. Ask, in this order, and write the answers down word for word:
   - Q1 "What is this?"
   - Q2 "What would you do with it?"
   - Q3 "Can you get it today?"
   - Q4 "What's the one thing the page wants you to do?"
   - Q5 "What words or pictures do you remember?"
4. Score Q1–Q4 on the sheet as **obvious** (correct, unprompted) · **inferable** (partly correct or hedged) · **missing** ("no idea") · **contradictory** (confidently wrong, for example "a phone game I can download now").

Correct answers: Q1, Mons are creatures who live in New York; Q2, you look after one, or become its Caller; Q3, no, it's not out yet; Q4, join the waitlist.

### 2. First-click tasks

Start each task from the top of the page. Record the first tap target, the time to that tap, and whether it was correct. Do not scroll for them. Scrolling is allowed and counts.

| # | Prompt | Correct first click | Hypothesis | Ask everyone? |
|---|---|---|---|---|
| F1 | "You want to be told when this comes out. What do you tap?" | Any "Join the waitlist" control | H6 | yes |
| F2 | "Find out which Mon you could start with." | The starters section, or a nav link to it | H2 | yes |
| F3 | "Find out what the H-Lynk is." | The H-Lynk section, or a nav link to it | H5 | yes |
| F4 | "Find out what happens if you, or your kid, don't open it for a day." | The care or hatch section, where it says the egg waits | H3 | yes (required for parents) |
| F5 | "Find out what it does with your kid's data." | The privacy page link | H3 | parents only |

After F3, ask while the H-Lynk is on screen: "What is that thing? Could you hold one?" Log the word they use for it (Law 9 language check).

### 3. Free look and join (H6)

"Take a minute and look around like you would at home. If you'd want this, do what you'd do next." Do not mention the waitlist.

Observe: whether they reach the waitlist without a prompt; where they hesitate; whether they look for an app-store button; what they read in the starters, care and hatch sections. If they reach the form, give them the test address (see Setup).

### 4. Debrief (3 minutes)

- D1 "Tell me what NYC-MON is, like you're telling a friend." (H1)
- D2 "Who do you think this is for?" (H4. Listen for "kids", "me", "anyone".)
- D3 "What does it remind you of?" (H4. Log any "Tamagotchi", "Pokémon", "Poké Ball" or "rip-off", word for word.)
- D4 "What made you want it, if anything?" (H2. Note whether a starter name or the choice comes up unprompted.)
- D5 "If you stopped playing for a week, what do you think would happen?" (H3)
- D6 "What do you expect to happen after you join the waitlist?" (H6)
- D7 Parents only: "Would you let your kid sign up? What would you want to know first?" (H3)
- D8 Added in Phase 6, after HATCH and the waitlist: "What happens at the hatch?" Pass: they mention picking a time or one notification, and that the Mon chooses too. Log any "timer", "countdown", "it might reject me".
- D9 "Was there anything that made you stop before joining?" Probe the age checkbox ("I'm 13 or older"): did it read as a barrier, as a gate for kids, or not at all? Note anyone under 13 who looked for a way in, and whether they found the parent-or-guardian line.
- D10 Only if they joined: "What do you think you'll get, and how often?" Pass: "one email when it's out". Log any expectation of a launch date, a beta invite or a place in line.

### Scoring sheet (one per participant)

```
PREMIUM SITE HALLWAY — Phase 7
Date:            Build SHA:            URL:
Participant: P__   Segment: teen / adult (nostalgic|lapsed) / parent
Device:            Reduced motion: on / off   Guardian present: y / n / n.a.

FIVE-SECOND  (O obvious · I inferable · M missing · C contradictory)
 Q1 What is it        [ ]   verbatim:
 Q2 What you'd do     [ ]   verbatim:
 Q3 Out today?        [ ]   verbatim:
 Q4 One action        [ ]   verbatim:
 Q5 Recalled words/images:

FIRST CLICK  (target · seconds · correct y/n)
 F1 waitlist       ______ · ___ s · _
 F2 starters       ______ · ___ s · _
 F3 H-Lynk         ______ · ___ s · _   word used for it: ______
 F4 a day away     ______ · ___ s · _
 F5 data (parent)  ______ · ___ s · _

FREE LOOK
 Reached waitlist unprompted: y / n    Looked for store button: y / n
 Hesitations / surprises:

DEBRIEF (verbatim)
 D1                         D5
 D2                         D6
 D3                         D7 (parent)
 D4

LANGUAGE CHECK: words for player / Mon / H-Lynk / Bloodline:
BLOCKERS: Poké Ball reading · "for little kids" · "it's out now" · other:
```

### Pass bar for the Phase 7 gate

Per hypothesis, from `PREMIUM_SITE_AUDIT.md` §3:

- **H1:** at least 4 of 5 score Q1 and Q4 obvious or inferable, and at least 3 of 5 do so on Q2. Fail if 2 or more of 5 score Q3 contradictory ("it's out now").
- **H2:** at least 4 of 5 get F2 right on the first click, and at least 3 of 5 teens across rounds name a starter or the choice at D4.
- **H3:** at least 2 of 3 parents across rounds answer F4 within 60 seconds and say it without words like "terms" or "policy".
- **H4:** nobody frames it as a clone at D3, and at least 3 of 5 adults across rounds say at D2 that it is for them or for anyone. A Poké Ball reading is a blocker.
- **H5:** at least 3 of 5 describe a physical handheld after F3, and at most 1 of 5 calls it a phone or an app.
- **H6:** at least 3 of 5 adults reach the waitlist in the free look and can answer D6.

These are qualitative design targets for rounds of five, not rates. Synthesize within 48 hours to `docs/design/research/rounds/<date>-premium-site.md`, as for every other round.
