# Premium site audit: W01 home (v3, Phase 1)

Written 2026-10-07. This replaces the v2 audit that shipped with 3f7ccfb. It audits the page as it stands at **3f7ccfb** (`feat/premium-home-redesign`), a production build served on `:3100`. The last commit before any premium redesign is 63a91ea; Phase 7 proves before/after against the numbers in `PREMIUM_SITE_BASELINE.md`, which were taken at 3f7ccfb.

Sources: seven parallel lanes (research; critique; baseline; a11y; copy and canon; reuse and architecture; research synthesis), each checked by the integrator against the code before use. Reviewers this phase answers to are listed in `docs/design/reference-roster.md` § "Marketing site". Companion files: `PREMIUM_SITE_REFERENCES.md` (36 cards: 32 Mobbin, 4 from fetched pages), `PREMIUM_SITE_BASELINE.md`, `baseline/` (154 screenshots), `docs/design/research/HALLWAY_TESTS.md` (Phase 7 script appended).

No production UI changed in this phase.

## 1. Executive diagnosis

The page is honest and canon-careful in its words and wrong in its pictures. Every image on it is NYC stock photography from `art.ts`; no Mon, egg, or creature appears anywhere, so "Mons live in New York" is a claim the visitor has to take on trust. The H-Lynk, the one physical object the campaign sells, renders **blue** (`device-scene.ts:177`, `#1D4ED8`, commented "Blue shell variant") directly under copy that says "a red handheld". Below the hero, H-Lynk, Care and Hatch reuse one copy-left, box-right split, so the page has no climax; the hatch, which canon makes the payoff, ends on a Brooklyn Bridge photo.

The conversion path is the most serious finding. All three CTAs go to `/get`, whose form confirms "You're on the list" while storing nothing (`components/get/GetPage.tsx`, three banned `useState` calls, no request fired). The header's only filled button is "Log in" on a site whose own code comments say it has no auth.

Under the hood the motion layer breaks its own law: Lenis runs `autoRaf: true` and `connectGsapLenis` uses `clock: 'external'`, which in the pinned Kinetrell (`gsap-lenis.mjs:8-20`) adds no ticker, so GSAP, Lenis and ScrollTrigger each run a frame loop (up to 8 RAF callbacks in one frame while scrolling). Lighthouse mobile median is Performance 76 with LCP 5.2 s, against targets of 90 and 2.5 s. The LCP element is a 37 KB image that is discovered correctly; the time is JS cost (1.4 s bootup, 664 KiB unused JS) and a 696 KB logo PNG.

What to keep: the H1 "Every block has a legend.", the hatch as the single night band, the World section's offset grid, the clean reduced-motion branch, DeviceStage's lifecycle (lazy mount, static capture, offscreen pause, WebGL fallback, DPR cap), and a11y basics (Lighthouse a11y 100, logical keyboard order, no traps).

## 2. Five-second test (cold, first viewport at 1440 and 390)

| Question | Score | Evidence | Responsible |
|---|---|---|---|
| What is NYC-MON? | Inferable | "A companion for the city" plus "Mons live in New York". Nothing says game or pet; no creature above the fold. `baseline/1440-normal-hero.jpg` | `HomeHero.tsx`, `copy.ts` `W01_COPY.hero`, `art.ts` `TEMP_HERO_ART` |
| Why NYC? | Inferable | H1 plus a Chrysler photo. Why the city matters to play is only said in World, below the fold | `copy.ts` `W01_COPY.hero`, `WorldSection.tsx` |
| What do I do with a Mon? | Missing | Three starter names as grey text with no picture or verb; Feed/Rest/Play first appear in section 6 | `HomeHero.tsx` `#mfx-hero-starters` |
| What is H-Lynk? | Missing above the fold, then contradictory | Its section says red; the render is blue. `baseline/1440-normal-hlynk.jpg` | `copy.ts` `W01_COPY.hlynk` vs `device-scene.ts:177` |
| Why care now? | Missing | No timing or status line on home; it only exists on `/get` | `copy.ts` `W01_COPY.hero` |
| What's the one action? | Obvious but contested | Hero CTA is clear at 1440, but the header's filled button is "Log in", and at 390 the hero CTA sits ~895 px down an 844 px viewport | `HomeHero.tsx` `LinkButton variant="cta"`; `site/nav.ts:14` `NAV_CTA` |

## 3. Research hypotheses + synthesis

Lane: `design:user-research` + `design:research-synthesis`, 2026-10-07. Inputs: `docs/design/research/PERSONAS.md`, `JOURNEY.md`, `HALLWAY_TESTS.md`, `docs/canon/DECISIONS.md`, `docs/design/DECISIONS.md`, `docs/design/screens/W01/01`–`08`, the earlier `docs/design/site/PREMIUM_SITE_AUDIT.md`, `docs/phase-1-brief.md`, `docs/adr/0001-auth-and-identity.md`.

### Synthesis

**Method:** desk synthesis of existing docs. **Participants:** none. **Sessions run:** none.

Nobody has interviewed, observed or tested a NYC-MON player or site visitor. `PERSONAS.md:7` says so, `JOURNEY.md:3` calls the journey "a hypothesis map", and `HALLWAY_TESTS.md` holds scripts only. Results are meant to be filed under `docs/design/research/rounds/` (`HALLWAY_TESTS.md:130`). That directory does not exist on `feat/premium-home-redesign` (checked 2026-10-07), so there are no hallway results. Every "N of 5" in this section is a target, not a finding.

The personas were written for the app (M01–M23). Only three short lines address the marketing site: the jobs table in `W01/01-research.md:11-15` and the milestone 6 script in `HALLWAY_TESTS.md:118-120`. Most of what follows carries app-side reasoning over to the site, and it is labelled that way.

#### Claim ledger

Every claim this section relies on, in four classes:

- **CD:** confirmed canon or product decision
- **PR:** published research, quoted in the repo with a source
- **PA:** proto-persona assumption
- **MA:** unvalidated marketing-site assumption

