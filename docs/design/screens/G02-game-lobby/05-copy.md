# G02 Game lobby: copy

Owner: `ux-writer`. Inputs: `01-research.md`, `03-direction.md`, `04-components.md`; `docs/COPY_DECK.md` (voice, banned words, tone); Law 9; canon `docs/canon/GAMEPLAY_BIBLE_V12.md` line 76 ("NYC Rank — competitive citywide standing"). Every string is `voice: "ui"`. No character speaks on G02.

## Rules this screen follows

- "Continue your game" is the lobby's resume phrase. "Resume" is reserved for the in-game pill (G01). The two never swap.
- The ranking is named "NYC Rank" because canon names it (line 76). Nothing says what it measures, because no rule exists. No score unit, no "points", no "XP".
- Errors say what happened, then what to do (COPY_DECK Tone). No "oops", no blame, no countdown.
- "H-Lynk", never "device" (Law 9). "Caller", never "player" in visible copy; "players" appears nowhere.
- Sentence case everywhere. The one uppercase string is the START legend, a `type-tag` signage label (Decision in `03-direction.md`); its accessible name is sentence case.
- Max columns are iPhone SE estimates from COPY_DECK § Character limits (`type-title` ≈ 26, `type-body` ≈ 37, `type-label` on a button ≈ 34, `type-caption` ≈ 48).

## Identity

| ID | String | Voice | Max | Notes |
|---|---|---|---|---|
| `g02.identity.a11y` | NYC-Mon | ui | 8 | Accessible name of `BrandWordmark`; the image is the heading level 1 |
| `g02.screen.a11y` | Game lobby | ui | 12 | Screen title announced on focus (not drawn) |

## START (AngledStartButton)

| ID | String | Voice | Max | When |
|---|---|---|---|---|
| `g02.start.legend` | START | ui | 5 | Engraved legend, `type-tag`. Same glyphs in every state |
| `g02.start.a11y.new` | Start a new game | ui | 20 | Accessible name, new-game state |
| `g02.start.a11y.continue` | Continue your game | ui | 20 | Accessible name, eligible-save state |
| `g02.start.a11y.continue_district` | Continue your game, last seen in {district} | ui | 40 | Accessible name when the district is known |
| `g02.start.hint.new` | Creates your Caller's first game | ui | 34 | Hint; only on new-game |
| `g02.start.hint.continue` | Picks up exactly where you left off | ui | 34 | Hint |
| `g02.start.loading` | Opening the city | ui | 20 | Spoken once (polite) while the transition holds; nothing visible changes except the Rive loading state |
| `g02.start.a11y.recover` | Fix your last save | ui | 20 | Accessible name in resume-failed; the press opens the recovery dialog |

## Resume block

| ID | String | Voice | Max | When |
|---|---|---|---|---|
| `g02.resume.title.continue` | Continue your game | ui | 26 | eligible-save |
| `g02.resume.district` | Last seen in {district} | ui | 37 | eligible-save with a verified district. `{district}` is `DISTRICT_NAME` (Downtown, Midtown, Harlem, Mega City) |
| `g02.resume.title.new` | Start a new game | ui | 26 | new-game |
| `g02.resume.body.new` | Your first walk through the city starts here. | ui | 48 | new-game, `type-caption` |
| `g02.resume.offline` | You're offline. Your last save is on this H-Lynk. | ui | 48 | strip, offline with a valid snapshot |

## Resume failure and recovery

Shown as a `SignageBand size="strip"` under the resume block, and repeated as the body of the `ResponsiveDialog` START opens. Button labels start with a verb.

