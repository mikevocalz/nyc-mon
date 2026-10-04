# NYC-MON Phase 1 personas

Owner: `research-lead`. Written 2026-10-04 for BUILD_PROMPT_v3 §6 step 1 and the M01–M23 research notes.

## Status: proto-personas

Nobody has interviewed or observed a NYC-MON player yet. These four profiles rest on three kinds of evidence, and every claim says which one it uses:

- **Canon:** the v11 Bible (`docs/canon/source/NYC_MON_Canon_and_Lore_Bible_v11.docx`, cited `V11 ¶n` as in `docs/canon/STARTERS_EXTRACT.md`), roster v11.1, and creator decisions #1–#11 in `docs/canon/DECISIONS.md`.
- **Published research:** listed under Sources with full URLs. Where a figure appears, it is quoted from that source with its sample and dates. Where no source gives a number, none is stated.
- **Assumption:** marked *(assumption)*. Each one is a research question for the first hallway round (`HALLWAY_TESTS.md`).

Treat every assumption as unverified until a session confirms or kills it. Revise this file after each round.

## Why these four

BUILD_PROMPT_v3 §6 names three: the teen Caller, the parent, and the returning lapsed player. The adult Caller is added because canon has one (Coach Idris Diop, "serious adult Caller", `V11 ¶86`) and because M04's adult branch needs someone to design for. The under-13 child is not a separate persona: the consent path (M05) is a joint experience, so the child appears inside the parent profile.

| Persona | Age branch at M04 | Primary screens | Main design pull |
|---|---|---|---|
| Teen Caller | 13–17 | all | delight, identity, speed to the egg |
| Parent / guardian | under-13 (child) | M04, M05, M19, M20 | trust, clarity, low effort |
| Returning lapsed player | any | M01, M11, M13, M21 | no guilt on return |
| Adult Caller | 18+ | all | craft, story, no kid-gating friction |

---

## 1. Dani, 14 (teen Caller)

Ninth grader · Flatbush, Brooklyn · plays on a mid-range Android phone

> "If it's mine, it has to look like mine. I'm not raising something that looks like everybody else's."

**A teen who wants a partner that reflects them, and who will leave in minutes if onboarding feels like school.**

### Goals
- Get to the egg fast and make a choice that feels personal (the three Bloodlines are the first real decision).
- Have a Mon that reacts to them specifically: their Caller name, their care.
- Show the hatch to friends *(assumption; the §0C bar is "a moment people screen-record")*.

### Frustrations
- Forms, permission prompts and legal text before anything happens *(assumption)*.
- Being talked down to. The fiction's leads are 14–15 (`V11 ¶17`); an app that treats Dani as younger than the characters breaks the fantasy *(assumption)*.
- Games that punish absence. Pew found 38% of US teens say they spend too much time on their smartphone, and 36% say they have cut back on phone time (survey of 1,453 US teens, Sept 26–Oct 23, 2023). A care game that guilts them for putting the phone down works against a goal many teens already hold.

### Behaviors
- Plays games on a phone. Pew: 85% of US teens play video games; 70% of teens play on a smartphone; 41% play at least daily (same survey wave, published May 2024).
- Plays alongside friends and talks about games with them. Pew: 47% of teens who play say gaming has helped them make or keep friendships.
- A parent may check the phone. Pew: 64% of parents of 13–14-year-olds say they look through their teen's phone, and 62% limit their teen's phone time. Anything the app sends (notification text, email) may be read by a parent.

### Context of use
Short sessions on a phone, at home and in transit, by choice. Two or three check-ins a day once the egg hatches *(assumption)*. Uses the app one-handed, often with sound off *(assumption; supports the §0C thumb-reach and haptic rules)*.

### Design implications
- M02–M07 must be fast, skippable where the law allows, and voiced in the city's register, not an educational one.
- Copy that names the player uses **Caller** (Law 9). "Callah" appears only in Mon dialogue flagged `voice: "character"`.
- Harassment is a live concern: Pew found 43% of teens who play have been harassed in at least one of three ways. Phase 1 has no multiplayer, so the M07 Caller name is the only user-generated text; keep its profanity rule and keep it private to the Mon.

---

## 2. Renée, 41 (parent / guardian of an under-13)

Home health aide · the Bronx · iPhone, checks email mostly on her phone

