# Phase 1 journey: boot to first care loop

Owner: `research-lead`. Written 2026-10-04. A hypothesis map: no player has walked this path yet. The emotion curve and drop-off risks are predictions for `HALLWAY_TESTS.md` to confirm or break.

## Actor and scenario

**Actor:** Dani, 14, teen Caller (`PERSONAS.md` §1). Branches for Renée/Jayden (under-13), Marcus (lapsed) and Sol (adult) are marked where they split off.

**Scenario:** Dani installs NYC-MON after a friend shows them a hatch. They expect to get a creature quickly and do not expect forms.

## The flow under Decision #5

Decision #5 (`docs/canon/DECISIONS.md`) overrides the build prompt's M08: the Caller is shown **three eggs**, one per starter Bloodline, presented by Dr. Alessandra Santoro, and chooses one. **Naming happens after the hatch.** That moves M09 after M12:

```
M01 Boot → M02 Welcome → M03 Sign in → M04 Birth year → [M05 Consent, under-13 only]
→ M06 Notify → M07 Caller name → M08 Meet (Santoro, three eggs, choose one)
→ M10 Incubation choice → M11 Incubating → (leave app) → M23 notification
→ M12 Hatch → M09 Naming → M13 Home (Baby) → M14 first Feed
```

Two ordering conflicts surface here; both are questions for Mike, listed at the end:

1. M03 (sign in) comes before M04 (birth year) in BUILD_PROMPT_v3 §4.1, but ADR 0001 puts a "neutral birth-year gate before any account exists". For an under-13 who taps Sign in with Apple or Google first, M03 would collect the child's identity before age is known.
2. M06 asks for notification permission before an egg exists. Android's guidance is to ask in context, after the user has some familiarity, and to make clear what notifications are for. M10, right after "your egg will be ready in 30 minutes", is that context.

