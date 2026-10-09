# M17 Dex entry / Mon profile: research

Route `/(home)/mon/[id]` · Shell: none · States: default / photo mode / export done · Spec: brief §4.3 M17 ("Species card + individual sheet: nickname, hatched date, bond, lifecycle (Egg ✓, Baby ●, Small ○ …), likes, culture note (canon), Caller. Photo mode: transparent PNG export of the current pose."); Decisions #6, #9, #11, #12, #13; PS-005, PS-029; OPEN_QUESTIONS Q12, Q14, Q24, Q26, Q43.

## Jobs

- **Dani:** When I look at my Mon's page, I want to see who this individual is (name, when we met) and save a picture to show friends.
- **Sol (returning):** I want proof the Mon is the same one I hatched: the date, the name, the history.
- **Renée:** If my kid saves a picture, I want to know it is just the Mon, with no personal data in it.

## What exists (verified 2026-10-08)

| Field the brief asks for | Source | Status |
|---|---|---|
| Nickname | `MonInstance.nickname` (null before naming) | real |
| Hatched date | `MonInstance.hatchedAt` | real |
| Bond | `MonInstance.bond` (0..1) | stored; how it is shown is Q26, open |
| Lifecycle | `MonInstance.stage`; chain from `bloodlines` / `walkChain()` in `@acme/content` (Decision #12) | real |
| Likes | food favourites (Q24) | **missing content** |
| Culture note | `MonSpeciesDef.cultureNote` = null for all three (Q12, Q13) | **missing canon** |
| Caller | `save.caller` (`CallerProfileSchema`) | real |
| Species card | `dexId`, `formName`, `bloodlineName` (`bloodlineLabel()`) | real |
| Photo mode | no capture API in `packages/render`; `expo-media-library` and `expo-sharing` are not in `apps/mobile/package.json` | **needs native capability** |

## Risks

- **Spoilers.** The site names no Small, Mid or Max form (PS-029). The lifecycle row must show later stages as unnamed slots. This lane also leaves the three later stage words off (the brief's instruction for this screen), so the row reads Egg ✓, Baby ●, then three blank ○.
- **Empty canon rows.** Rendering "Culture: TODO" or a generic line invents canon or ships placeholder text (§0A.2).
- **A bond meter** without a defined stat turns into a grind target.
- **Photo mode privacy.** An exported PNG must carry no Caller name, location or date in pixels or metadata for under-13 accounts.
- **Pronouns.** PS-005: the gender field from Finch-style profiles is not shown (Q14 answered: unstated in Phase 1).

## Usability questions

1. Can players tell the species card (what all Squeaklets share) from the individual sheet (this one)?
2. Do players read the blank later-stage slots as "more to come" rather than "missing data"?
3. Can players save a photo and find it afterwards?