> "I don't mind the game. I mind not knowing what it's collecting and who's emailing my kid."

**A parent who receives a consent email she did not expect and decides in under a minute whether the app is safe.**

Her child: **Jayden, 11**, who found NYC-MON through a sibling or a friend *(assumption)* and reached M04 alone.

### Goals
- Understand what the app is and what it keeps about Jayden, in plain words, from the email itself.
- Approve or deny without making an account or downloading anything *(assumption)*.
- Keep control later: see or delete Jayden's data (COPPA gives parents the right to review and delete; FTC COPPA FAQ, linked below).

### Frustrations
- An email from an unknown sender asking her to "verify" something reads like phishing *(assumption)*.
- Pressure tactics: a timer, a guilt line about the pet, or the child being locked out mid-play *(assumption)*.
- Vague privacy language. The FTC's amended COPPA Rule (effective June 23, 2025; compliance by April 22, 2026) requires a written data retention policy saying why children's data is kept and when it is deleted (Venable summary, linked below). Renée is the reader that policy is written for.

### Behaviors
- Monitors devices. Pew (above): 50% of parents of teens look through their teen's phone, 64% for 13–14-year-olds. No equivalent Pew figure for parents of under-13s is cited here; none was found in the sources read.
- Decides from the email preview and the first screen it links to *(assumption)*.

### Context of use
Encounters NYC-MON once, through the M05 consent email, possibly at work. May come back through M19/M20 to review or delete. Never plays.

### Design implications
- The under-13 child must not lose the game while waiting. ADR 0001 already lets the child play locally while `guardian-consents` is pending; M05 must say so to the child, kindly.
- Per FTC COPPA FAQ I.2 and C.11, the parent email may be collected only to send the notice and must be erased if consent does not come in a reasonable time. M05 must not ask for anything else.
- "Email plus" is available only if data is used internally and not disclosed (FAQ I.3). The consent method is a counsel decision (ADR 0001); research's job is to test whether Renée trusts the email.

---

## 3. Marcus, 19 (returning lapsed player)

Community college student · Jersey City · iPhone

> "I opened it after two weeks and I was scared to look."

**A player who hatched a Mon, drifted away, and comes back expecting to be punished.**

### Goals
- Find his Mon, his name for it, and his progress intact.
- Get back into the care loop without a wall of catch-up.

### Frustrations
- Dread before opening the app: the guilt of the neglected pet. The Dodd, Fowler and Lottridge review of 45 virtual-pet papers (Entertainment Computing, 2025) finds that "the death of a virtual pet has emotional repercussions", with grief recorded on memorial websites and personal accounts.
- Appointment pressure. Zagal, Björk and Lewis (FDG 2013) define "Playing by Appointment" as a dark pattern in which games "require that players play at specific times ... as defined by the game, rather than the players", and say "the darkness of this pattern is nullified if completing appointments is not required for progression."

### Behaviors
- Returns through an app icon or a notification, not a deliberate decision to "resume" *(assumption)*.
- May return on a new phone, which makes the server-authoritative `monInstanceId` (Law 6, `V11 ¶93`) the thing that keeps his Mon his.

### Context of use
One reopening after days or weeks. The first 10 seconds (M01 → M13) decide whether he stays.

### Design implications
- Canon already rules out the worst outcome: faint is never death (Law 8, `V11 ¶27`), and v7 says "No distress animation implies harm when the owner is away" (`M7 L388`).
- v7's absence rules (free sitter after 24 h, a floor of 35 on return, "your companion was looked after"; `M7 L14676`) match this persona's needs. They are proposals until Mike answers Q21 in `docs/canon/OPEN_QUESTIONS.md`.
- Marcus may also be an egg-stage lapser: he chose an egg, never tapped the hatch notification, and returns hours or days later. M11's "overdue" state is his entry point.

---

## 4. Sol, 33 (adult Caller)

Graphic designer · Sunset Park, Brooklyn · iPhone, plays at night

> "I grew up with a Tamagotchi on my keychain. I want the grown version, and I want it to look like my city."

**An adult who comes for the craft and the New York specificity, and who has no patience for kid-mode friction.**

### Goals
- A companion with personality and authored art, set in neighborhoods they know (`V11 ¶41`: "meaningful places, not generic neon backdrops").
- Follow the story. The Bible's audience is not only teens: its cast includes adult Callers (`V11 ¶86`).

