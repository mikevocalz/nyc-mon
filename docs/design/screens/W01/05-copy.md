# W01 Home: copy

Skills: `design:ux-copy`, `no-ai-slop`, `slopmonster`. Rules: `docs/COPY_DECK.md` (sentence case, no exclamation marks, Caller never Callah in `ui`, H-Lynk never "device", Bloodline never "family"). Every string is `voice: "ui"`; the page has no character lines. Strings live in `apps/web/components/home/copy.ts`.

| ID | String | Source |
|---|---|---|
| `w01.hero.title` | Every block has a legend. | §5 slogan; CSS uppercases it |
| `w01.hero.body` | Mons live in New York, on the same blocks as you. They showed up less than ten years ago, and the city's still figuring them out. | `m02.p1.title` + `m02.p1.body`; `V11 ¶21`, `¶33`, `¶36`, `¶40` |
| `w01.hero.cta` | Join the waitlist | No store listing yet (§5 "waitlist"); goes to `/get` (W05) |
| `w01.hero.starters.label` | The three starters | `aria-label` on the quiet `ul` |
| `w01.hero.starters.*` | Squeaklet, Kittee Cee, Yotito | Decision #9 (Baby forms #002, #009, #062), from `@acme/content` |
| `w01.hero.district.label` | Pick a district | Visible label over the selector |
| `w01.hero.city.a11y` | {District} street grid, seen from above | Background label |
| `w01.hlynk.title` | The H-Lynk Core | Decision #16 |
| `w01.hlynk.body` | Dr. Alessandra Santoro hands you an H-Lynk Core: a red handheld with a black scanner across the top. It keeps you in touch with your Mon and helps with care. | Decisions #5, #8, #16; `V11 ¶23` ("communication/care/recovery") |
| `w01.hlynk.body2` | The bond is between you and your Mon. The H-Lynk doesn't own anyone. | Decision #8; `V11 ¶23` |
| `w01.hlynk.figure.label` | H-Lynk device | §5 requires `aria-label="H-Lynk device"` on the figure. "device" appears only in this spec-fixed label; flagged in `06-critique.md` |
| `w01.hlynk.caption` | H-Lynk Core, the entry tier. Red body, black scanner head. | Decision #16 |
| `w01.starters.title` | Three eggs. One of them hatches for you. | `m02.p2.title`; Decision #5 |
| `w01.starters.body` | Each comes from a Bloodline. Whoever's inside is their own person. | `m02.p2.body`; Decision #11; `V11 ¶42` |
| `w01.starters.card` | {Baby name} / {Bloodline label} / Hatches from the {egg name} | Decisions #6, #9, #11 |
| `w01.starters.dex` | No. {002} | Dex number of the Baby form (Decision #9) |
| `w01.care.title` | How care works | §5 |
| `w01.care.body` | Three meters, three things you do. Your Mon tells you what it needs with a look, a sound or a reach. | §2.1; `V11 ¶51` |
| `w01.care.feed` | Feed. Fills Fullness. Each Mon eats its own way. | §2.1, `V11 ¶51` |
| `w01.care.rest` | Rest. Lights down, your Mon sleeps and Energy comes back. | M15 |
| `w01.care.play` | Play. A short game together raises Social. | M16 |
| `w01.care.example` | Example meter levels | Visible note under the meters, so the numbers aren't read as live data |
| `w01.hatch.title` | Pick a time. The egg waits. | `V11 ¶49`; `M7 L388` (the egg waits) |
| `w01.hatch.body` | Incubation takes 15 minutes, 30 minutes or an hour. You get one notification when it's ready. | `V11 ¶49`, M23 |
| `w01.hatch.body2` | Then the Mon makes its choice. Its first look at you is how it says yes. | Decision #14 |

Slopmonster: run `deslop.py` on the String column before merge (see `06-critique.md`).