| # | Claim | Class | Source |
|---|---|---|---|
| C1 | The starters are three Baby forms, #002 Squeaklet, #009 Kittee Cee and #062 Yotito, labelled "Hood Ratti / Bodega Baddiee Cee / Yote Bloodline" | CD | `docs/canon/DECISIONS.md:152-160`, `:189-197` |
| C2 | The marketing page shows Baby forms only. No Small, Mid or Max | CD | contract §4; `W01/01-research.md:19` |
| C3 | The H-Lynk Core has a matte red body, a black scanner head with red emitters and a red fan of light | CD | `docs/canon/DECISIONS.md:250-265` |
| C4 | The bond belongs to the Mon and the Caller. No copy implies the H-Lynk owns the Mon | CD | `docs/canon/DECISIONS.md:137-143` |
| C5 | The Mon makes its choice at the hatch. It never rejects the Caller | CD | `docs/canon/DECISIONS.md:226-232` |
| C6 | The site is daylit by default. Dark is for night and the hatch | CD | `docs/canon/DECISIONS.md:89-95` |
| C7 | The seal stays on the right of the hero and the district selector stays (Mike) | CD | `docs/design/DECISIONS.md:107-115`; `W01/03-direction.md:7` |
| C8 | No store listing exists. The one CTA is "Join the waitlist" | CD | contract §9; `W01/01-research.md:22` |
| C9 | Faint is never death. Nothing shows distress while the owner is away | CD | `PERSONAS.md:119` (Law 8, `V11 ¶27`, `M7 L388`) |
| C10 | The product must never read as "a Pokémon skin" or "a Tamagotchi re-theme" | CD | `docs/phase-1-brief.md:21` |
| C11 | An under-13 cannot have an account without guardian consent. If the guardian says no, Santoro keeps the Mon | CD | `docs/adr/0001-auth-and-identity.md:105-107`; `docs/canon/DECISIONS.md:234-240` |
| C12 | 85% of US teens play video games, 70% play on a smartphone and 41% play daily (Pew, May 2024) | PR | `PERSONAS.md:47` |
| C13 | 38% of US teens say they spend too much time on their phone, and 36% have cut back (Pew, 2024) | PR | `PERSONAS.md:44` |
| C14 | 64% of parents of 13–14-year-olds look through their teen's phone (Pew, 2024) | PR | `PERSONAS.md:49` |
| C15 | The death of a virtual pet has emotional repercussions (Dodd, Fowler, Lottridge 2025) | PR | `PERSONAS.md:108` |
| C16 | "Playing by Appointment" is a dark pattern unless appointments are optional for progression (Zagal et al. 2013) | PR | `PERSONAS.md:109` |
| C17 | Tamagotchi has sold more than 80 million units and has "a deeply invested fan base". No source gives the adult share | PR | `PERSONAS.md:142` |
| C18 | Five users per round find most usability problems but do not measure rates (Nielsen) | PR | `HALLWAY_TESTS.md:9-10` |
| C19 | Teens leave when onboarding feels like school or puts forms first | PA | `PERSONAS.md:34`, `:42` |
| C20 | Teens want to show the hatch to friends | PA | `PERSONAS.md:39` |
| C21 | Talking down to a teen breaks the fantasy | PA | `PERSONAS.md:43` |
| C22 | A parent judges from the preview and suspects a scam | PA | `PERSONAS.md:77`, `:83`, `:177-179` |
| C23 | An adult player wants "the grown version" set in their city and has no patience for kid-mode friction | PA | `PERSONAS.md:129`, `:138` |
| C24 | A lapsed player comes back expecting to be punished | PA | `PERSONAS.md:99-101` |
| C25 | After five seconds on the hero, a visitor can say what a Mon is and what they would do with one | MA | `W01/01-research.md:27` (written as a question, never run) |
| C26 | A teen's question on the page is "Is this for me, and which starter would I get?" | MA | `W01/01-research.md:13` |
| C27 | A parent's question on the page is "Is there pressure to play?" | MA | `W01/01-research.md:14` |
| C28 | A lapsed player's question on the page is "Is it out yet?" | MA | `W01/01-research.md:15` |
| C29 | The hero reads as a settings card, the page has no photography, and the H-Lynk section is a caption beside a viewer | MA | `PREMIUM_SITE_AUDIT.md:15-24` (designer critique, untested with visitors) |
| C30 | A premium feel comes from scale, photography and spacing more than from effects | MA | `PREMIUM_SITE_AUDIT.md:152-154` |
| C31 | Parents visit the marketing site at all | MA | `W01/01-research.md:14`. `PERSONAS.md:86` places Renée only at the consent email and the M19/M20 screens |
| C32 | People will join a waitlist when no store listing exists | MA | none. Follows from C8 |
| C33 | Nostalgic adult virtual-pet players are a site segment, separate from the adult Caller | MA | none. Extrapolated from `PERSONAS.md:129` and C17 |

**Counts:** 11 CD, 7 PR, 6 PA, 9 MA, 33 claims in total. The evidence that NYC-MON has collected itself, through sessions, analytics or waitlist numbers, is zero. All 7 PR claims are general-population figures and none is about NYC-MON. All 9 marketing-site claims are untested.

`PREMIUM_SITE_AUDIT.md:156-176` records Lighthouse numbers. They measure performance, not visitors, so they stay out of this ledger.

`/get` exists as a route (`apps/web/app/(site)/get/page.tsx`, rendering `GetPage`). That contradicts `W01/01-research.md:22` ("has not shipped"). Whether it stores an email, and what it does with an under-13's, was not checked in this lane. It belongs to the baseline lane's `/get` check.

#### Themes

**1. The site has to explain a product that does not exist yet.**
Evidence: C8, C28, C32. What the docs establish is the constraint (no store listing, one waitlist CTA). They do not establish that visitors understand the product. C25 is the only comprehension target, and it has never been run.
Implication: the five-second test is the first piece of evidence the project can collect, and it gates everything else in this section.