### Frustrations
- Age gating that feels aimed at children *(assumption)*.
- Monetisation tactics in a care game: pay-to-skip, guilt notifications. BUILD_PROMPT_v3 M10 already forbids pay-to-skip.

### Behaviors
- Nostalgia is a plausible draw. Dodd et al. (2025) report Tamagotchi sales of more than 80 million units since 1996, citing Bandai, and describe "a deeply invested fan base". No source read gives the adult share of virtual-pet players, so none is stated.
- Plays late; the time-of-day rig (§3.2) and the dark-at-night theme (Decision #4) are visible to Sol more than to anyone *(assumption)*.

### Context of use
Longer evening sessions, by choice. Likely to explore M17 (Dex entry) and photo mode.

### Design implications
- M04 must be quick for adults: one year selection, no follow-up.
- Sol reads every word of canon copy and will notice inconsistency: "Bloodline" (Decision #11), "Hood Mon" never "wild", "H-Lynk" never "device" in UI (Law 9).

---

## Empathy maps: open quadrants

Built sparse on purpose. Each blank is a question for the first sessions, not something to fill by guessing.

```
EMPATHY MAP: Dani (teen Caller), M01–M12
Date: 2026-10-04 | Based on: Pew 2024 teen surveys + canon; no NYC-MON sessions yet

SAYS     [research gap] no verbatims yet
THINKS   "Is this for kids?" (assumption); "Which one is the cool one?" at the three eggs (assumption)
DOES     Skips welcome panels (assumption); screen-records the hatch (target, §0C)
FEELS    Impatient: gate screens before the egg (assumption)
         Excited: the choice between three Bloodlines (assumption)
TENSIONS Wants the Mon to choose them back (canon: "the Mon chooses too", §2.2) but
         Decision #5 has the Caller choose an egg, which cannot refuse
GAPS     All four quadrants need sessions with 13–17-year-olds (guardian consent required)
```

```
EMPATHY MAP: Renée (parent), M05 email and landing page
Date: 2026-10-04 | Based on: FTC COPPA FAQ + Pew 2024; no sessions yet

SAYS     [research gap]
THINKS   "Is this a scam?" (assumption)
DOES     Reads the email preview only (assumption)
FEELS    Suspicious: unknown sender (assumption)
TENSIONS Wants her child to have fun and wants to say no to data collection
GAPS     How parents of under-13s judge consent emails; test with 3 parents
```

---

## Sources

- FTC, "Children's Privacy" guidance hub: https://www.ftc.gov/business-guidance/privacy-security/childrens-privacy
- FTC, "Complying with COPPA: Frequently Asked Questions" (sections C.11, D.7, H.3, I.2, I.3): https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- FTC, 16 CFR Part 312 COPPA Final Rule Amendments (April 22, 2025): https://www.ftc.gov/legal-library/browse/federal-register-notices/16-cfr-part-312-coppa-final-rule-amendments
- Venable LLP, "FTC Finalizes COPPA Rule Changes" (summary of text-plus consent and retention policy): https://www.venable.com/insights/publications/2025/01/ftc-finalizes-coppa-rule-changes-in-the-biden
- Pew Research Center, "Teens and Video Games Today" (May 9, 2024): https://www.pewresearch.org/internet/2024/05/09/teens-and-video-games-today/
- Pew Research Center, "How Teens and Parents Approach Screen Time" (March 11, 2024): https://www.pewresearch.org/internet/2024/03/11/how-teens-and-parents-approach-screen-time/
- Dodd, Fowler, Lottridge, "Purr-ogrammed love: A narrative review of virtual pets", Entertainment Computing 54 (2025) 100958: https://www.sciencedirect.com/science/article/pii/S1875952125000382 (open copy: https://openrepository.aut.ac.nz/server/api/core/bitstreams/22fd433c-f410-4558-8cda-845f56128b4a/content)
- Zagal, Björk, Lewis, "Dark Patterns in the Design of Games", FDG 2013: https://www.diva-portal.org/smash/get/diva2:1043332/FULLTEXT01.pdf
- UK ICO, Age Appropriate Design Code (15 standards, incl. 13 "Nudge techniques"): https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/