The egg the Caller sees at M08 has a canon name and number from roster v11.1 (Decision #9): #001 Metro Egg (Hood Ratti Bloodline), #008 Corner Egg (Bodega Baddiee Cee Bloodline), #061 Prism Egg (Yote Bloodline). The Baby that hatches is #002 Squeaklet, #009 Kittee Cee or #062 Yotito.

## Phases

| Phase | 1. Arrive | 2. Get through the gate | 3. Meet | 4. Wait | 5. Hatch and name | 6. First care |
|---|---|---|---|---|---|---|
| Screens | M01, M02 | M03, M04, (M05), M06, M07 | M08 | M10, M11, M23 | M12, M09 | M13, M14 |
| Actions | Opens app; watches the H-Lynk power on; swipes or skips the three welcome panels | Signs in; picks a birth year; allows or denies notifications; types a Caller name | Santoro presents three eggs; Dani looks at each, reads the Bloodline card, chooses | Picks 15/30/60 min; sees the case close; warms the case; leaves the app; gets the notification | Taps the notification; watches the case open and the egg crack; the Baby looks at them; names it | Sees the Baby full-bleed; the Baby asks for food with a look or sound; feeds it; sees a species reaction |
| Thinking | "What is this? Is this for kids?" | "Why do they need my birthday?" "What do I call myself?" | "Which one is the cool one? What's inside?" | "Do I pick 60 to get something better?" "Do I just stare at it?" | "That's mine." "What do I name it? Can I name it Ratti?" | "What does it want? Is it OK?" |
| Feeling (predicted) | Curious, neutral | Impatient, wary (dip) | Excited, a little unsure (rise) | Flat, waiting (deepest dip) | Peak | Warm, steady |

### Emotion curve (predicted)

```
peak      .                                   *  Hatch
          .                *  Meet          /  \
          .  *  Boot      / \              /    \___ * First feed
          . /  \         /   \            /
          ./    \___    /     \          /
low       .         \__/       \___ ____/
               Gate (M03–M07)     Wait (M11)
```

## Drop-off risks

Ranked by how much of the funnel sits behind them. No completion rates are given: there is no data yet.

| # | Where | Risk | Evidence | Mitigation to test |
|---|---|---|---|---|
| 1 | M11 → M12 | Dani leaves during incubation and never returns, because notifications were denied at M06 before they meant anything | Android notification-permission guidance (ask in context; explain the use). On Android 13+, a denied permission blocks all the app's notification channels | Move the OS prompt to M10; keep M06 copy as a pre-permission explainer there. M11 "overdue" state for late returners |
| 2 | M03–M07 | Five gate screens before any creature. Teens leave | BUILD_PROMPT M02 already borrows Tolan's "atmosphere-first, text-light pacing"; no NYC-MON data yet | Count taps from cold start to the eggs; hallway-test it (milestone 1 script) |
| 3 | M04 → M05 | An under-13 reaches a wait screen and the game stops | ADR 0001 lets the child play locally while consent is pending | M05 says plainly that play continues; the child reaches M08 without waiting |
| 4 | M05 (parent) | Parent ignores or distrusts the consent email; the record expires and the parent email is deleted (FTC FAQ I.2) | FTC COPPA FAQ I.2, C.11 | Test the email with three parents; sender name, plain subject, no urgency |
| 5 | M08 | Choosing between three eggs feels arbitrary: the Caller cannot see who is inside, and the "Mon chooses too" beat (§2.2) has nowhere to happen | Decision #5 vs BUILD_PROMPT §2.2 and `V11 ¶43` ("H-Lynk containment is not consent") | Show each egg's quiet states (v7: "rested, responding to attention, ready-to-hatch", `M7 L388`) as its response to the Caller; ask Mike where the Mon's consent lands (question 3 below) |
| 6 | M10 | Caller picks 60 min thinking it buys a better Mon, then quits | BUILD_PROMPT M10: "longer = nothing extra"; Q27 open | Copy says it outright; hallway question 2 in M10 |
| 7 | M09 | Name pressure, or the name they want ("Ratti") is reserved | Decision #1; §2.2 | Suggestion-free field (Q17); a kind reason when "Ratti" is refused |
| 8 | Return after days (Marcus) | Dread of a neglected Mon keeps him from opening the app | Dodd et al. 2025; Zagal et al. 2013 | Absence rules (Q21); M13 return state that greets rather than reports damage |

## Highs to protect

- **Boot:** the H-Lynk powering on with its red LED (Decision #7) in 600 ms. First proof that this is an object from the story.
- **Meet:** Santoro handing over the choice. She is the only adult in the opening; her presence makes it a scene, not a menu (Replika's character configurator is the named anti-pattern in M08).
- **Hatch:** the §0C "moment people screen-record".
- **First feed:** a species-specific eat and reaction (§2.1). The first proof that care is answered.

## Branches

- **Renée / Jayden (under-13):** M04 → M05. Jayden continues M06–M12 locally; queued writes replay on approval (ADR 0001). Renée's journey is one email and one landing page. Her emotional low is suspicion at the email; her high is a clear statement of what is kept and for how long.
- **Marcus (lapsed):** M01 → M13 directly, or M01 → M11 "overdue" → M12. The risk sits at M01: the boot must route him to his Mon in one step, not to welcome or sign-in again.
- **Sol (adult):** same path as Dani; the gate dip is shorter (no M05) and the meeting high depends more on craft.

## Questions for Mike (from this map)

1. Should M04 run before M03 when the intent is "create account", as ADR 0001 states, so no Apple, Google or email identity is collected from an under-13?
2. Should the notification OS prompt move from M06 to M10, right after the incubation length is chosen?
3. With eggs at the meeting (Decision #5), where does "the Mon chooses too" (§2.2) happen: the egg responding to attention, the Baby's first look at the Caller after hatch (§3.5), or its reaction to the name at M09?
4. Does Santoro appear with a Mon at the meeting? Her "opening partner status" is open in v11 (`V11 ¶104`).

## Sources

- `docs/canon/DECISIONS.md` decisions #5, #7, #9, #11; `docs/adr/0001-auth-and-identity.md` §Age and consent; `prompts/BUILD_PROMPT_v3.md` §2.2, §3.5, §4.
- Android Developers, "Notification runtime permission": https://developer.android.com/develop/ui/views/notifications/notification-permission
- FTC, COPPA FAQ: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- Dodd, Fowler, Lottridge (2025): https://www.sciencedirect.com/science/article/pii/S1875952125000382
- Zagal, Björk, Lewis (2013): https://www.diva-portal.org/smash/get/diva2:1043332/FULLTEXT01.pdf
- Mobbin, Tolan onboarding: https://mobbin.com/flows/1b7a3a3b-82c3-4dc8-a1a0-06ad576e79ff ; Replika character select (anti-pattern): https://mobbin.com/flows/b558f09a-f3ae-422d-98c6-ad93bc0f49e5