**2. Absence without punishment is the strongest message that holds for every segment.**
Evidence: C9 (canon), C15 and C16 (published research), C24 (assumption), C27 (site assumption). This is the only theme with canon, research and a persona all behind it. Care-game guilt is documented harm (C15, C16), and NYC-MON canon rules it out (C9).
Implication: "the egg waits" (`W01/05-copy.md:29`) is the claim most likely to reassure a parent and a lapsed or nostalgic adult with a single line. That is still unproven.

**3. Craft and New York specificity are what separate NYC-MON from a clone.**
Evidence: C10 (the brief requires it), C23 (assumption), C17 (the market exists, the adult share is unknown), C29 and C30 (designer judgment).
Implication: whether art, the city and the H-Lynk read as "not a kids' Tamagotchi" is untested. It is the deciding question for the adult segment.

**4. Identity and choice are the assumed draw for teens.**
Evidence: C1 (three named Bloodlines), C5 (the Mon chooses at the hatch), C19–C21 (assumptions), C12 (teens play on phones).
Implication: the starters need to read as characters someone could pick, not as a spec list. The 5-second test and the debrief check this.

**5. The H-Lynk is canon-defined but has never been tested as a believable object.**
Evidence: C3 and C4 (canon). There is no evidence on how visitors perceive it. `JOURNEY.md:67` calls the boot "first proof that this is an object from the story", which is a prediction.
Implication: the hypothesis set has to test whether visitors read the H-Lynk as a physical thing, a phone app skin or a toy.

#### Segments

| Segment | Basis | Site question (assumed) | Evidence status |
|---|---|---|---|
| Teen Caller, 13–17 | PERSONAS §1 (Dani) | "Is this for me, and which one would I get?" | PR on teen gaming only. Behavior is assumed |
| Parent of a teen | Pew figures in PERSONAS §1 (C14). No persona of its own | "Is there pressure to play? Is it safe?" | PR on monitoring only. Site visit assumed (C31) |
| Parent of an under-13 | PERSONAS §2 (Renée) | Meets NYC-MON through the consent email, maybe never the site | PA. Site role unconfirmed |
| Adult Caller, including the nostalgic virtual-pet adult | PERSONAS §4 (Sol). C17 for the market | "Is this the grown version, or a kids' re-theme?" | PR on market size only. The adult share is unknown |
| Lapsed care-game player | PERSONAS §3 (Marcus), adapted | "Is it out yet? Will it punish me?" | PR (C15, C16) on harm. With no product shipped, a site visitor can only be lapsed from other care games, so this group overlaps the nostalgic adult |
| Under-13 child | Inside the parent persona (`PERSONAS.md:17`) | Will reach the waitlist on their own | Not a design target. A compliance risk for the waitlist form (C11) |

#### Prioritized needs

