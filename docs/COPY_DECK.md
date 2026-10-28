# NYC-MON copy deck

Owner: `ux-writer`. Scope today: M01–M07 (boot, welcome, auth, age, consent, notification sheet, Caller name) plus the M23 notification and the H-Lynk status chip. Each screen's strings live in `docs/design/screens/M0n/05-copy.md`. This file holds the rules they follow, the canon glossary, and the index of every string ID.

Authority: canon (`docs/canon/source/`, `docs/canon/DECISIONS.md`) outranks this deck. The lead's P rulings and the design D decisions (`docs/design/DECISIONS.md`) outrank screen-level choices. Laws: `CONTRIBUTING.md`, especially Law 1 (no invented canon), Law 8 (faint is never death) and Law 9 (language is canon).

## Two voices

Every string carries `voice: "ui" | "character"`.

**`ui`** is the app talking: labels, buttons, errors, hints, notifications, emails, accessibility text. It is the H-Lynk's voice and the studio's voice. It is plain, short and specific.

**`character`** is a named character speaking: a Mon, Santoro, Malik, anyone in the story. Character strings come from canon only. If canon has no line, the string is `TODO(canon)` and ships empty. Nobody writes a character line from a vibe (§2.3, Law 1).

M01–M07 contain no character strings. The one `character` slot (`m05.denied.santoro_line`) is `TODO(canon)`: v11 describes Dr. Santoro (`V11 ¶83`, `¶84`) but quotes no line from her. No Mon dialogue exists before the hatch, because no Mon exists (Decision #5), and Phase 1 Baby speech is open (Q32).

## Caller and Callah

- **Caller** in every `ui` string, in code and in data. It is the role (`V11 ¶19`, `¶109`).
- **Callah** only inside a `character` string, spoken by a character who would say it (`V11 ¶19`, `¶58`, `¶110`). Never in a label, button, title, hint, email or notification. The canon example is Ratti's "You ain't my Callah. I'm not listening to you." (`V11 ¶59`), which belongs to Malik's Ratti and is never reused for the player's Mon.
- The player is never "owner", "trainer", "user" or "master". A Mon is never "yours" in the sense of property (`V11 ¶38`, `¶123`). "Your Mon" is allowed: it is the same possessive as "your friend".

## Banned words in `ui` copy

| Never | Use | Source |
|---|---|---|
| device (for the H-Lynk) | H-Lynk | Law 9 |
| wild (Mon) | Hood Mon | Law 9, `V11 ¶21` |
| family, line (Dex grouping) | Bloodline | Law 9, Decision #11 |
| owner, trainer, user, master | Caller | `V11 ¶109`, `¶43` |
| catch, capture (a Mon), recruit | meet, partner | `V11 ¶43` ("Scanning is not recruitment") |
| dead, died, killed (a Mon) | fainted, only in combat, Phase 2 | Law 8, `V11 ¶27`, `¶115` |
| connecting to your Mon, loading your Mon | nothing, the LED reports state | Decision #8 |
| EngineX | nothing in M01–M07, a story reveal | `V11 ¶33`, `¶90`, Q40 |

## Tone

- **Lead with what the reader can do.** "You can keep playing" comes before "a parent needs to say yes" (M05).
- **Errors: what happened, then what to do.** No blame, no "oops", no "invalid input". A cancelled Apple or Google sheet shows nothing. The player chose to close it.
- **No pressure.** No countdowns, no "hurry", no streak guilt, no "your egg misses you". The egg waits (`M7 L388`). This follows Zagal et al. on playing by appointment (https://www.diva-portal.org/smash/get/diva2:1043332/FULLTEXT01.pdf) and ICO Children's Code standard 13 on nudges (https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/).
- **Promise only what ships.** One notification per egg (M23), so the copy says one. Nothing about features that are not in Phase 1.
- **Sentence case everywhere**, buttons included (`docs/DESIGN_SYSTEM.md` type rules). No all-caps, no exclamation marks in `ui` copy.
- **Buttons start with a verb** and say what happens: "Send email", "Use this name", "Turn on notifications". "Continue" only where the next step is the whole point (M04).

## NYC cadence without stereotype

v11: "Dialogue should preserve character-specific NYC cadence, stress, slang and code-switching when appropriate without making every Black, Latino or New Yorker sound the same." (`V11 ¶60`). Culture is biography and community, not species (`V11 ¶53`).

- **Cadence lives in character strings, from canon, per individual.** Slang, dialect spelling and code-switching belong to named characters whose canon gives them that voice. None of it goes into `ui` copy.
- **The `ui` voice sounds like the city through brevity, not dialect.** Short declaratives, contractions, a direct second person: "The city's still figuring them out." "That's their call." It never spells out an accent, never drops in "yo", "deadass", "fam" or Spanglish to sound local.
- **No Bloodline speaks for a community.** A Bloodline caption is a label, never a culture note. "Yotes carry a Latino family identity" (`V11 ¶53`) is canon for the story. The UI does not put it on a caption, and a Yote's individual culture is written only when canon covers that individual.
- **Places are real and specific** (`V11 ¶40`, `¶41`): a Harlem stoop, a bodega, a block. Alt text names the street type and borough and never who lives there.

## Age-appropriate

The fiction stars 14–15-year-olds. Players include under-13s (§1.5).

- Short sentences and common words. Under-13 screens (M05, M07 under-13 hints) aim for words a 9-year-old reads easily.
- Never frighten. A Mon is never shown deleted, hurt or abandoned (Law 8, Decision #15).
- **The age gate is neutral** (FTC COPPA FAQ D.7, H.3: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions). No default year, no example year, no "13", no "old enough", no confirmation that only some answers trigger. Every M04 string is the same for every answer.
- **Consent copy has no villain.** The child did nothing wrong and the parent who says no made a fair call (M05).
- Under-13s are steered to nicknames (M07). No real name, photo or child email is asked for anywhere.

## Accessibility text

- Every icon-only control has a label. Every non-obvious action has a hint that says what happens, not how to gesture.
- Status is never colour alone: the H-Lynk LED always has a text chip (`hlynk.led.*`, D3).
- Polite announcements for loading and success. Nothing assertive except errors.
- Reduced motion never changes copy. Each screen's file confirms this.

## Character limits

Limits in each `05-copy.md` are measured for iPhone SE (375 pt wide, 16 pt gutters, 343 pt text width) at default Dynamic Type, from the type scale in `docs/DESIGN_SYSTEM.md`: `type-station` 34 pt holds about 13 characters a line, `type-title` 24 pt about 26, `type-body` 17 pt about 37, `type-label` on a full-width button about 34, `type-caption` 13 pt about 48. They are estimates from average glyph width. `accessibility-review` checks them on device at XXL.

## Glossary

| Term | Use in UI | Source |
|---|---|---|
| Mon | A being in the NYC-MON world, a person in the story, never inventory | `V11 ¶42`, `¶43`, `¶123` |
| Caller | A human in a genuine partnership with a Mon. The player's role | `V11 ¶19`, `¶109` |
| Callah | Character pronunciation of Caller. Character strings only | `V11 ¶19`, `¶58`, `¶110` |
| Hood Mon | A free-living Mon with no current Caller. "Hood" in dialogue. Not hostile or lesser | `V11 ¶21`, `¶111` |
| H-Lynk | "Hood Link", in canon's words "optional communication/care/recovery hardware". Not proof of ownership or partnership | `V11 ¶22`, `¶23`, `¶112` |
| H-Lynk Core | The Entry tier, the app's chrome. Red body, black scanner head | Decision #16 |
| Bloodline | A Dex family, in UI and data. Label: "{bloodlineName} Bloodline" | Decision #11 |
| Hood Ratti Bloodline | F01 | Decision #11, `ROSTER L150` |
| Bodega Baddiee Cee Bloodline | F02. UI label. Story copy may say "Bodega Cee" | Decisions #11, #13, `ROSTER L157`, `V11 ¶76` |
| Yote Bloodline | F12 | Decision #11, `ROSTER L210` |
| Metro Egg, Corner Egg, Prism Egg | #001, #008, #061, the three starter eggs. Names only until Q11 rules on egg skins | Decision #9 |
| Squeaklet, Kittee Cee, Yotito | #002, #009, #062, the Babies. Never shown before the hatch | Decision #9, P3 |
| Dr. Alessandra Santoro | Chemistry teacher, former biochemist, H-Lynk inventor and mentor. Presents the eggs, keeps a Mon safe if consent is denied. No canon dialogue yet | `V11 ¶83`, `¶84`, Decisions #5, #15 |
| Egg, Baby, Small, Mid, Max | The five stages. Phase 1 reaches Baby | `V11 ¶25`, `¶46` |
| Incubation | 15 minutes, 30 minutes or 1 hour, a notification when ready | `V11 ¶49` |
| Energy, Fullness, Social | The three care meters | `V11 ¶51` |
| Faint | Recoverable 0-HP battle state, never death. Not used in Phase 1 copy | `V11 ¶27`, `¶115`, Law 8 |
| Scanning | Exists in canon, not in Phase 1. "Scanning is not recruitment" | `V11 ¶43` |
| NYC-MON | The app's name in notifications, email sender and legal copy | — |

## Open copy questions

1. **"Scanning isn't recruiting" (M02 panel 3).** Variant A (default) leaves it out. Variant B carries it. Run the comprehension test in `docs/design/research/HALLWAY_TESTS.md` milestone 1 task 2. Ship B only if testers can say what it means without help.
2. **Denied consent with an egg in the case (M05).** Decision #15 covers a hatched Mon only. `TODO(canon)` for Mike.
3. **Expired consent with a hatched Mon (M05).** Same effect as denied, or does the Mon stay local until a new answer? Lead, plus the retention window `{days}`.
4. **Offline at consent Send (M05).** Can the child continue with the email queued?
5. **Consent method (M05 email).** Email plus or stronger is counsel's call (ADR 0001). The email's links change with it. The data list in `mail.consent.body.keep` needs counsel to confirm against the data model.
6. **Create by passkey (M03).** Better Auth's passkey plugin registers a passkey on an existing account. Whether "Make a passkey" can create an account on its own needs platform to confirm. If not, the create intent hides it.
7. **Caller name: changeable later, digits allowed, wrong-block reporting (M07).** None is decided. The copy promises none of them.
8. **Santoro's words (M05 denied).** No canon line exists. `TODO(canon)` until the Voice Identity and Dialogue Bible v11 lands.

## Slopmonster gate

Every screen's String cells pass the copy lint at 5/5: M01, M02, M03, M04, M05, M06, M07. This file's prose (above the index, code spans and URLs stripped) also scores 5/5. The rival-model cleanse step (`tools/cleanse.sh`) has not been run on any of them.

## String index

Every string ID in M01–M07, generated from the screen files. Shared namespaces: `hlynk.*` (shell and status chip, defined in M01), `m23.*` (the hatch notification, defined in M06), `m11.*` (M11 status rows that M06 triggers), `mail.*` (server email: verification and reset in M03, consent in M05).

| ID | Defined in | Voice | Status |
|---|---|---|---|
| `m01.a11y.power_on` | `screens/M01/05-copy.md` | ui | drafted |
| `hlynk.key.home.label` | `screens/M01/05-copy.md` | ui | drafted |
| `hlynk.key.menu.label` | `screens/M01/05-copy.md` | ui | drafted |
| `hlynk.key.back.label` | `screens/M01/05-copy.md` | ui | drafted |
| `hlynk.key.forward.label` | `screens/M01/05-copy.md` | ui | drafted |
| `hlynk.trackpad.label` | `screens/M01/05-copy.md` | ui | drafted |
| `hlynk.state.disabled.hint` | `screens/M01/05-copy.md` | ui | drafted |
| `hlynk.led.incubating` | `screens/M01/05-copy.md` | ui | drafted |
| `hlynk.led.ready` | `screens/M01/05-copy.md` | ui | drafted |
| `hlynk.led.needs_you` | `screens/M01/05-copy.md` | ui | drafted |
| `hlynk.led.a11y` | `screens/M01/05-copy.md` | ui | drafted |
| `m02.carousel.label` | `screens/M02/05-copy.md` | ui | drafted |
| `m02.skip` | `screens/M02/05-copy.md` | ui | drafted |
| `m02.skip.a11y.hint` | `screens/M02/05-copy.md` | ui | drafted |
| `m02.next` | `screens/M02/05-copy.md` | ui | drafted |
| `m02.prev.a11y.label` | `screens/M02/05-copy.md` | ui | drafted |
| `m02.next.a11y.label` | `screens/M02/05-copy.md` | ui | drafted |
| `m02.progress.a11y` | `screens/M02/05-copy.md` | ui | drafted |
| `m02.p1.title` | `screens/M02/05-copy.md` | ui | drafted |
| `m02.p1.body` | `screens/M02/05-copy.md` | ui | drafted |
| `m02.p1.image.alt` | `screens/M02/05-copy.md` | ui | drafted |
| `m02.p2.title` | `screens/M02/05-copy.md` | ui | drafted |
| `m02.p2.body` | `screens/M02/05-copy.md` | ui | drafted |
| `m02.p2.caption.f01` | `screens/M02/05-copy.md` | ui | drafted |
| `m02.p2.caption.f02` | `screens/M02/05-copy.md` | ui | drafted |
| `m02.p2.caption.f12` | `screens/M02/05-copy.md` | ui | drafted |
| `m02.p2.image.alt` | `screens/M02/05-copy.md` | ui | drafted |
| `m02.p3.title` | `screens/M02/05-copy.md` | ui | drafted |
| `m02.p3.body.a` | `screens/M02/05-copy.md` | ui | drafted |
| `m02.p3.body.b` | `screens/M02/05-copy.md` | ui | drafted |
| `m02.p3.image.alt` | `screens/M02/05-copy.md` | ui | drafted |
| `m02.p3.cta.primary` | `screens/M02/05-copy.md` | ui | drafted |
| `m02.p3.cta.primary.a11y.hint` | `screens/M02/05-copy.md` | ui | drafted |
| `m02.p3.cta.secondary` | `screens/M02/05-copy.md` | ui | drafted |
| `m02.p3.cta.secondary.a11y.hint` | `screens/M02/05-copy.md` | ui | drafted |
| `m02.status.offline` | `screens/M02/05-copy.md` | ui | drafted |
| `m03.title.create` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.title.sign_in` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.subtitle.create` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.subtitle.sign_in` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.switch.to_create` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.switch.to_sign_in` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.back.a11y.label` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.provider.apple.label.create` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.provider.apple.label.sign_in` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.provider.google.label.create` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.provider.google.label.sign_in` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.provider.passkey.label.create` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.provider.passkey.label.sign_in` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.provider.passkey.a11y.hint.ios` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.provider.passkey.a11y.hint.android` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.provider.email.label` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.provider.apple.loading` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.provider.google.loading` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.provider.passkey.loading` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.email.loading` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.email.loading.create` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.email.field.label` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.password.field.label` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.password.field.hint.create` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.password.show.a11y.label` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.password.hide.a11y.label` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.email.submit.create` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.email.submit.sign_in` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.password.forgot` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.error.apple.cancelled` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.error.apple.failed` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.error.google.cancelled` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.error.google.failed` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.error.passkey.cancelled` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.error.passkey.not_found` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.error.passkey.failed` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.error.email.invalid` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.error.credentials` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.error.password.too_short` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.error.password.too_long` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.error.account_exists` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.error.not_verified` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.error.offline` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.error.server` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.error.needs_age` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.verify.title` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.verify.body` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.verify.resend` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.verify.change_email` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.verify.resent` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.verify.resend.wait` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.verify.stuck` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.reset.title` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.reset.body` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.reset.submit` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.reset.sent` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.reset.unavailable` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.legal.notice.create` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.legal.terms` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.legal.privacy` | `screens/M03/05-copy.md` | ui | drafted |
| `m03.legal.children` | `screens/M03/05-copy.md` | ui | drafted |
| `mail.verify.subject` | `screens/M03/05-copy.md` | ui | drafted |
| `mail.verify.body` | `screens/M03/05-copy.md` | ui | drafted |
| `mail.reset.subject` | `screens/M03/05-copy.md` | ui | drafted |
| `mail.reset.body` | `screens/M03/05-copy.md` | ui | drafted |
| `m04.title` | `screens/M04/05-copy.md` | ui | drafted |
| `m04.why` | `screens/M04/05-copy.md` | ui | drafted |
| `m04.back.a11y.label` | `screens/M04/05-copy.md` | ui | drafted |
| `m04.grid.decades.a11y.label` | `screens/M04/05-copy.md` | ui | drafted |
| `m04.decade.label` | `screens/M04/05-copy.md` | ui | drafted |
| `m04.decade.a11y.hint` | `screens/M04/05-copy.md` | ui | drafted |
| `m04.grid.years.a11y.label` | `screens/M04/05-copy.md` | ui | drafted |
| `m04.year.label` | `screens/M04/05-copy.md` | ui | drafted |
| `m04.year.a11y.selected` | `screens/M04/05-copy.md` | ui | drafted |
| `m04.change_decade` | `screens/M04/05-copy.md` | ui | drafted |
| `m04.select.placeholder` | `screens/M04/05-copy.md` | ui | drafted (the year Select's blank prompt; the grid, decade and typed-field keys are unused since 2026-10-27) |
| `m04.type_instead` | `screens/M04/05-copy.md` | ui | drafted |
| `m04.field.label` | `screens/M04/05-copy.md` | ui | drafted |
| `m04.field.hint` | `screens/M04/05-copy.md` | ui | drafted |
| `m04.pick_instead` | `screens/M04/05-copy.md` | ui | drafted |
| `m04.error.incomplete` | `screens/M04/05-copy.md` | ui | drafted |
| `m04.error.future` | `screens/M04/05-copy.md` | ui | drafted |
| `m04.error.too_early` | `screens/M04/05-copy.md` | ui | drafted |
| `m04.continue` | `screens/M04/05-copy.md` | ui | drafted |
| `m04.continue.a11y.hint` | `screens/M04/05-copy.md` | ui | drafted |
| `m05.ask.title` | `screens/M05/05-copy.md` | ui | drafted |
| `m05.ask.body` | `screens/M05/05-copy.md` | ui | drafted |
| `m05.field.label` | `screens/M05/05-copy.md` | ui | drafted |
| `m05.field.hint` | `screens/M05/05-copy.md` | ui | drafted |
| `m05.preview.toggle` | `screens/M05/05-copy.md` | ui | drafted |
| `m05.preview.toggle.a11y.hint` | `screens/M05/05-copy.md` | ui | drafted |
| `m05.send` | `screens/M05/05-copy.md` | ui | drafted |
| `m05.send.loading` | `screens/M05/05-copy.md` | ui | drafted |
| `m05.error.email.invalid` | `screens/M05/05-copy.md` | ui | drafted |
| `m05.error.offline` | `screens/M05/05-copy.md` | ui | drafted |
| `m05.error.server` | `screens/M05/05-copy.md` | ui | drafted |
| `m05.sent.title` | `screens/M05/05-copy.md` | ui | drafted |
| `m05.sent.body` | `screens/M05/05-copy.md` | ui | drafted |
| `m05.sent.continue` | `screens/M05/05-copy.md` | ui | drafted |
| `m05.sent.resend` | `screens/M05/05-copy.md` | ui | drafted |
| `m05.sent.change_email` | `screens/M05/05-copy.md` | ui | drafted |
| `m05.sent.resent` | `screens/M05/05-copy.md` | ui | drafted |
| `m05.badge.pending` | `screens/M05/05-copy.md` | ui | drafted |
| `m05.badge.pending.a11y` | `screens/M05/05-copy.md` | ui | drafted |
| `m05.approved.toast` | `screens/M05/05-copy.md` | ui | drafted |
| `m05.denied.title` | `screens/M05/05-copy.md` | ui | drafted |
| `m05.denied.title.unnamed` | `screens/M05/05-copy.md` | ui | drafted |
| `m05.denied.body.reason` | `screens/M05/05-copy.md` | ui | drafted |
| `m05.denied.body.mon` | `screens/M05/05-copy.md` | ui | drafted |
| `m05.denied.body.data` | `screens/M05/05-copy.md` | ui | drafted |
| `m05.denied.body.later` | `screens/M05/05-copy.md` | ui | drafted |
| `m05.denied.close` | `screens/M05/05-copy.md` | ui | drafted |
| `m05.denied.illustration.alt` | `screens/M05/05-copy.md` | — | TODO(canon) |
| `m05.denied.santoro_line` | `screens/M05/05-copy.md` | character | TODO(canon) |
| `m05.denied.title.no_mon` | `screens/M05/05-copy.md` | ui | drafted |
| `m05.denied.body.no_mon` | `screens/M05/05-copy.md` | ui | drafted |
| `m05.denied.title.egg` | `screens/M05/05-copy.md` | ui | TODO(canon) |
| `m05.expired.title` | `screens/M05/05-copy.md` | ui | drafted |
| `m05.expired.body` | `screens/M05/05-copy.md` | ui | drafted |
| `m05.expired.body.mon` | `screens/M05/05-copy.md` | ui | drafted |
| `m05.expired.send_again` | `screens/M05/05-copy.md` | ui | drafted |
| `m05.expired.close` | `screens/M05/05-copy.md` | ui | drafted |
| `mail.consent.from_name` | `screens/M05/05-copy.md` | ui | drafted |
| `mail.consent.subject` | `screens/M05/05-copy.md` | ui | drafted |
| `mail.consent.body.intro` | `screens/M05/05-copy.md` | ui | drafted |
| `mail.consent.body.what` | `screens/M05/05-copy.md` | ui | drafted |
| `mail.consent.body.keep` | `screens/M05/05-copy.md` | ui | drafted |
| `mail.consent.body.dont` | `screens/M05/05-copy.md` | ui | drafted |
| `mail.consent.body.no` | `screens/M05/05-copy.md` | ui | drafted |
| `mail.consent.body.silence` | `screens/M05/05-copy.md` | ui | drafted |
| `mail.consent.link.yes` | `screens/M05/05-copy.md` | ui | drafted |
| `mail.consent.link.no` | `screens/M05/05-copy.md` | ui | drafted |
| `mail.consent.link.notice` | `screens/M05/05-copy.md` | ui | drafted |
| `mail.consent.footer` | `screens/M05/05-copy.md` | ui | drafted |
| `m23.notification.title` | `screens/M06/05-copy.md` | ui | drafted |
| `m23.notification.body` | `screens/M06/05-copy.md` | ui | drafted |
| `m06.preview.app_name` | `screens/M06/05-copy.md` | ui | drafted |
| `m06.preview.time` | `screens/M06/05-copy.md` | ui | drafted |
| `m06.preview.a11y.label` | `screens/M06/05-copy.md` | ui | drafted |
| `m06.title` | `screens/M06/05-copy.md` | ui | drafted |
| `m06.body.15` | `screens/M06/05-copy.md` | ui | drafted |
| `m06.body.30` | `screens/M06/05-copy.md` | ui | drafted |
| `m06.body.60` | `screens/M06/05-copy.md` | ui | drafted |
| `m06.cta.allow` | `screens/M06/05-copy.md` | ui | drafted |
| `m06.cta.later` | `screens/M06/05-copy.md` | ui | drafted |
| `m06.grabber.a11y.label` | `screens/M06/05-copy.md` | ui | drafted |
| `m06.granted.a11y.announce` | `screens/M06/05-copy.md` | ui | drafted |
| `m11.status.notify_off` | `screens/M06/05-copy.md` | ui | drafted |
| `m11.status.notify_off.action.ask` | `screens/M06/05-copy.md` | ui | drafted |
| `m11.status.notify_off.action.settings` | `screens/M06/05-copy.md` | ui | drafted |
| `m11.status.notify_off.action.settings.a11y.hint` | `screens/M06/05-copy.md` | ui | drafted |
| `m11.status.schedule_failed` | `screens/M06/05-copy.md` | ui | drafted |
| `m07.title` | `screens/M07/05-copy.md` | ui | drafted |
| `m07.field.label` | `screens/M07/05-copy.md` | ui | drafted |
| `m07.field.hint` | `screens/M07/05-copy.md` | ui | drafted |
| `m07.field.hint.under13` | `screens/M07/05-copy.md` | ui | drafted |
| `m07.field.hint.pending` | `screens/M07/05-copy.md` | ui | drafted |
| `m07.field.clear.a11y.label` | `screens/M07/05-copy.md` | ui | drafted |
| `m07.plate.a11y.label` | `screens/M07/05-copy.md` | ui | drafted |
| `m07.continue` | `screens/M07/05-copy.md` | ui | drafted |
| `m07.continue.a11y.hint.disabled` | `screens/M07/05-copy.md` | ui | drafted |
| `m07.back.a11y.label` | `screens/M07/05-copy.md` | ui | drafted |
| `m07.error.blank` | `screens/M07/05-copy.md` | ui | drafted |
| `m07.error.too_long` | `screens/M07/05-copy.md` | ui | drafted |
| `m07.error.characters` | `screens/M07/05-copy.md` | ui | drafted |
| `m07.error.blocked` | `screens/M07/05-copy.md` | ui | drafted |
| `m07.confirmed.a11y.announce` | `screens/M07/05-copy.md` | ui | drafted |


## M09 — the nickname is optional

A Mon is always its species (Squeaklet, Lil' Ratti). A nickname is an extra
the Caller may add; it shows next to the species name and never replaces it
in the data (`MonInstance.nickname`, null when there is none). After the
hatch, the 3D Baby on the H-Lynk asks once: **Give {formName} a nickname?**
with **Yes** and **No**. No is the default and the trackpad's action; it goes
to M13 with no nickname. Yes opens the text field. Either answer is recorded,
so boot never sends the Caller back to the question
(`BootSnapshot.nicknamePromptSeen`). The strings are in
`screens/M09/05-copy.md`.

| ID | Defined in | Voice | Status |
|---|---|---|---|
| `m09.ask.title` | `screens/M09/05-copy.md` | ui | drafted |
| `m09.ask.body` | `screens/M09/05-copy.md` | ui | drafted |
| `m09.ask.yes` | `screens/M09/05-copy.md` | ui | drafted |
| `m09.ask.no` | `screens/M09/05-copy.md` | ui | drafted |
| `m09.ask.no.a11y.hint` | `screens/M09/05-copy.md` | ui | drafted |
| `m09.ask.yes.a11y.hint` | `screens/M09/05-copy.md` | ui | drafted |
| `m09.skipped.a11y.announce` | `screens/M09/05-copy.md` | ui | drafted |
| `m09.edit.cancel` | `screens/M09/05-copy.md` | ui | drafted |

## M24 — final permission review (first incubation only)

The final step is **Get your H-Lynk ready**, after M10 starts the first egg.
Only an explicit tap on **Turn on egg alert** opens a system prompt.
Camera/AR, voice/microphone and foreground location are disclosed here but
requested only when their respective experience is opened. Photos, calendar,
Bluetooth and other privileged access are contextual. The Caller may finish
with no permissions. A declined notification must never block hatching,
gameplay, or the onboarding completion checkpoint. The egg-ready push stays
one local notification per egg. Parental consent is a separate gate.

Source of copy: `packages/app/features/onboarding/copy.ts`, `m24.*`.

## Graphics quality (game settings)

The world renders at one of three tiers; the setting lives on the game's
settings surface next to Game controls (G03's sibling). Every string is
`voice: "ui"`, namespace `settings.graphics.*`. Rules that apply: sentence
case, lead with what the Caller can do, promise only what ships, status is
never colour alone.

| ID | String | Voice | Status |
|---|---|---|---|
| `settings.graphics.label` | Graphics | ui | drafted |
| `settings.graphics.caption` | How the city looks and how hard the phone works to draw it. | ui | drafted |
| `settings.graphics.auto` | Auto | ui | drafted |
| `settings.graphics.performance` | Performance | ui | drafted |
| `settings.graphics.quality` | Quality | ui | drafted |
| `settings.graphics.auto.desc` | Follows what the phone can hold steady. The city stays detailed until the frame rate drops. | ui | drafted |
| `settings.graphics.performance.desc` | Lighter detail and a lower render scale, for the smoothest frame. | ui | drafted |
| `settings.graphics.quality.desc` | Full detail, reflections and lit rooms. May run slower on older phones. | ui | drafted |
| `settings.graphics.render_scale.note` | In Auto the city can draw at a lower resolution to keep the frame steady. It never drops below half. | ui | drafted |
| `settings.graphics.reduced.note` | Reduced motion is on. Animated glow and shimmer stay off. | ui | drafted |
| `settings.graphics.reduced.action` | Change | ui | drafted |
| `settings.graphics.reduced.action.a11y.hint` | Opens system settings | ui | drafted |

Notes:

- **Reduced motion is honoured, not offered.** There is no in-app motion
  toggle; the `settings.graphics.reduced.*` status row appears only when the
  OS reports reduced motion, the same pattern as `g03.reduced.*`. Reduced
  motion never changes copy.
- **No pressure in the descriptions.** The tiers say what each does, not
  which is best. Auto is the default and the recommended row carries no
  badge, star or "best" label.
- **Render scale is explained, not buried.** The note sits under the
  control so a Caller on Performance knows the softness is the setting
  working, not a broken screen.

## Battery and frame rate (game settings)

The performance pass adds two controls beside Graphics on the same
settings surface (PR 4's frame-rate request, PR 5's heat handling). Every
string is `voice: "ui"`, namespaces `settings.framerate.*` and
`settings.battery.*`. The Graphics section's rules apply: sentence case,
lead with what the Caller can do, promise only what ships, status is
never colour alone.

| ID | String | Voice | Status |
|---|---|---|---|
| `settings.framerate.label` | Frame rate | ui | drafted |
| `settings.framerate.caption` | How often the screen draws a new frame. Higher looks smoother and uses more battery. | ui | drafted |
| `settings.framerate.auto` | Match the screen | ui | drafted |
| `settings.framerate.auto.desc` | Asks for the fastest rate the city can hold steady. Never above it — swinging frames feel worse than a steady one. | ui | drafted |
| `settings.framerate.sixty` | 60 fps | ui | drafted |
| `settings.framerate.sixty.desc` | A steady 60 on any screen. The battery-friendlier pick on fast displays. | ui | drafted |
| `settings.battery.label` | Battery | ui | drafted |
| `settings.battery.caption` | Lighter detail and a lower frame rate use less power and keep the phone cooler. | ui | drafted |
| `settings.battery.saver` | Battery saver | ui | drafted |
| `settings.battery.saver.desc` | Holds the city on the lighter tier and a steady 60 frames a second. | ui | drafted |
| `settings.battery.thermal.note` | The phone is running warm, so the city eased off to keep the frame steady. | ui | drafted |

Notes:

- **"The phone", never "device"** for the hardware; "H-Lynk" stays for
  the in-fiction unit (Law 9, same as `g03.haptics.unsupported`).
- **No rate the city can't hold.** The auto option describes the spec's
  rule — request only rates the build holds — without promising a number
  the Duo 1 can't reach. No option names 90 or 120; the screen decides
  (PR 4).
- **The thermal note is a status, not a warning.** It follows the
  `settings.graphics.reduced.*` StatusRow pattern: it appears only while
  the OS reports the phone is warm (PR 5's Thermal API step-down), names
  what happened and why, and carries no action — there's nothing for the
  Caller to do.
- **Battery saver is one switch, not a second tier picker.** It composes
  the existing settings (lighter tier, capped rate) rather than adding a
  fourth graphics tier — the Graphics section keeps three.
- **Reduced motion never changes copy** — these strings are identical
  under reduced motion.

## City data credits (dataset v3)

The "Legal & credits" card in Settings (`settings-content.tsx`) gains rows
when the bundled tile is v3: `map-data-credit.ts` becomes a list derived
from the tile's `sources`, and each source renders name, what it supplied
and its licence link. Every string is `voice: "ui"`, namespace
`settings.legal.*`. Status: **drafted** — this is the G7 draft; Mike
reviews before it ships. Rules that apply: sentence case, lead with what
the reader can do, promise only what the record backs.

| ID | String | Voice | Status |
|---|---|---|---|
| `settings.legal.title` | Legal & credits | ui | shipped |
| `settings.legal.citydata.group` | City data | ui | drafted |
| `settings.legal.citydata.attribution` | © OpenStreetMap contributors | ui | shipped |
| `settings.legal.citydata.body` | NYC-Mon's 3D city uses OpenStreetMap data under the Open Database License (ODbL 1.0). | ui | shipped |
| `settings.legal.citydata.valdrada.name` | Valdrada | ui | drafted |
| `settings.legal.citydata.valdrada.line` | A real-data, real-time digital twin of New York City, maintained by Mehmet Kerem Turkcan. | ui | drafted |
| `settings.legal.citydata.valdrada.cite` | Turkcan, M. K. (2026). Valdrada: a real-data, real-time digital twin of New York City (version 0.4.0). | ui | drafted |
| `settings.legal.citydata.sources.lead` | Valdrada compiles these NYC records: | ui | drafted |
| `settings.legal.citydata.src.footprints` | Building Footprints — building shapes, roof heights, ground elevation | ui | drafted |
| `settings.legal.citydata.src.pluto` | PLUTO — floor counts, year built, building class | ui | drafted |
| `settings.legal.citydata.src.fisp` | DOB NOW safety filings — facade materials | ui | drafted |
| `settings.legal.citydata.src.cscl` | Street Centerlines — road shape, width, lanes, names | ui | drafted |
| `settings.legal.citydata.src.trees` | 2015 Street Tree Census — street trees | ui | drafted |
| `settings.legal.citydata.src.hydrants` | Hydrants — hydrant locations | ui | drafted |
| `settings.legal.citydata.src.shelters` | Bus Stop Shelters — shelter locations | ui | drafted |
| `settings.legal.citydata.src.linknyc` | LinkNYC — kiosk locations | ui | drafted |
| `settings.legal.citydata.src.subway` | MTA subway entrances — station stairs | ui | drafted |
| `settings.legal.citydata.src.bikeracks` | CityRacks — bike rack locations | ui | drafted |
| `settings.legal.citydata.link.osm` | View OpenStreetMap copyright | ui | drafted |
| `settings.legal.citydata.link.odbl` | View the ODbL 1.0 licence | ui | drafted |
| `settings.legal.citydata.link.valdrada` | View the Valdrada repository | ui | drafted |
| `settings.legal.citydata.link.dataset` | View the record on NYC Open Data | ui | drafted |

The BibTeX for Valdrada, verbatim from its README — for docs and the
citation link target, not rendered in the UI:

```bibtex
@software{turkcan2026valdrada,
  author  = {Turkcan, Mehmet Kerem},
  title   = {{Valdrada}: a real-data, real-time digital twin of New York City},
  year    = {2026},
  version = {0.4.0},
  url     = {https://github.com/mkturkcan/valdrada}
}
```

Notes:

- **The group label changes with the tile.** "City data" replaces the
  existing "Map data" caption only when the bundled tile is v3; the v1/v2
  copy above (`attribution`, `body`) is untouched and stays what older
  tiles show. `settings.legal.citydata.attribution`/`body` are the shipped
  strings — they are still accurate on v3 (OSM data is inside the Valdrada
  tile), so they are repeated here rather than rewritten.
- **Records are named by what they gave us.** Each `src.*` row says what
  the tile took from that record set — nothing more. The FISP row says
  "facade materials", not "wall types" or "fire risk"; the PLUTO row says
  "floor counts", not "storeys" or "use". What a source did not supply is
  never implied. Source ids and URLs live in `map-data-credit.ts` and the
  tile's `sources`, not in the strings.
- **No claim about style.** STYLE ids are a classification over records,
  not a record — no credit row says "architecture" or "facade style comes
  from the city". The `e` provenance bits carry that distinction in data;
  the credit copy does not try to.
- **Link labels are verb-first** ("View …"), sentence case, one per
  licence or source. Every row's link gets a screen-reader label; the
  a11y review (§6.1 #6) checks targets and contrast.
- **MTA's entrances live on data.ny.gov**, not NYC Open Data — the shared
  `link.dataset` label reads "NYC Open Data" and the MTA row needs its own
  variant at implementation ("View the record on NY Open Data") or the
  shared label generalises. Flagged for the implementer; not decided here.
- **No lobby loading copy ships from this deck.** G5 keeps the dataset
  bundled, so the lobby's existing progress state stays; if G5 moves it to
  a fetch, lobby strings land then, not preemptively.

## Time of day and quality tiers (Slop-grade city)

Lane A1/F2, 2026-10-27, for `docs/plans/slop-grade-city-prompt.md` §6.1 #4. Skill: `design:ux-copy`, loaded through the Skill tool and applied with the `no-ai-slop` rules. Every string is `voice: "ui"`. The deck's rules apply: sentence case, lead with what the Caller can do, promise only what ships, status is never colour alone. Status **drafted** on every row; none ships before its UI lane builds it and the flag (`EXPO_PUBLIC_WORLD_PHYSICAL`) is on.

### Time of day

Gate G2's default (D19): Slop's four presets, `twilight` first. The control is a fourth row on the graphics settings surface; the HUD gains nothing in this lane (`docs/design/research/slop-grade-city-mobbin.md` §§ 2–3). Namespace `game.timeofday.*`.

| ID | String | Voice | Max | Status |
|---|---|---|---|---|
| `game.timeofday.label` | Time of day | ui | 16 | drafted |
| `game.timeofday.twilight` | Dusk | ui | 12 | drafted |
| `game.timeofday.golden` | Golden hour | ui | 12 | drafted |
| `game.timeofday.midday` | Midday | ui | 12 | drafted |
| `game.timeofday.midnight` | Night | ui | 12 | drafted |
| `game.timeofday.a11y.value` | {label}, {n} of 4 | ui | 24 | drafted |
| `game.timeofday.a11y.hint` | Changes the light in the city. Your game is not affected. | ui | 60 | drafted |

Notes:

- **Labels name the light.** Slop's buttons say "Golden Hour", "Sunny Midday", "Blue Hour" and "Night 23:00" (`index.html` `data-time` titles). A clock time promises a sim clock this lane doesn't have, so no row names an hour.
- **`twilight` reads "Dusk".** D17 calls the city's canon look dusk and `handoff/realism.md` § Time of day already uses Morning / Dusk / Night. "Blue hour" is a photographer's term the rest of the app never uses.
- **Order is fixed: Dusk, Golden hour, Midday, Night.** Dusk leads because it is the default, then the day runs forward. Callers who never touch the control see the canon look.
- **The hint says the game is unaffected.** The preset is lighting only: it drives sun, sky, interior glow and road wetness (`lighting.js` `TIME_PRESETS`), not care timers or the hatch clock. If a later lane ties presets to a world clock, this hint changes with it.
- **Night is not "Midnight".** Slop's preset id is `midnight`; its sun is a moonlight-coloured key. "Night" matches `handoff/realism.md` and the Graphics section's wording.

### Quality tiers

The Caller-facing tiers stay the three in § Graphics quality (`settings.graphics.auto`, `.performance`, `.quality` and their `.desc` rows). No new tier label ships. The spec's internal tiers (`low` for the Duo, `phone` for iPhone 17, `high` for iPad Pro; `perf/tier.ts`) are developer names and never appear in UI.

| ID | String | Voice | Max | Status |
|---|---|---|---|---|
| `settings.graphics.quality.desc` | Full detail, reflections and lit rooms. May run slower on older phones. | ui | 2 lines | drafted (unchanged; now literally true under the flag: SSR and interior mapping) |
| `settings.graphics.performance.desc` | Lighter detail and a lower render scale, for the smoothest frame. | ui | 2 lines | drafted (unchanged) |

`quality.desc` says "phones", which is wrong on iPad Pro. On a tablet the implementer uses `settings.graphics.quality.desc.tablet`:

| ID | String | Voice | Max | Status |
|---|---|---|---|---|
| `settings.graphics.quality.desc.tablet` | Full detail, reflections and lit rooms. May run slower on older tablets. | ui | 2 lines | drafted |

### Lobby: shaders compiling

The physical mode compiles more pipelines before the first frame. The lobby says what it is doing, with honest progress (spec D4: no stall at the known 75 % point, `worklet-rendering.md`). These rows join the G02 copy family; `g02.start.loading` ("Opening the city") stays the spoken line at START.

| ID | String | Voice | Max | Status |
|---|---|---|---|---|
| `g02.start.compiling` | Setting up the city's lights | ui | 32 | drafted |
| `g02.start.compiling.progress` | Setting up the city's lights · {percent}% | ui | 40 | drafted |
| `g02.start.compiling.a11y` | Setting up the city's lights, {percent} percent | ui | 48 | drafted |
| `g02.start.compiling.slow` | Still setting up the lights. Your game is safe. | ui | 2 lines | drafted |
| `g02.start.compiling.failed` | The city's lights couldn't finish setting up. Try again, and if it keeps happening, restart the app. | ui | 2 lines | drafted |
| `g02.start.compiling.failed.action` | Try again | ui | 12 | drafted |

Notes:

- **Progress is a count.** `{percent}` is finished compile jobs over total jobs, the way Slop's loader reports it (`main.js`, "Compiling Shaders & Render Pipelines... n%"). No row estimates time remaining: cold-launch versus warm-launch compile time is the `pipecache` probe, and it has not run.
- **"Slow" reports a state.** It appears when progress has not moved for a threshold the implementer sets from measurement. It names the step and says the save is untouched (compiling reads nothing from the save). It never says "almost there" and makes no claim about which step is longest until the `pipecache` probe measures it.
- **Failure reuses the `g02.resume.fail.generic` shape** (what happened, what to do), with "lights" so the Caller knows the save is not the problem. One action.
- **The a11y line is announced politely once per 25 % step,** not every percent.

### Credits: Slop New York

Joins § City data credits in the "Legal & credits" card (`settings-content.tsx`), as its own "Software" group, since Slop supplies code techniques and no data.

| ID | String | Voice | Status |
|---|---|---|---|
| `settings.legal.software.group` | Software | ui | drafted |
| `settings.legal.software.slop.line` | Rendering techniques adapted from Slop New York by Mr.doob (MIT) | ui | drafted |
| `settings.legal.software.slop.link` | View the Slop New York repository | ui | drafted |

Notes:

- **The line is fixed by the spec** (§5.8) and is not reworded. The link target is https://github.com/mrdoob/slop-newyork; the full licence is `docs/licenses/slop-newyork-mit.md`.
- **It does not sit under "City data".** No Slop geodata is imported, so putting the row next to the data sources would imply a data credit that isn't true.

| `settings.caller.saved` | Settings › Caller name | ui | drafted (confirmation after renaming the Caller; the card reuses the m07 field label, hint and button) |
| `m13.menu.settings` | M13 H-Lynk menu | ui | drafted (opens Settings from the companion) |
| `settings.page.previous` | Previous | ui | drafted (Settings glass: moves the highlight up one row) |
| `settings.page.next` | Next | ui | drafted (Settings glass: moves the highlight down one row) |
| `settings.row.change` | Change | ui | drafted (Settings glass: the select button on Caller name, Theme and Time of day) |
| `settings.row.open` | Open | ui | drafted (Settings glass: the select button on Game controls, Legal and Credits) |
| `settings.theme.label` | Theme | ui | drafted (same word as the 2D Appearance card's control) |
| `settings.theme.system` | System | ui | drafted |
| `settings.theme.light` | Light | ui | drafted |
| `settings.theme.dark` | Dark | ui | drafted |
| `settings.game_controls.label` | Game controls | ui | drafted (same as the 2D Game card's button) |
| `settings.game_controls.caption` | Stick, buttons, hand, haptics. | ui | drafted (same as the 2D Game card's caption) |
| `settings.legal.label` | Legal | ui | drafted (opens /legal/terms; the documents switch there) |
| `settings.credits.label` | Credits | ui | drafted (the map, model and software credits, a page at a time) |
| `settings.credits.map` | Map data | ui | drafted (group heading, same as the 2D card) |
| `settings.credits.assets` | Models & textures | ui | drafted (group heading, same as the 2D card) |
| `settings.sign_out.label` | Sign out | ui | drafted |
| `settings.sign_out.caption` | Sign out on this device only. | ui | drafted (same as the 2D Session card's caption) |
| `settings.sign_out.confirm.title` | Sign out? | ui | drafted (the glass asks once; Cancel is the default and the trackpad) |
| `settings.sign_out.error` | Couldn't sign out. Check your connection and try again. | ui | drafted |
| `settings.value.a11y` | {label}, {value} | ui | drafted (screen-reader name of a settings row with a value) |

### Delete account (M20, 2026-10-28)

Back in the 2D Session card and as the last row on the glass, shown only when this device has an account. App Store guideline 5.1.1(v) requires it for accounts made in the app. The body follows the privacy notice's "Your data, your call" section (`features/legal/copy.ts`): personal data goes, the Mon passes into Dr. Santoro's care. The notice names no waiting period, so deletion happens right away; the 7-day grace (DECISIONS L3) stays for deletions staff schedule in the console.

| ID | String | Voice | Status |
|---|---|---|---|
| `settings.delete.label` | Delete account | ui | drafted |
| `settings.delete.caption` | Deletes your account and its data. You can’t undo this. | ui | drafted (under Sign out; the glass row's caption) |
| `settings.delete.confirm.title` | Delete your account? | ui | drafted |
| `settings.delete.confirm.body` | This deletes your email, Caller name, birth year and sign-in methods right away, and clears the save on this device. Your Mon goes to stay with Dr. Santoro. You can’t undo this. | ui | drafted (the glass wraps it into caption lines) |
| `settings.delete.confirm.action` | Delete account | ui | drafted (danger button; Cancel, `m09.edit.cancel`, comes first and is the default) |
| `settings.delete.retry` | Try again | ui | drafted (replaces the action label after a failure) |
| `settings.delete.error.offline` | You're offline. Connect to the internet and try again. | ui | drafted (same line as the Amazon link card) |
| `settings.delete.error.reauth` | It's been a while since you signed in. Sign out, sign back in, then delete your account. | ui | drafted (Better Auth refuses a session older than a day with `SESSION_EXPIRED`) |
| `settings.delete.error.generic` | Couldn't delete your account. Try again in a minute. | ui | drafted |
| `settings.delete.done.a11y` | Your account is deleted. | ui | drafted (announced before Welcome opens) |

Struck the same day: the Preferences card's "Push notifications", "Weekly email digest" and "Public profile" switches. Nothing saved or read them, there is no digest mail (the privacy notice says there is no marketing channel) and no public profile. The Settings header line is now "Appearance, game and your account." (also on Profile's Settings row).


### Deletion rule (decision, 2026-10-28)

The brief (§4.4 M20) asks for "two-step, 7-day grace". The privacy notice (`features/legal/copy.ts`, "Your data, your call") promises deletion with no waiting period, and the server already deletes a self-service request at once (`releaseOwnAccount` in `packages/payload/src/auth/deletion.ts`) while keeping the 7-day grace for deletions staff schedule (`deleteCallerAccount`, hourly job).

- **BUILD: two steps.** Delete account opens a question; only its own Delete button deletes. Cancel comes first, is the default look, and is what the trackpad, Back and Home answer on the glass.
- **STRIKE: a 7-day grace on self-deletion.** The notice is the promise the Caller read. A grace would also need a "cancel deletion" path and copy the notice doesn't mention, and it keeps a child's personal data longer than they asked.
- **Kept: the 7-day grace for staff-scheduled deletions** (DECISIONS L3), which the Caller didn't start.
- **The Mon is never deleted** (Law 8): it passes into Dr. Santoro's care either way. The confirm body says so.

If the grace ever comes back for self-deletion, the privacy notice changes first.

### Device settings (M19, 2026-10-28)

The "This device" card on the 2D page, and one row each on the glass. Every switch is saved (MMKV, `device-prefs.store.ts`) and read: Haptics silences every `@acme/ui/haptics` call, Sound silences the Mon's voice (`features/voice`, captions stay up), the side key chirp and the synthesized hatch sounds, Reduce motion ORs into the kit's `useReducedMotion`, Egg alerts gates `scheduleReadyNotification` and cancels the scheduled alert when turned off. No Rive file in the repo carries audio, so Rive has nothing to mute. Haptics and Egg alerts are native only (web has neither).

| ID | String | Voice | Status |
|---|---|---|---|
| `settings.device.title` | This device | ui | drafted |
| `settings.notify.label` | Egg alerts | ui | drafted (the only notification is the egg-ready one) |
| `settings.notify.caption` | One alert when your egg is ready to hatch. Nothing else. | ui | drafted |
| `settings.notify.caption.denied` | Your phone blocks alerts from NYC-MON. Turn them on in your phone’s Settings. | ui | drafted |
| `settings.notify.open_settings` | Open phone Settings | ui | drafted (deep link, `Linking.openSettings`) |
| `settings.haptics.label` | Haptics | ui | drafted |
| `settings.haptics.caption` | Vibration on taps, the hatch and the controls. | ui | drafted |
| `settings.sound.label` | Sound | ui | drafted |
| `settings.sound.caption` | Your Mon's voice and sound effects, like the side key chirp. | ui | drafted (2026-10-28: the switch also mutes the Mon's voice; captions stay) |
| `settings.motion.label` | Reduce motion | ui | drafted |
| `settings.motion.caption` | Follows your phone. Turn on to reduce motion here even when your phone doesn’t. | ui | drafted |
| `settings.motion.caption.system` | On in your phone’s settings, so motion is already reduced. | ui | drafted (the switch reads on and can't turn the OS setting off) |
| `settings.on` / `settings.off` | On / Off | ui | drafted (glass row values) |
| `settings.export.label` | Download your data | ui | drafted |
| `settings.export.caption` | A JSON file with your save, these settings and your account details. | ui | drafted |
| `settings.export.action` | Download | ui | drafted |
| `settings.export.title` | Your NYC-MON data | ui | drafted (share sheet title) |
| `settings.export.error` | Couldn't open the share sheet. Try again. | ui | drafted |
| `settings.export.done.a11y` | Your data is ready to share. | ui | drafted |

The export holds the whole local save, these settings and, when signed in, the account record (email, Caller name, birth year, created date) and sign-in methods. There is no fuller server export yet; the privacy notice's "ask for a copy" route still covers the rest, and the file's `notes` say what is missing.

### Account (M20, 2026-10-28)

Inside Settings, not a separate route: the 2D Account card, and the glass's Account row (methods on the glass; the email and password forms under the device on phones and in the Detail pane on tablets and open foldables).

| ID | String | Voice | Status |
|---|---|---|---|
| `settings.account.title` | Account | ui | drafted |
| `settings.account.email` | Email | ui | drafted |
| `settings.account.email.none` | No email on this account | ui | drafted (Apple private relay can still give one; some providers don't) |
| `settings.account.methods` | Ways to sign in | ui | drafted |
| `settings.account.methods.loading` | Checking… | ui | drafted |
| `settings.account.methods.error` | Couldn't load your sign-in methods. Try again. | ui | drafted |
| `settings.account.provider.*` | Email and password / Apple / Google / Amazon / Other | ui | drafted |
| `settings.account.signed_out` | Sign in to see your account. | ui | drafted |
| `settings.account.change_email` | Change email | ui | drafted |
| `settings.account.change_email.field` | New email | ui | drafted |
| `settings.account.change_email.hint` | We email your current address first. It changes once you open that link. | ui | drafted (Better Auth `changeEmail`, `updateEmailWithoutVerification: false`) |
| `settings.account.change_email.sent` | Check {email} for a link to confirm the change. | ui | drafted ({email} is the current address) |
| `settings.account.change_email.invalid` | That email looks off. Check it for a typo. | ui | drafted (same line as M03) |
| `settings.account.change_password` | Change password | ui | drafted (only on email-and-password accounts) |
| `settings.account.password.current` | Current password | ui | drafted |
| `settings.account.password.new` | New password | ui | drafted |
| `settings.account.password.hint` | At least 10 characters. Your other devices get signed out. | ui | drafted (`revokeOtherSessions: true`) |
| `settings.account.password.too_short` | Use at least 10 characters. | ui | drafted |
| `settings.account.password.done` | Password changed. | ui | drafted |
| `settings.account.save` | Save | ui | drafted |
| `settings.account.error.offline` | You're offline. Connect to the internet and try again. | ui | drafted |
| `settings.account.error.reauth` | It's been a while since you signed in. Sign out, sign back in, then try again. | ui | drafted |
| `settings.account.error.password_wrong` | That isn't your current password. | ui | drafted |
| `settings.account.error.email_taken` | That email already has an account. | ui | drafted |
| `settings.account.error.generic` | That didn't work. Try again in a minute. | ui | drafted |

The Settings header line is now "This device, your account and the game." (also on Profile's Settings row).

## Companion pane (tablets and open foldables)

Written 2026-10-28. On a tablet, an open foldable or a wide web window, the 3D H-Lynk screens get a pane beside the device (landscape) or under it (portrait). Phones never show it. Strings live in `packages/app/features/companion/copy.ts` (`pane.*`, M13 to M18) and `packages/app/features/egg/copy.ts` (`pane.meet.*`, `pane.incubation.*`, M08, M10 and M11). Settings and M09 reuse their existing strings. Layout: `docs/design/foldable-arrangements.md`, "Companion pane on the persistent stage".

| ID | String | Voice | Status |
|---|---|---|---|
| `pane.loading.a11y` | Loading | ui | drafted |
| `pane.tips` | Good to know | ui | drafted |
| `pane.home.title` | Today with {name} | ui | drafted |
| `pane.home.care` | How {name} is doing | ui | drafted |
| `pane.home.meter` | {meter}: {percent}% | ui | drafted |
| `pane.home.recent` | Recent moments | ui | drafted |
| `pane.home.journal` | Open Journal | ui | drafted |
| `pane.home.recent.empty.title` | Nothing here yet | ui | drafted |
| `pane.home.recent.empty.body` | Feed, rest or play with {name}. Each one shows up here. | ui | drafted |
| `pane.feed.title` | Meals | ui | drafted |
| `pane.feed.history` | Recent meals | ui | drafted |
| `pane.feed.empty.title` | No meals yet | ui | drafted |
| `pane.feed.empty.body` | Share a meal with {name}. It shows up here. | ui | drafted |
| `pane.feed.tip.full` | Feeding {name} when Fullness is already high makes {name} slow for a while. | ui | drafted |
| `pane.feed.tip.asleep` | {name} does not eat while asleep. | ui | drafted |
| `pane.feed.tip.ask` | When {name} asks for food, the trackpad shares a meal in one tap. | ui | drafted |
| `pane.rest.title` | Sleep | ui | drafted |
| `pane.rest.history` | Recent naps | ui | drafted |
| `pane.rest.empty.title` | No naps yet | ui | drafted |
| `pane.rest.empty.body` | Put {name} to bed. It shows up here. | ui | drafted |
| `pane.rest.tip.energy` | Sleep brings Energy back. | ui | drafted |
| `pane.rest.tip.close` | You can close the H-Lynk while {name} sleeps. | ui | drafted |
| `pane.rest.tip.early` | Waking {name} early leaves {name} a little less social. | ui | drafted |
| `pane.social.title` | Peek | ui | drafted |
| `pane.social.history` | Recent games | ui | drafted |
| `pane.social.empty.title` | No games yet | ui | drafted |
| `pane.social.empty.body` | Play Peek with {name}. It shows up here. | ui | drafted |
| `pane.social.tip.how` | {name} hides in one of three spots. Flick to look, tap to peek. | ui | drafted |
| `pane.social.tip.tired` | {name} needs some Energy to play. When Energy runs low, rest comes first. | ui | drafted |
| `pane.social.tip.social` | Each game raises Social. | ui | drafted |
| `pane.dex.title` | About {name} | ui | drafted |
| `pane.journal.title` | Calendar | ui | drafted |
| `pane.journal.all` | Show every day | ui | drafted |
| `pane.journal.filtered` | Showing {date} | ui | drafted |
| `pane.meet.title` | About this egg | ui | drafted |
| `pane.meet.number` | Number | ui | drafted |
| `pane.meet.bloodline` | Bloodline | ui | drafted |
| `pane.meet.empty.title` | Pick an egg | ui | drafted |
| `pane.meet.empty.body` | Tap an egg to see the name, number and Bloodline. | ui | drafted |
| `pane.incubation.title` | Incubation | ui | drafted |
| `pane.incubation.a11y` | Incubation steps | ui | drafted |
| `pane.incubation.chosen` | You chose the {eggName} | ui | drafted |
| `pane.incubation.wait` | Incubating | ui | drafted |
| `pane.incubation.wait.pick` | Pick how long the egg incubates. | ui | drafted |
| `pane.incubation.wait.for` | For {duration}. | ui | drafted |
| `pane.incubation.started` | Started {time} | ui | drafted |
| `pane.incubation.ready` | Ready to hatch | ui | drafted |
| `pane.incubation.ready.at` | {time} | ui | drafted |
| `pane.incubation.hatch` | Hatch and meet your Mon | ui | drafted |
| `pane.incubation.hatch.body` | You can give your Mon a nickname after the hatch. | ui | drafted |
| `pane.incubation.now` | Now | ui | drafted |

Notes:

- **M08 shows canon facts only** (M08 handoff P3): the egg's name, number and Bloodline. Culture notes are `null` in content, so the pane has no lore text yet.
- **No pronoun for a Mon or an egg** (PS-005). "the egg", "your Mon" and `{name}` instead; `egg-model.test.ts` enforces it for the egg strings.
- **Low is a request, not a loss.** The Home pane marks a low meter with the existing `m13.ring.low` badge in the accent tone, never a warning colour.

## Tablet layouts for the 2D screens (2026-10-28)

Added with the responsive pass on Alerts, Caller, Settings, Game controls, Legal, the error pages and the Permission Center. Most `error.*` and `perm.*` strings already shipped hardcoded in the screens; they now live in copy files and only the ids are new. New wording is marked "new".

| ID | String | Voice | Status |
|---|---|---|---|
| `profile.identity.label` | Account | ui | drafted (moved from the screen) |
| `profile.name.empty` | No Caller name yet | ui | drafted, new (heading when no Caller name exists) |
| `inbox.mark_all_read.a11y.label` | Mark all notifications read | ui | drafted (moved from the screen) |
| `inbox.all_read` | All read | ui | drafted, new (replaces the vanished count after Mark all read) |
| `inbox.row.unread.a11y` | Unread | ui | drafted, new |
| `inbox.row.a11y.hint` | Marks it read | ui | drafted, new |
| `LEGAL_UI.back` | Go back | ui | drafted (`features/legal/copy.ts`) |
| `LEGAL_UI.contentsLabel` | On this page | ui | drafted, new |
| `LEGAL_UI.contentsHint` | Scrolls the document to this section. | ui | drafted, new |
| `LEGAL_UI.switcherLabel` | Legal documents | ui | drafted, new |
| `error.not_found.code` | 404 | ui | drafted (moved, `features/error/copy.ts`) |
| `error.not_found.title` | Page not found | ui | drafted (moved) |
| `error.not_found.body` | The page you are looking for does not exist or has moved. | ui | drafted (moved) |
| `error.failed.code` | ! | ui | drafted (moved) |
| `error.failed.title` | Something went wrong | ui | drafted (moved) |
| `error.failed.body` | An unexpected error occurred. Try again in a moment. | ui | drafted (moved) |
| `error.home` | Back to Home | ui | drafted (moved) |
| `error.back` | Go back | ui | drafted, new (shown only when the stack can go back) |
| `perm.step` | H-LYNK SETUP / FINAL STEP | ui | drafted (moved) |
| `perm.title` | Ready for NYC? | ui | drafted (moved) |
| `perm.intro` | Choose what to enable. Notifications are selected; everything else is your call. | ui | drafted (moved) |
| `perm.status.undetermined` | Not requested | ui | drafted (moved) |
| `perm.status.granted` | Allowed on this device | ui | drafted (moved) |
| `perm.status.denied` | Not allowed | ui | drafted (moved) |
| `perm.status.blocked` | Change in device settings | ui | drafted (moved) |
| `perm.status.unavailable` | Unavailable on this device | ui | drafted (moved) |
| `perm.open_settings` | Open device settings | ui | drafted (moved) |
| `perm.continue` | Continue | ui | drafted (moved) |
| `perm.continue.selected` | Continue with {n} selected | ui | drafted (moved) |
| `perm.not_now` | Not now | ui | drafted (moved) |
| `perm.footnote` | Denying access won’t block your Mon. You can enable permissions later in device settings or when you use a feature. | ui | drafted (moved) |


## MONS — the species index (2026-10-28)

The fourth native tab (Gameplay Bible v12): "what is this Mon?", never the care screen. A plain screen in the `(home)` shell with no H-Lynk on it. Strings live in `packages/app/features/mons/copy.ts`; the Bloodline label reuses `m17.bloodline`. Stage names (Egg, Baby, Small, Mid, Max) are canon and come from the data.

| ID | String | Voice | Status |
|---|---|---|---|
| `mons.title` | Mons | ui | drafted |
| `mons.count` | Seen {seen} of {total} | ui | drafted |
| `mons.count.a11y` | You have seen {seen} of {total} Mons | ui | drafted |
| `mons.search.placeholder` | Name or number | ui | drafted |
| `mons.search.a11y` | Search Mons by name or number | ui | drafted |
| `mons.filter.bloodline.a11y` | Bloodline | ui | drafted |
| `mons.filter.stage.a11y` | Stage | ui | drafted |
| `mons.filter.all` | All | ui | drafted |
| `mons.number` | No. {dex} | ui | drafted |
| `mons.number.a11y` | Number {dexSpoken} | ui | drafted |
| `mons.unseen` | ??? | ui | drafted |
| `mons.comingSoon` | Coming Soon | ui | drafted |
| `mons.unseen.a11y` | Not seen yet | ui | drafted |
| `mons.row.a11y` | {name}, number {dexSpoken}, {stage}, {bloodline} | ui | drafted |
| `mons.row.unseen.a11y` | Number {dexSpoken}, not seen yet | ui | drafted |
| `mons.row.hint` | Opens the entry | ui | drafted |
| `mons.empty.title` | No Mons seen yet | ui | drafted |
| `mons.empty.body` | Pick an egg and each Mon you meet fills in here. | ui | drafted |
| `mons.nomatch.title` | No Mons match | ui | drafted |
| `mons.nomatch.body` | Try another name or number, or show every Bloodline. | ui | drafted |
| `mons.nomatch.clear` | Clear search and filters | ui | drafted |
| `mons.entry.stage` | Stage | ui | drafted |
| `mons.entry.bloodline` | Bloodline | ui | drafted |
| `mons.entry.lore` | Lore | ui | drafted |
| `mons.entry.types` | Type | ui | drafted, new |
| `mons.entry.size` | Size | ui | drafted, new |
| `mons.entry.unseen.body` | Meet this Mon to fill in the entry. | ui | drafted |
| `mons.entry.line` | Evolution line | ui | drafted |
| `mons.entry.line.a11y` | Evolution line, Egg to Max | ui | drafted |
| `mons.entry.step.a11y` | {stage}: {name} | ui | drafted |
| `mons.entry.step.current.a11y` | {stage}: {name}, this entry | ui | drafted |
| `mons.entry.branch` | A Mid becomes one of these | ui | drafted |
| `mons.entry.branch.why` | Bond and personality can shape which one. | ui | drafted |
| `mons.entry.trigger` | Needs {item} · {mastery} | ui | drafted, new |
| `mons.entry.trigger.unknown` | Trigger unknown | ui | drafted |
| `mons.entry.trigger.a11y` | Needs {item}. {mastery} | ui | drafted, changed |
| `mons.entry.previous` | Previous | ui | drafted |
| `mons.entry.next` | Next | ui | drafted |
| `mons.entry.previous.a11y` | Previous entry, number {dexSpoken} | ui | drafted |
| `mons.entry.next.a11y` | Next entry, number {dexSpoken} | ui | drafted |
| `mons.entry.back` | All Mons | ui | drafted |
| `mons.entry.model.a11y` | {name}, 3D model | ui | drafted |
| `mons.entry.unseen.art.a11y` | Unseen Mon | ui | drafted |
| `mons.notfound.title` | No entry here | ui | drafted |
| `mons.notfound.body` | This number is not in the index. | ui | drafted |
| `mons.loading.a11y` | Loading the Mon | ui | drafted |
| `mons.detail.empty.title` | Pick a Mon | ui | drafted |
| `mons.detail.empty.body` | Choose a number on the left to read the entry. | ui | drafted |

Notes:

- **Unseen is "???" with the number only.** A form counts as seen when the save shows the Caller met it (M08 eggs, an egg record, a Mon and the forms on its chain). Search matches unseen forms by number only, never by name, so it cannot leak one. Babies are never shown before the hatch (glossary, P3), so the unseen art is a question mark, not the form's outline.
- **Each Max form shows what it needs.** The v11.1 roster (#115) gives all 37 Max forms an `evolutionUnlock`: an item and a mastery cue, shown as `mons.entry.trigger` under the step. A seen step shows it; an unseen step shows nothing, because some item and mastery names carry the form's name. Decision #12 still leaves what decides a branch `TODO(canon)`, so `mons.entry.branch.why` stays. `mons.entry.trigger.unknown` is the fallback for a seen branch form with no unlock (none today).
- **Facts come from content only.** `mons.entry.lore` shows the record's `cultureNote`, or the roster's `loreSummary` while that is null (it is null on every form today). `mons.entry.size` shows `scaleTargetDescription` verbatim: an art-direction size target, not a height. `mons.entry.types` labels the v8 `legacyTypeNames` chips (none on Eggs); the eight Affinities are still unauthored. Temperament, home district (`districtId` is null everywhere), height and weight have no canon value, so the entry has no label for them.

## HOME hub and Caller, Phase 1 (2026-10-28)

HOME is the canon's first tab (`/home`, `features/hub/copy.ts`); CALLER is the fifth (`features/profile/copy.ts`). Both are Phase 1 only: no Stories, events, tournaments, reputation, rankings, achievements or friends, and no placeholder lines for them. The hub reuses H-Lynk's own words for care (`m13.status.*`) and the egg's time line (`m11.time.*`), so a status reads the same on Home as on the H-Lynk. Copy tests in `hub-model.test.ts` reject "pet", "player", "device", "user", "owner", "trainer", "Get started" and exclamation marks.

| ID | String | Voice | Status |
|---|---|---|---|
| `hub.loading.a11y` | Loading Home | ui | drafted, new |
| `hub.mon.label` | With you now | ui | drafted, new |
| `hub.mon.stage` | {stage} stage | ui | drafted, new |
| `hub.mon.a11y` | {name}, {stage} stage. {status}. | ui | drafted, new |
| `hub.need.feed` | Feed {name} | ui | drafted, new |
| `hub.need.rest` | Put {name} to bed | ui | drafted, new |
| `hub.need.asleep` | Check on {name} | ui | drafted, new |
| `hub.need.play` | Play with {name} | ui | drafted, new |
| `hub.need.hi` | Say hi to {name} | ui | drafted, new |
| `hub.need.hint` | Opens H-Lynk | ui | drafted, new |
| `hub.egg.label` | Your egg | ui | drafted, new |
| `hub.hatch.counting.title` | Your egg is incubating | ui | drafted, new |
| `hub.hatch.ready.title` | Your egg is ready | ui | drafted, new |
| `hub.hatch.resume.title` | Your egg started hatching | ui | drafted, new |
| `hub.hatch.counting.action` | Check your egg | ui | drafted, new |
| `hub.hatch.ready.action` | Hatch your egg | ui | drafted, new |
| `hub.hatch.resume.action` | Finish the hatch | ui | drafted, new |
| `hub.game.continue` | Continue game | ui | drafted, new |
| `hub.game.continue.detail` | Last saved {when} | ui | drafted, new |
| `hub.game.start` | Start the game | ui | drafted, new |
| `hub.game.start.detail` | Walk the city with {name}. | ui | drafted, new |
| `hub.game.start.detail.solo` | Walk the city. | ui | drafted, new |
| `hub.game.failed` | Open the game | ui | drafted, new |
| `hub.game.failed.detail` | Your city save didn't load. The game can fix it. | ui | drafted, new |
| `hub.hlynk.title` | Your H-Lynk | ui | drafted, new |
| `hub.hlynk.detail` | Feed, rest and play with {name}. | ui | drafted, new |
| `hub.hlynk.detail.egg` | Your egg is in there. | ui | drafted, new |
| `hub.hlynk.a11y` | Open your H-Lynk | ui | drafted, new |
| `hub.empty.title` | No Mon yet | ui | drafted, new |
| `hub.empty.body` | Pick an egg. Your Mon hatches from it. | ui | drafted, new |
| `hub.empty.action` | Choose your egg | ui | drafted, new |
| `caller.label` | Caller | ui | drafted, new (replaces `profile.identity.label` "Account" over the name) |
| `caller.since` | Caller since {date} | ui | drafted, new (month and year, device locale) |
| `caller.record.title` | Your record | ui | drafted, new |
| `caller.record.hatched` | Eggs hatched | ui | drafted, new |
| `caller.record.highlights` | Journal highlights | ui | drafted, new (the hatch, the naming, and each first meal, nap and game) |
| `caller.record.a11y` | {label}, {count} | ui | drafted, new |
| `caller.mons.title` | Mons raised | ui | drafted, new |
| `caller.mons.stage` | {stage} stage | ui | drafted, new |
| `caller.mons.days.one` | 1 day together | ui | drafted, new |
| `caller.mons.days.many` | {days} days together | ui | drafted, new |
| `caller.mons.row.a11y` | {name}, {stage} stage, {days} | ui | drafted, new |
| `caller.mons.empty.egg` | Your egg is incubating. Your first Mon hatches from it. | ui | drafted, new |
| `caller.mons.empty` | No Mon yet. Pick an egg on Home. | ui | drafted, new |
| `caller.settings.title` | Settings | ui | drafted, new |
| `caller.settings.detail` | Appearance, graphics and game controls. | ui | drafted, new |
| `caller.settings.a11y` | Open settings | ui | drafted, new |
| `caller.account.title` | Account | ui | drafted, new (opens Settings: its account cards hold the Caller name, sign out and delete) |
| `caller.account.detail` | Caller name, sign out, delete account. | ui | drafted, new |
| `caller.account.a11y` | Open your account settings | ui | drafted, new |
| `caller.loading.a11y` | Loading your Caller record | ui | drafted, new |

## M21 offline / sync and M22 error / recovery (2026-10-28)

Strings live in `packages/app/features/system/copy.ts`. Every one is `ui` voice; neither screen has a character line.

M22 always says three things in order: what happened, what is safe, what to do. "Your Mon is fine" leads both 3D states because the Mon is the first worry. A damaged save is never deleted, and the copy says so before the Caller picks an action. "Start a new save" sits behind a confirm with Cancel first.

M21 says "saved here" before it says "offline": the Caller can keep playing. A conflict is one line in the sync log, never a dialog (brief §4.4). Phase 1 has no client that sends the queue to the server, so Sync now answers `m21.result.no_server` instead of pretending to sync.

"This device" here means the phone or tablet, never the H-Lynk (the banned use).

| ID | String | Voice | Status |
|---|---|---|---|
| `m22.save.title` | Your save didn't open | ui | drafted |
| `m22.save.body.restore` | The save on this device is damaged. You can go back to the last copy that saved cleanly, from {when}. | ui | drafted ({when} is the last-good save time, device locale) |
| `m22.save.body.none` | The save on this device is damaged, and there's no clean copy to go back to. You can start a new save. | ui | drafted |
| `m22.save.body.newer` | This save was made by a newer version of NYC-MON. Update the app to open it, or go back to an older copy. | ui | drafted |
| `m22.save.kept` | The damaged save stays on this device. Nothing is deleted. | ui | drafted (under every save state; the broken save moves to its own key) |
| `m22.webgpu.title` | 3D can't run on this device | ui | drafted |
| `m22.webgpu.body` | Your Mon is fine. The 2D view has everything the 3D one does. | ui | drafted |
| `m22.lost.title` | The 3D view stopped | ui | drafted |
| `m22.lost.body` | Your Mon is fine. Try the 3D view again, or keep going in 2D. If it stops again, close and reopen the app. | ui | drafted (React Native Skia 3.6 treats a lost shared device as fatal, hence the reopen line) |
| `m22.mon.title` | Your Mon didn't load | ui | drafted |
| `m22.mon.body` | The save opened, but your Mon is missing from this screen. Load the save again to bring them back. | ui | drafted (M13 with no Mon and no egg while the save itself reads) |
| `m22.dex.title` | No Dex entry here | ui | drafted |
| `m22.dex.body` | This link points to a Mon that isn't in your Dex. | ui | drafted |
| `m22.action.restore` | Go back to the last good save | ui | drafted |
| `m22.action.start_over` | Start a new save | ui | drafted |
| `m22.action.use_2d` | Use the 2D view | ui | drafted |
| `m22.action.retry_3d` | Try 3D again | ui | drafted |
| `m22.action.reload` | Load the save again | ui | drafted |
| `m22.action.home` | Back to Home | ui | drafted |
| `m22.action.back` | Go back | ui | drafted |
| `m22.start_over.confirm.title` | Start a new save? | ui | drafted |
| `m22.start_over.confirm.body` | You start again from the first step. The damaged save stays on this device in case it can be fixed later. | ui | drafted |
| `m22.start_over.confirm.action` | Start a new save | ui | drafted |
| `m22.start_over.cancel` | Cancel | ui | drafted (Cancel comes first, in the primary look) |
| `m22.restore.failed` | That copy didn't open either. You can start a new save. | ui | drafted |
| `m22.done.a11y` | Save restored. Opening Home. | ui | drafted |
| `m21.banner.offline` | You're offline | ui | drafted |
| `m21.banner.offline.body` | Care you give is saved here and syncs when you reconnect. | ui | drafted |
| `m21.banner.pending` | {count} waiting to sync | ui | drafted (the queued-writes badge) |
| `m21.banner.pending.one` | 1 waiting to sync | ui | drafted |
| `m21.banner.syncing` | Syncing | ui | drafted |
| `m21.banner.conflict` | Sync finished with a change | ui | drafted |
| `m21.banner.a11y.hint` | Opens sync details | ui | drafted |
| `m21.title` | Sync | ui | drafted |
| `m21.status.online` | Online | ui | drafted |
| `m21.status.offline` | Offline | ui | drafted |
| `m21.status.reconciling` | Syncing now | ui | drafted |
| `m21.status.conflict` | Synced, with a change | ui | drafted |
| `m21.local_first` | Everything saves on this device first, so you can play without a connection. | ui | drafted |
| `m21.queue.title` | Waiting to sync | ui | drafted |
| `m21.queue.count` | {count} changes | ui | drafted |
| `m21.queue.count.one` | 1 change | ui | drafted |
| `m21.queue.empty.title` | All caught up | ui | drafted |
| `m21.queue.empty.body` | Nothing is waiting to sync. | ui | drafted |
| `m21.queue.feed` | Fed {name} | ui | drafted |
| `m21.queue.rest` | {name} went to sleep | ui | drafted |
| `m21.queue.wake` | Woke {name} | ui | drafted |
| `m21.queue.play` | Played with {name} | ui | drafted |
| `m21.queue.egg` | New egg | ui | drafted |
| `m21.log.title` | Sync log | ui | drafted |
| `m21.log.empty` | No changes from the server yet. | ui | drafted |
| `m21.log.server_kept` | The server kept its version of {count} changes for {name}. | ui | drafted (the one-line conflict log; the server tie-break wins silently) |
| `m21.log.server_kept.one` | The server kept its version of 1 change for {name}. | ui | drafted |
| `m21.retry` | Sync now | ui | drafted |
| `m21.retry.a11y.hint` | Sends the waiting changes | ui | drafted |
| `m21.result.offline` | Still offline. Your changes are safe here and sync when you're back online. | ui | drafted |
| `m21.result.no_server` | Saved on this device. Syncing with the server isn't switched on yet, so changes stay here for now. | ui | drafted (Phase 1 ships no sync sender; this is the honest answer until one exists) |
| `m21.result.synced` | Synced. | ui | drafted |
| `m21.result.failed` | Couldn't reach the server. Your changes are safe here. Try again in a minute. | ui | drafted |
| `m21.back` | Back | ui | drafted |
