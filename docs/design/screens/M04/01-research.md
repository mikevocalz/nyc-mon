# M04 Birth year gate: research

Route `/(auth)/age` · Shell: none · States: adult / 13–17 / under-13 · Spec: BUILD_PROMPT_v3 §1.5, §4.1; ADR 0001 §Age and consent.

## Jobs to be done

- **Dani (teen):** When the app asks my age, I want it to be one quick tap that doesn't treat me like a little kid, so I can get to my egg.
- **Jayden (11, under-13):** When I enter my real year, I want to keep playing, so I'm not punished for being honest.
- **Sol (adult):** When I give my year, I want to move on with no follow-up questions.
- **Renée (parent):** When my child sets up the app, I want it to know they're under 13 and ask me, so I stay in control.

## Risks

- **Neutral screening (COPPA).** FTC COPPA FAQ D.7 and H.3: ask in a neutral manner, don't default to an age 13 or over, and a check box like "I am over 12 years old" is not neutral. Both recommend a cookie (on mobile, a stored flag) so a child can't go back and enter a different year (https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions). So: no default year, no hint that some years unlock more, no "Back" that resets the answer.
- **Year-only resolution.** A birth year can't separate a 12-year-old from a 13-year-old; ADR 0001 sends `currentYear - birthYear <= 13` to consent. Some 13-year-olds will hit M05. The M05 copy must work for them too.
- **Incentive to lie.** If the under-13 branch visibly stops the game, children learn the "right" year. ADR 0001 lets the child keep playing locally while consent is pending; M04 must not hint at that difference before the choice, and M05 must deliver it after.
- **Not a wall** (§1.5). "Copy must not feel punitive." No "you must be 13", no lock icons.
- **Language and canon:** no character dialogue on this screen; this is `voice: "ui"`. Don't place a Mon here begging or reacting to the answer; a Mon reacting to age is a nudge (UK ICO Children's Code standard 13, "Nudge techniques": https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/).
- **Order:** see M03. The gate must precede any identity collection for the create intent.
- **Accessibility:** a year wheel is slow with VoiceOver and Switch Control. Provide a typed-entry alternative that is just as neutral.

## Usability questions

1. Can players pick their year in a single gesture, including with VoiceOver on?
2. Do any teens say (in the debrief) they would enter a different year, and why?
3. Does the screen read as a question or as a barrier? Ask: "What happens if you put a different year?" and listen for fear of being locked out.