1. **Comprehension in five seconds.** What NYC-MON is (creatures called Mons who live on New York blocks, and you become one's Caller), that it is not out yet, and the one action. Every segment needs this, and no evidence exists for it (C25, C28, C32).
2. **An honest status and a reason to join now.** A visitor should know they are joining a waitlist and what they get for it. Supported by C8. Whether visitors will join without a listing is unknown (C32).
3. **No-pressure care, said plainly.** The egg waits, nothing dies, and there is no streak. This is the only need with canon, research and persona support together (Theme 2). It serves parents, lapsed players and nostalgic adults.
4. **Craft signals for adults.** Art, the city and an H-Lynk that reads as an object (Theme 3, Theme 5).
5. **Starter identity for teens.** Three named Babies and their Bloodlines, legible as characters (Theme 4).

#### Questions for further research

- Do parents visit the site, or only receive the consent email? (C31)
- What share of interested adults are nostalgic virtual-pet players? No source in the repo gives one. (C17, C33)
- Does the waitlist collect an email from someone who could be under 13, and with what age handling? (C11) This is a compliance question for the waitlist owner, not a usability one.

#### Methodology notes

This is desk synthesis of internal documents by one agent. No quotes appear because no participant data exists. The personas cite their published figures with sample and date. This section repeats those figures and does not re-verify them against the original sources.

---

### Hypotheses

Each hypothesis names the cheap test that would falsify it and a pass bar. The bars are qualitative design targets for rounds of five (`HALLWAY_TESTS.md:9-10`), not statistics. The script is the "Premium site — Phase 7 hallway script" section in `HALLWAY_TESTS.md`.

| # | Hypothesis | Segment | Falsifying test | Pass | Fail |
|---|---|---|---|---|---|
| H1 | After five seconds on the hero, a first-time visitor can say (a) that Mons are creatures living in New York, (b) that you look after one, and (c) that the action is joining a waitlist because it isn't out yet | all | Five-second test on the phone hero, then three recall questions | ≥ 4 of 5 get (a) and (c); ≥ 3 of 5 get (b) | ≤ 2 of 5 on (a) or (c), or ≥ 2 of 5 say "it's out, I can download it" |
| H2 | Teens care because of the three named starters and the choice between them, more than because of the H-Lynk or the city | teen | Debrief: "What made you want it, if anything?" plus first click on "find which one you'd start with" | ≥ 3 of 5 teens name a starter or the choice unprompted; ≥ 4 of 5 find the starters on the first click | ≤ 1 of 5 mention starters, or ≥ 2 of 5 call it "for little kids" |
| H3 | "The egg waits" and "nothing dies" reassure a parent without legal-sounding copy | parent | First click: "Find out what happens if your kid doesn't open it for a day," then the debrief | ≥ 2 of 3 parents answer correctly within 60 s and describe it in their own words, with no word like "terms", "policy" or "fine print" | ≥ 2 of 3 cannot find it, or say they would need to read a privacy policy to know |
| H4 | A nostalgic adult virtual-pet player reads NYC-MON as its own world for adults too, not as a childish clone | adult | Debrief: "Who is this for?" and "What does it remind you of?" | ≥ 3 of 5 adults say it is for them or for "anyone", and none calls it "a Tamagotchi rip-off", "Pokémon for kids" or similar | ≥ 2 of 5 use a clone or "for kids" framing. Any Poké Ball reading of the case is a blocker (`HALLWAY_TESTS.md:65`) |
| H5 | The H-Lynk section makes the H-Lynk read as a real handheld from the story, not an app skin or a phone | all | Show the H-Lynk section, then ask "What is that thing? Could you hold one?" Run a language check on the word they use (`HALLWAY_TESTS.md:16`) | ≥ 3 of 5 describe a physical handheld and connect it to the Mon. ≤ 1 of 5 say "phone" or "app" | ≥ 3 of 5 say "a phone", "an app" or "a toy remote", or cannot connect it to the Mon |
| H6 | Visitors join the waitlist without a store listing when they know what joining gets them and the form asks for one field | all adults | Task: "If you'd want this, do what you'd do next." Watch for hesitation. Debrief: "What do you expect to happen after you join?" | ≥ 3 of 5 adults reach the form unprompted and can say what happens next (for example "they email me when it's out") | ≤ 1 of 5 would join, or ≥ 2 of 5 expect to have to download something now |

Each hypothesis is also falsified if the build under test differs from the one named on the notes sheet (`HALLWAY_TESTS.md:13`).

---

### Research plan

**Objectives**

1. Measure comprehension of the redesigned hero cold (H1). This is the gate.
2. Find out which signal makes each segment care or trust (H2–H5).
3. Find out whether a waitlist with no listing converts in principle, and what people expect after joining (H6).
4. Confirm or kill C19–C24 and C26–C33, then update `PERSONAS.md`.

**Methods**

| Method | Answers | Cost |
|---|---|---|
| Moderated hallway sessions on a phone browser, 15–20 minutes each, using the Phase 7 script | H1–H6 | Time only |
| Five-second test, run as part of every session | H1 | None |
| First-click tasks, run as part of every session | H2, H3, H5 | None |
| Optional unmoderated five-second and first-click test on a remote panel, adults 18+ only | H1, H4 with a larger n | Panel fees. Run only if the hallway rounds disagree |

**Participants and recruiting** (realistic for a solo creator)

| Round | Teen 13–17 | Adult (nostalgic or lapsed care-game player) | Parent | Total |
|---|---|---|---|---|
| Phase 7 round A | 2 | 2 | 1 | 5 |
| Phase 7 round B, after fixes | 2 | 1 | 2 | 5 |

This follows Nielsen's advice of 3–4 per group when there are two groups, and 3 per group with three or more, spread over two rounds (`HALLWAY_TESTS.md:9`).

- **Teens:** children of friends and family. A guardian gives written consent and is allowed in the room. Record the screen only (`HALLWAY_TESTS.md:11`). No under-13s this round.
- **Adults:** people from the creator's own circles who owned or played a virtual pet or another care game. The screener asks: "Have you ever kept a Tamagotchi, Neopet or similar? Did you stop?"
- **Parents:** parents in the creator's network with a child aged 9–15.
- **Exclude:** anyone who has seen NYC-MON art or builds (`HALLWAY_TESTS.md:25`).

**Timeline**

| Day | Work |
|---|---|
| 0 | Freeze the Phase 7 build, record the SHA, recruit, collect guardian consents |
| 1–2 | Round A, five sessions |
| 3 | Synthesize within 48 hours into `docs/design/research/rounds/<date>-premium-site.md` (`HALLWAY_TESTS.md:130`); fix |
| 5–6 | Round B on the fixed build |
| 7 | Synthesize; update `PERSONAS.md` and the claim ledger above |

## 4. Reference research summary

Full cards: `PREMIUM_SITE_REFERENCES.md`. Every section met its Mobbin minimum (HERO 4, SIGNAGE 4, WORLD 4, H-LYNK 4, STARTERS 4, CARE 3, HATCH 4, WAITLIST 3, FOOTER 2). The references that shape later phases most:

- **H-LYNK:** Apple iPhone 17 Pro hero. Product name at display size, then the object cropped hard on a black stage. The H-Lynk gets a hardware launch beat, with red as the hardware colour.
- **HATCH:** Abode "incubating…". An egg, no countdown, one line saying you'll be notified. It matches canon's single notification almost word for word.
- **SIGNAGE:** Nike After Dark Tour city list. Stacked place names with small annotations, read like a destination board. This is the model for districts.
- **STARTERS:** Tolan "INTRODUCING / Sam". Small label, big name, character in its world. Dex ID and Bloodline become the annotations.
- **WAITLIST:** Grail email-as-headline. One large field and one reassurance line; its placeholder-as-label is recorded as the accessibility failure to avoid.

Recorded as things not to build: Slush's crypto-style repeating band, BitePal's hearts and streak flame, Finch's hatch confetti, Rains' countdown.

Eight of the ten Mobbin URLs seeded in the contract never came back from any search (Lightship a5fa6838, Webflow 6c536320, Square 394464f3, Daylight b9729ea8, Apple 1821ad0f, Tolan 3b15b9df, 3257e852, 1b7a3a3b). They were not carded; other sections from the same products were.

## 5. Strengths

- H1 "Every block has a legend." is short and owned.
- Copy is canon-careful in most places; the banned-word list has zero hits across `copy.ts`, `nav.ts`, `homeCopy.ts`, `packages/content` and the rendered HTML.
- Starter names, Dex numbers, eggs and Bloodline labels match between `packages/content/mons/*` and canon decisions #1, #9, #11. No Small, Mid, Max or branch form renders.
- The hatch is the single night band.
- WorldSection's offset 12-column grid is the one composition with editorial tension.
- Reduced motion is clean: `motion-armed` never set, all 30 animated elements end visible, Lenis off, no 3D scene, 59.6 FPS.
- DeviceStage lifecycle is complete: lazy mount (`DeviceStage.tsx:44,46`), static capture, offscreen pause (`:66`), WebGPU→WebGL2 fallback (`ThreeCanvas.tsx:103-108`), DPR cap 1.5, dispose.
- CLS 0. No horizontal overflow at any of nine viewports. No console errors.
- Lighthouse A11y, Best Practices and SEO all 100. Keyboard order logical, no traps, h1→h2→h3 without skips.

## 6. Weaknesses (critique, with screenshots)

All paths below are under `docs/design/site/baseline/`.

| # | Severity | Finding | Evidence | Responsible |
|---|---|---|---|---|
| W1 | Critical | Waitlist confirms signup and stores nothing | `get-1440-confirmed.jpg`; no request fired, reload clears it | `components/get/GetPage.tsx` `WaitlistForm` |
| W2 | Critical | H-Lynk renders blue; canon (Decision #16, Core = red body) and copy say red | `1440-normal-hlynk.jpg` | `device-scene.ts:176-177` |
| W3 | High | No creature anywhere; starters show street photos under "Three eggs" | `1440-normal-starters.jpg` | `art.ts` `TEMP_*` |
| W4 | High | Hero is three boxed objects (panel, photo, seal sticker) on a loud 3D grid; the panel does five jobs; CTA below the fold at 390; landscape first view shows only "EVERY BLOCK" | `1440-normal-hero.jpg`, `390-normal-hero.jpg`, `844x390-normal-hero.jpg` | `HomeHero.tsx`, `SolidPanel` |
| W5 | High | H-Lynk, Care and Hatch share one split template; no visual climax | `1440-normal-fullpage.jpg` | `HLynkSection.tsx`, `CareSection.tsx`, `HatchBand.tsx` |
| W6 | High | "The device" eyebrow over "The H-Lynk Core" | every width | `copy.ts:23` |
| W7 | High | H-Lynk reduced-motion capture shows a white box inside the night plate; at 844x390 the plate is grey while the scene mounts | `1440-reduced-hlynk.jpg` | `DeviceStage.tsx` capture `/home/h-lynk-core.png` |
| W8 | Moderate | Eyebrow rule `bg-orange` has no CSS (only `.bg-orange-500` etc. exist), so every eyebrow is indented 44 px over an empty gap | `1440-normal-world.jpg` | `Eyebrow.tsx:10` |
| W9 | Moderate | District selector clips "Mega City" at 390 and spills its panel at 768/884; nav "Home" overlaps the wordmark at 768 | `390-normal-hero.jpg`, `768-normal-hero.jpg` | `HomeHero.tsx`, `SegmentedControl.web.tsx`, `NavBar.tsx` |
| W10 | Moderate | Care is one dark readout with three identical meter rows and percentages; reads as a dashboard | `1440-normal-care.jpg` | `CareSection.tsx` |
| W11 | Moderate | World is four captioned landmark photos with no Mons; reads as a tourism page | `1440-normal-world.jpg` | `WorldSection.tsx` |
| W12 | Low | Slogan appears five times (H1, marquee, seal, footer twice); marquee cuts mid-word at 390; four pixel skylines on one page; 11 px hero photo caption unreadable at every width; footer promises a headset nothing else mentions | various | `MarqueeBand.tsx`, `copy.ts`, `homeCopy.ts` |

Suspected issues from the brief, resolved:

| Suspected | Verdict |
|---|---|
| Hero SolidPanel reads as a component demo | Confirmed (W4) |
| H-Lynk is copy and bullets beside a demo | Confirmed, and worse (W2, W7) |
| Starters text-heavy with no large art | Partly refuted: large 4:5 plates exist, but they're street photos, not eggs or Mons (W3) |
| Care is three equal cards | Refuted as worded; still reads as a dashboard (W10) |
| Hatch text-led with no climax | Confirmed (W5) |
| No standalone WORLD story | Refuted: `WorldSection.tsx` exists; it lacks Mons (W11) |
| "The device" eyebrow | Confirmed (W6) |
| `/get` waitlist behaviour | Verified: a real route with a fake form (W1). See §17 |

## 7. Component reuse matrix

Semantic primitives live at `packages/ui/html/index.tsx` (`@acme/ui/html`), not `/ui/html`: `Section`, `Article`, `Aside`, `Heading` (`level` 1–6), `Paragraph`, `Figure`, `Figcaption`, `Form`, `Fieldset`, `Legend`, `Label`, `Input`, `Output`, `VisuallyHidden` and the rest. Home structural wrappers today are mostly `View` from `@acme/ui/tw`, which is a client module.

| Class | Components |
|---|---|
| Use as-is (12) | `SolidPanel`, `NavBar`, `SiteFooter` (`scene="river-tide"`), `ProgressBar` (segmented, `role=meter`), `SkylineDivider`, `RiverTide`, `SceneSection`, `ThreeCanvas`, `@acme/ui/html`, `Image`, `LinkButton variant="cta"`, `BrandLogo` |
| Use with variant (3) | `CornerCutFrame` (glow and rim off), `NotchFrame` (bento tiles, no glow), `CityBlocks` (hero canvas; needs a coordinator with DeviceStage) |
| Compose (4) | neon token helpers (glow only in the hatch), `SkylineBand`, `LazyScene` (via `SceneSection`), `@acme/ui/hlynk` (`HLynkShell`, `ScannerLed`, `Trackpad`, `HLynkKey`) for H-Lynk proof tiles |
| Do not use on the marketing page (6) | `NeonChevron`, `BeamFrame` (glow as border), `CardSlider`, `CardSliderImageItem` (starters are not a slider; 2.5.7), `GridCard` (SaaS card), `CircuitButton` |
| Missing primitive | None confirmed. `MarqueeBand.tsx` is hand-built while `SignageBand` / `SignagePlate` stories exist in the kit; Phase 2 checks whether they replace it |

`SegmentedControl` is in use but needs a fix in the kit, not the app: it's coded as `role="tablist"` (`SegmentedControl.web.tsx:36`) with no tab panel and no arrow keys, inside a fieldset with a legend. It should be a radio group (§14).

Token adherence: no hex literals in `home/*.tsx`, but `motion.ts:77-244` hardcodes every duration (420–1300 ms), distance, scale, GSAP ease name and a media query; `StartersSection.tsx:63,77` uses `duration-200/300` and `scale-[1.03]`; `text-[11px]`, `tracking-[0.18em]`, `max-w-[34rem]`–`[38rem]`, `min-h-[640px]` recur across hero, world, H-Lynk and care; `device-scene.ts` carries ~30 hex values for the HUD. `packages/theme/tokens.ts` has `motion.duration`/`easing` (399-411) and `motionTokens` (460-508) at UI scale only, with no page-choreography tokens. Phase 2 adds them.

## 8. Proposed IA

Keep the contract baseline: NAV → HERO → SIGNAGE → WORLD → H-LYNK → STARTERS → CARE → HATCH → WAITLIST → FOOTER. No research supports a reorder; there is no NYC-MON user evidence yet (§3). Two changes inside that order, as ADR drafts for Phase 2:

1. **WAITLIST becomes its own section on home**, not only a link to `/get`. The five-second test shows "why now" is missing from home; the waitlist section is where status ("not out yet, here's what joining gets you") lives. Blocked on §17 Q1.
2. **SIGNAGE replaces the repeating slogan marquee** with a district destination board (Nike After Dark card), so the H1 isn't printed again directly under itself.

## 9. Copy and message ladder

**Brand promise:** Hatch a Mon on your own New York block and raise it as your partner.

**Supporting proof:** New York is the world (Harlem, Midtown, Downtown, Mega City, on real streets) · the Mon is a relationship (its own mind; it chooses you at the hatch, Decision #14) · the H-Lynk is how you stay connected and never owns the bond (Decision #8) · three starter Bloodlines (Hood Ratti, Bodega Baddiee Cee, Yote) · the hatch is the payoff (pick 15 min, 30 or an hour; one notification).

**CTA:** `Join the waitlist`, everywhere, including the header.

Hero directions: (1) **Every block has a legend.** (2) **New York has new neighbors.** (3) **Somebody on your block is about to hatch.**
Hero support lines: (1) "Pick one of three eggs from Dr. Santoro. Be there when it hatches. Then look after your Mon on the same blocks you walk." (2) "Mons showed up less than ten years ago, and the city's still figuring them out. Hatch one and become its Caller." (3) "Mons live in Harlem, Midtown and Downtown, on the same streets as you. One of them is waiting to meet its Caller."
Recommended pairing: keep H1 (1), already owned, with support line (1), which answers "what do I do with a Mon"; drop the slogan from the marquee.

H-Lynk (eyebrow "H-Lynk"): "Your line to your Mon." · "Red plastic. Black scanner. Always in reach." · "Dr. Santoro hands you an H-Lynk Core." Feature lines become physical facts traceable to Decision #16: black scanner head with a red light · square trackpad ringed in red · antenna stub, top left.
World: "Mons live here now." · "From Lenox Avenue to the World Trade Center." · "Four districts. Every one has its own legends."
Starters: "Three eggs on Dr. Santoro's table. You pick one." · "Metro Egg, Corner Egg, Prism Egg. One of them is yours to carry." (egg names interpolated from `packages/content/eggs.ts`)
Care (eyebrow "Care"): "Feed. Rest. Play." · "Your Mon tells you what it needs."
Hatch: "Fifteen minutes, thirty or an hour. You pick, and the egg waits. You get one notification when it's ready."
Final CTA: "Be there when it opens." (current; keep) · "Get on the list before the first hatch."

Current copy to change (full 27-row table in the copy lane report):
- **Canon violations:** "The device" eyebrow (`copy.ts:23`); the three H-Lynk feature lines invent canon (`copy.ts:26-28`: the HUD tabs are open question Q42, "twin-emitter" is invented, "calls them out" implies recruiting, which Phase 1 canon rules out); footer calls the creatures "NYC-MON" and says "find them" (`packages/spatial/homeCopy.ts:10-11`, also the site-wide meta description); `aria-label="H-Lynk device"` is a JSX literal (`DeviceStage.tsx:60`).
- **Slop patterns:** binary contrasts "The city isn't a backdrop. It's the world." (`copy.ts:19`) and "A relationship, not a streak." (`copy.ts:45`, which names streaks while rejecting them); ~6 em dashes on screen; "A companion for the city" is generic; "How care works", "The loop", "Three meters, three things you do" are spec-sheet.
- **Duplication:** the slogan is defined four times (`copy.ts:7,12`, `homeCopy.ts:9`, a literal `<title>` in `app/(site)/page.tsx:6`); "Join the waitlist" is a literal in four files; `/get` is a literal in two.

## 10. Art-direction brief (binding for Phases 3–6)

**What makes it NYC-MON and nothing else:** a New York transit-and-street campaign for a creature you raise. The page is printed matter on concrete in daylight (route boards, wheat-paste posters, the seal as a stamped badge), and the only light source is the hatch at night. The one memorable thing is the creature and the egg at key-art scale. Everything else is quiet.

**Type (Archivo Black + Space Grotesk only).**
- Archivo Black: display and section headlines only, set tight (leading 0.9–0.95, tracking −0.01em), uppercase via CSS from sentence-case source. Mobile display 2.75–3.25 rem; tablet 4–4.5 rem; desktop up to 6 rem for the hero only, 3.5–4 rem for sections.
- Space Grotesk: body 1–1.125 rem at 1.5 leading, measure ≤ 65ch; labels at 0.875 rem minimum. The 11 px caption step goes. No tracked-out caps label above every heading: eyebrows appear only where they orient (district, section name in signage style), and get a tokenised size.
- Steps come from `typeRamp`/`typeScale` in `packages/theme`; new steps are added there, not as `text-[…]` literals.

**Rhythm.** One vertical unit from `space` tokens; sections separate by scale and surface change, not by four pixel skylines. One `SkylineDivider` at most between day and night, and `RiverTide` above the footer.

**Colour roles.** Daylight surface is cool concrete (theme neutrals, not cream). Ink is signage black from tokens. Orange is the primary CTA and the hatch light only. Red is H-Lynk hardware and the scanner only. District colours mark context (a district board, a route disc) and never fill a CTA. Blue is the wordmark outline, not the H-Lynk.

**Photography.** Street level, daylight, borough texture (bodega awnings, stoops, platforms, crosswalks) over postcard landmarks. Real NYC photos at explicit aspect slots from the art map; never hotlinked stock. Mobile gets art-directed crops, not desktop bytes. Every photo either places a Mon or names a district; a landmark with a caption alone isn't enough.

**Signage logic (Vignelli-derived).** Districts as a destination board: name large, one annotation small, a coloured disc or bar as the only district colour. Hard rules, flush-left text, black on concrete. Signage reads as wayfinding, not as a ticker of slogans.

**Surface and texture.** Solid faces and hard corner cuts (`SolidPanel`, `CornerCutFrame`, `NotchFrame` with glow and rim off). Concrete, metal, poster paper. Nothing rounded by default.

**Where glow lives.** Only in the hatch band, and only as light from the egg, the scanner LED or a street lamp. No glow borders in daylight, ever.

**Forbidden.** Gradients as decoration, glass or blur, HUD overlays as decoration, rounded SaaS tiles, identical card rows, numbered 01/02/03 markers on content that isn't a sequence, springs on copy, letter-by-letter type, a third typeface, a serif "for luxury", glowing dashboards, fake terminals.

## 11. Selective bento plan

Bento is CSS Grid only, DOM order equals mobile reading order, one dominant module, ≤ 4 modules, at least one visual proof per cluster.

1. **WORLD:** one dominant district photo with a Mon placed in it, plus up to three smaller district tiles (destination-board labels). Replaces the four equal landmark photos.
2. **H-LYNK supporting proof:** after the launch beat (the object large on black), one cluster: the DeviceStage capture dominant, plus physical-fact tiles composed from `@acme/ui/hlynk` (`ScannerLed`, `Trackpad`, `HLynkKey`). No text-only tiles.
3. **CARE (optional):** one dominant Mon reaction image, with Feed / Rest / Play as three small tiles each showing the Mon's cue, not a meter percentage. If the art isn't ready, Care stays a single composition and this cluster is skipped.

Never bento: hero, starters, hatch, waitlist/final CTA.

## 12. Motion principles

- **One clock.** Switch to `autoRaf: false` with `connectGsapLenis(lenis, { clock: 'kinetrell' })`, which puts Lenis on `gsap.ticker` (`gsap-lenis.mjs:20`). Phase 2 records this as an ADR and adds the ticker-count assertion. Today: 3 loops idle, 5 with DeviceStage on screen, up to 8 callbacks per frame while scrolling.
- **One expensive canvas at a time.** Hero `CityBlocks` and `DeviceStage` both run live with no coordinator, and three.js's internal loop keeps running after DeviceStage scrolls away. A shared owner pauses the offscreen canvas.
- **Name the purpose or delete it.** Keep: the hatch reveal (emotional emphasis), the H-Lynk entrance (product physicality), district switching (spatial context). Remove the default fade-up on every block (`motion.ts` reveals today).
- **Content is visible before motion.** Normal-motion scroll reveals hold content at opacity 0 until a trigger fires, so axe and full-page captures miss the H-Lynk block. Reveals start from visible-but-offset, or the harness scans each section after its reveal settles.
- **Teardown.** `ScrollTrigger.getAll()` returns 7 → 0 → 7 on route away and back at 1280 (5/0/5 at 390): teardown works. Keep it as a harness assertion, polling rather than waiting a fixed time.
- **Reduced motion** already shows everything; keep that branch as is.
- Every duration, distance and ease becomes a `packages/theme` token documented in `PREMIUM_SITE_MOTION.md`.

## 13. Responsive principles

- Mobile is composed separately. At 390 the first viewport must show the H1, the support line and the CTA; today the CTA is ~50 px below the fold.
- The district control fits the narrowest panel (320 px) without hidden overflow: wrap to two rows or become a vertical radio list.
- The 844×390 landscape view currently shows only "EVERY BLOCK". The hero needs a short-viewport rule (smaller display step, art beside the text).
- Nav must not overlap the wordmark at 768.
- No `100vh`; use `svh`/`dvh` with a floor. No multi-screen pin on mobile.

## 14. Accessibility risks (baseline findings)

axe (wcag2a/aa, 21a/aa, 22aa) finds one failing rule, `color-contrast`, at every width; full table in `PREMIUM_SITE_BASELINE.md`. Manual WCAG 2.2 review:

| Criterion | Severity | Finding | File |
|---|---|---|---|
| 1.4.10 Reflow | High | District selector is 384–410 px wide inside a 348 px panel at 390 (278 px at 320) with `overflow-hidden`: "Mega City" clips at 390, can't be tapped at 320, and the panel jumps ~22 px when it takes focus | `HomeHero.tsx`, `SegmentedControl.web.tsx`, `SceneSection.tsx` |
| 1.4.3 Contrast | High | Care closing line `text-orange-600` #d96b00 on #f3f4f4 = 3.14:1; DeviceStage caption #61656a on #00041c = 3.45:1 because the `bg-ink-950` plate lacks `scheme-dark` | `CareSection.tsx:34`, `HLynkSection.tsx:48` |
| 4.1.2 Name, Role, Value | Medium | District selector coded as tabs with no tab panel; each option its own Tab stop; arrows do nothing. Should be a radio group. Enter/Space work, no drag needed (2.1.1, 2.5.7 pass) | `SegmentedControl.web.tsx:36,43` |
| 2.4.11 Focus Not Obscured | Medium | Sticky nav is 114 px tall with no `scroll-padding-top`; Shift+Tab leaves the hero CTA 57% under the nav at 1280. Passes AA (partly hidden), breaks contract §13. Skip link also scrolls the hero top under the nav | `NavBar.tsx`, `globals.css` |
| 2.4.11 | Medium | With the phone menu open, Tab past the last item lands on the hero CTA two-thirds behind the sheet; Escape doesn't return focus to the menu button | `NavBar.tsx` |
| 2.2.2 Pause, Stop, Hide | Medium (confidence medium) | Hero city canvas and footer river animate continuously in normal motion with no pause control | `CityBlocks`, `RiverTide` |
| 2.4.1 Bypass Blocks | Low | Skip link works but focus stays on `<body>`: `<main>` lacks `tabIndex={-1}` | `app/(site)/layout.tsx` |
| 2.5.8 / 1.1.1 | Low | Footer links 20 px tall (pass by spacing, below 44); hero region unnamed; canvas label never reaches the DOM; seal and wordmark announced twice | `SiteFooter`, `HomeHero.tsx` |

Harness gap: the scan must run per section after its reveal, or in reduced motion as well, or it misses anything held at opacity 0.

## 15. Performance risks (baseline numbers)

Median of 5 Lighthouse mobile runs (Lighthouse 13.5.0, Chrome 154, simulated moto g power, 4× CPU, M3 Pro):

| Metric | Baseline | Target | Status |
|---|---|---|---|
| Performance | 76 | ≥ 90 | Fail |
| Accessibility / Best Practices / SEO | 100 / 100 / 100 | ≥ 95 | Pass |
| LCP | 5193 ms | < 2.5 s | Fail |
| CLS | 0 | < 0.05 | Pass |
| TBT | 249 ms | | |
| INP | not measurable in navigation mode | < 200 ms | Unmeasured |

Mapped to causes:
- **LCP:** the LCP element (hero `<img>`, 37 KB, `fetchpriority=high`) is discovered correctly; the simulated time is JS: 1.4 s bootup, 664 KiB unused JS, a 379 ms long task. First visit loads 27 JS files, 4.0 MB raw / 1.19 MB gzip, including ~1.1 MB raw of error and not-found boundary chunks. Fix by moving the hero plate to the server (only the district selector and CityBlocks stay client) and splitting what the first view doesn't need.
- **Bytes:** `nyc-mon-logo-640.png` transfers 696 KB. three.js and friends add 1.2 MB raw / 325 KB gzip on scroll.
- **RAF:** 3–5 loops, up to 8 callbacks per frame (§12).
- **DeviceStage mount:** 495 ms (1280) / 456 ms (390) from near-viewport to first frame, long tasks 266 + 148 ms; one stall on mount (3.77 s at 1280, likely GPU shader compile, not traced) drops mean scroll FPS to 22.7. On a software GPU mount is a single 5 s long task.
- `/get` loads `canvaskit.wasm` for a form page.
- Node v26.8.2 sits outside the repo's `engines` range (`<26`).

## 16. Conversion risks

1. **Signups are discarded** while the page confirms them (W1). Every visitor who joins today is lost and believes otherwise.
2. **Two primary actions:** header "Log in" vs hero "Join the waitlist".
3. **No status line on home:** nothing says it isn't out yet or what joining gets you (research hypothesis H6).
4. **CTA below the fold on phones.**
5. **Under-13 capture:** the form takes any email with no age posture; canon's COPPA decisions mean the real form needs one before it stores anything (research synthesis, segments).
6. **No creature means no desire:** the reason to join (a specific Mon you'd raise) never appears.

## 17. Open decisions / unknowns

**Dispositions (2026-10-07):** each question below has an entry in `PREMIUM_SITE_DECISIONS.md`. Decided: Q1 → PS-001 (build `POST /v1/waitlist` in admin-vite; the fake confirmation must not ship), Q3 → PS-003 (header CTA "Join the waitlist"), Q4 → PS-004 ("H-Lynk Core"), Q6 → PS-006 (strike "its own weather"). Waiting on Mike: Q2 → PS-002 (recommend red), Q5 → PS-005 (no pronoun until canon Q14), Q7 → PS-007 (art slots built, assets needed).

Stop-and-ask items (contract §15). Phase 1 didn't need them; later phases do.

| # | Question | Blocks | Why it's not mine to decide |
|---|---|---|---|
| Q1 | Where does the waitlist endpoint live? ADR 0003 puts DB and auth in `apps/admin-vite`; `REPO_MAP.md:66` says `apps/web` holds no DB or secrets. Options: a route in admin-vite's `/v1`, a server action in `apps/web` with a new secret, or a third-party list | Phase 6, and any CTA work | Owner boundary and data handling for minors |
| Q2 | H-Lynk Core colour: canon says red; the render and its comment say "Blue shell variant". Was blue a deliberate choice? | Phase 4 | Canon/taste |
| Q3 | Header CTA: "Log in" or "Join the waitlist"? Code comments say the site has no auth | Phase 3 | Product call |
| Q4 | `aria-label="H-Lynk device"` was §5 brief wording, flagged in `W01/06-critique.md:26`, never ruled on | Phase 4 | Canon |
| Q5 | Pronoun for a Mon, "it" or "they" (v11 ¶54 gives Mons genders) | Phases 3–6 copy | Canon |
| Q6 | Does per-district weather ship? (`copy.ts:20` "its own weather") | Phase 3 World copy | Canon/product |
| Q7 | Final art: Mon renders (Baby forms), egg key art, H-Lynk captures, street photography at the needed aspects. None are in `packages/assets` | Phases 3–6 | Asset production |

Unknowns: no NYC-MON user evidence exists (0 interviews, no hallway results; `docs/design/research/rounds/` doesn't exist). `W01/01-research.md:22` says `/get` hasn't shipped; it has. Canvases were measured on system Chrome with WebGPU; the screenshots used the WebGL fallback. No real-phone numbers.

## 18. Do not build

- A waitlist confirmation that isn't backed by stored data.
- Anything with the HUD tab labels (Dex, Crew, Care, Bag, City) while Q42 is open.
- Small, Mid, Max or branch forms.
- Streaks, hearts, countdowns, confetti, or guilt copy in Care or Hatch.
- A slogan marquee that repeats the H1.
- Bento in hero, starters, hatch or waitlist; text-only tiles anywhere.
- Glow borders in daylight; gradients, glass, HUD decoration, rounded SaaS tiles.
- `CardSlider` for starters; `GridCard`, `BeamFrame`, `NeonChevron`, `CircuitButton` on this page.
- A second live canvas without a coordinator; a second RAF clock.
- React Three Fiber, Framer Motion, Tamagui, shadcn, a Bento package, NeonBlade as a dependency, a third typeface.
- `useState`/`useReducer` (the waitlist uses `useActionState`).
- Visible strings as JSX literals outside `copy.ts` / `packages/content`.
