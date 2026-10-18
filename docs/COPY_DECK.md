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