| ID | String | Voice | Max | Failure |
|---|---|---|---|---|
| `g02.resume.fail.dataset` | The city map changed since your last save. Your Mon and progress are safe. | ui | 2 lines | missing or incompatible dataset |
| `g02.resume.fail.dataset.action_primary` | Start from your last district | ui | 34 | puts the Caller at the saved district's entry point and says so; never silent |
| `g02.resume.fail.dataset.action_secondary` | Start a new game | ui | 34 | runs the new-game flow; the old save stays until the Caller confirms |
| `g02.resume.fail.unreadable` | Your last save couldn't be read. Your Mon and progress are safe on the server. | ui | 2 lines | save fails Zod validation; same family as M22 save-recovered |
| `g02.resume.fail.unreadable.action_primary` | Restore from the server | ui | 34 | |
| `g02.resume.fail.unreadable.action_secondary` | Not now | ui | 34 | closes; START stays in recover state |
| `g02.resume.fail.newer` | A newer save exists from another H-Lynk. This one wasn't written over. | ui | 2 lines | stale overwrite rejected (§3) |
| `g02.resume.fail.newer.action_primary` | Continue from the newer save | ui | 34 | |
| `g02.resume.fail.newer.action_secondary` | Keep this one | ui | 34 | marks the local snapshot as the chosen revision; the conflict rule in `WorldResumeService` decides whether that is allowed; if not, the button is absent |
| `g02.resume.fail.offline_none` | You're offline and there's no save on this H-Lynk yet. Connect once to pick up your game. | ui | 2 lines | offline, no local snapshot |
| `g02.resume.fail.generic` | Your game couldn't open. Try again, and if it keeps happening, restart the app. | ui | 2 lines | any `render-error` / unknown |
| `g02.resume.fail.generic.action_primary` | Try again | ui | 34 | |
| `g02.recovery.dialog.title` | Before you continue | ui | 26 | dialog title for every failure |

## NYC Rank panel

| ID | String | Voice | Max | State |
|---|---|---|---|---|
| `g02.rank.title` | NYC Rank | ui | 12 | header, every state |
| `g02.rank.a11y.region` | NYC Rank, {status} | ui | — | region label; `{status}` is the spoken status below |
| `g02.rank.self` | You | ui | 3 | own-row marker, replaces the rank-change slot |
| `g02.rank.loading` | Loading rankings | ui | 20 | spoken (polite) with three skeleton lines |
| `g02.rank.unavailable` | Rankings aren't live yet. | ui | 37 | default until a ranking authority ships |
| `g02.rank.unavailable.body` | When they are, your standing will show here. | ui | 48 | `type-caption` |
| `g02.rank.empty` | Nobody's ranked yet. | ui | 37 | authority exists, zero rows |
| `g02.rank.empty.self` | You'll be the first. | ui | 48 | `type-caption`, when the Caller is eligible to rank |
| `g02.rank.stale` | Last updated {age} ago | ui | 37 | strip under the header; `{age}` from `Timestamp` relative format |
| `g02.rank.stale.a11y` | Rankings may be out of date, last updated {age} ago | ui | — | |
| `g02.rank.error` | Rankings didn't load. | ui | 37 | |
| `g02.rank.error.action` | Try again | ui | 12 | `StatusRow` action |
| `g02.rank.row.a11y` | Rank {rank}, {name} | ui | — | row accessible label; score appended only when a unit exists |
| `g02.rank.row.self.a11y` | Rank {rank}, you | ui | — | |

Scores are never spoken or shown with a unit until the ranking authority names one; until then rows carry rank and name. A number without a meaning is a fake record (§3).

## Strings deliberately not written

- No "Welcome back", no streak line, no "while you were away" (D-15 c).
- No "Resume" on the lobby.
- No error copy for the world renderer's own states (`loading`, `empty`, `unsupported`): `GameStatusLayer` owns those after START.
- No explanation of how to rank. There is no rule to explain.

## Slopmonster gate

Command run 2026-10-15 from the SlopMonster checkout: `python3 tools/deslop.py --text "<all String cells above, one per line, placeholders filled with Harlem / 4 minutes / Mari>"`. Printed tail:

```
203 words of visible copy

  score 5/5  CLEAN
exit=0
```

The rival-model cleanse pass (`tools/cleanse.sh`) has not been run; the strings are one to two sentences each.
