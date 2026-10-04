# W01 Home: research

Skill: `design:user-research`. Sources: `prompts/BUILD_PROMPT_v3.md` §0C, §5 (W01 row), `docs/design/research/PERSONAS.md`, `docs/canon/DECISIONS.md` #1, #4, #5, #6, #9, #11, #13, #14, #16. Mike's direction of 2026-10-04 (quoted in `03-direction.md`).

## The page's job

Someone lands on `/` from a link. In one screen they learn what NYC-MON is (Mons live on New York blocks, you become one's Caller), see the three starters by name, and find one action: join the waitlist. Below the fold the page answers the next two questions, "what is the H-Lynk" and "what do I do every day", then shows the hatch.

## Jobs per persona

| Persona | Job on this page | Risk |
|---|---|---|
| Teen Caller (13–15) | "Is this for me, and which starter would I get?" | A hero of brand art with no product in it leaves them guessing what the app does |
| Parent | "What is my kid signing up for? Is there pressure to play?" | Streak or countdown language reads as a nag; the care section has to say the egg waits |
| Returning lapsed player | "Is it out yet?" | A CTA that pretends the stores are live |

## Risks

1. **Spoilers.** Babies are fine on the site (Decision #6 puts the Baby name on the starter card), but Small, Mid and Max forms are not. Nothing past Baby appears.
2. **The current home is a demo.** It shows a "Spatial backend" runtime card and four district cards that repeat the segmented control. Neither helps a visitor.
3. **Night everywhere.** Decision #4 makes the site daylit by default with one dark band for the hatch. Today the whole page is a night city.
4. **The CTA target.** No store listing exists. The CTA goes to the waitlist (`/get`, W05), which another agent owns and has not shipped.
5. **Performance.** Two canvases (the district city and the H-Lynk) on one page. Both must mount after LCP and pause offscreen to keep mobile Lighthouse at 95 or better.

## Three usability questions

1. After five seconds on the hero, can a visitor say what a Mon is and what they'd do with one?
2. Can they name one starter without scrolling?
3. After the care section, can they say what happens if they don't open the app for a day? (Expected: nothing bad; the egg waits.)
