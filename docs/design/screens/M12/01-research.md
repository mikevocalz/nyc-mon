# M12 Hatch: research

Route `/(home)/hatch` · Shell: H-Lynk · States: pre / in progress / complete / already-hatched (idempotent re-entry), plus `early` (opened before the egg is ready) · Spec: `docs/phase-1-brief.md` §3.5, §3.6, §4.2 M12, §8 "Hatch idempotency"; Laws 6, 7, 8; `V11 ¶25`, `¶49`; Decisions #4, #5, #7, #14; PS-005; Q30, Q31, Q32.

The signature moment (§0C: "the hatch is a moment people screen-record"). It is also the one write in Phase 1 that can create a duplicate individual if done wrong.

## Jobs to be done

- **Dani (teen):** When I tap the notification, I want to watch my egg hatch and see who comes out, so it feels like meeting someone.
- **Dani:** When the Baby looks at me for the first time, I want to feel chosen, so the partnership feels mutual.
- **Sol (adult):** I want to skip the show if I'm busy, and know that skipping changes nothing.
- **Marcus (lapsed):** When I tap an old notification for an egg that already hatched, I want to land on my Mon, not see the egg again.
- **Jayden (under-13):** Same as Dani, entirely on the phone while consent is pending.

## What canon, decisions and code fix

- Tapping the notification opens the hatch screen; hatch is atomic and cannot duplicate on reconnect, skip or device handoff (`V11 ¶49`).
- A hatchling is Baby and stays Baby (`V11 ¶25`, Law 7). Nothing on M12 uses the `evolve` intent.
- Naming happens **after** the hatch (Decision #5); JOURNEY orders M12 → M09 → M13. The brief's M12 row says "→ M13". Both hold if M12 hands to M09 when the individual has no nickname, and to M13 otherwise.
- Decision #14: the Baby's first look at the Caller is its choice. It leans in, or hesitates and needs a moment of care before the bond forms. It never rejects the Caller and the egg is never sent back. **Canon flag:** #14 quotes "The Mon chooses too" as `V11 ¶47`, but ¶47 of the v11 docx is about evolution continuity; the phrase is the brief's (§2.2). M12 designs the moment as a recorded creator decision, never as a quoted Bible line.
- Hatch performance style is open (Q30: soft seam vs crack-and-struggle). The brief's beats (case opens → scanner LED → crack driven by `hatchProgress` → burst → `hatch` clip → `attention`) are what `HATCH_PRESENTATION_PHASES` encodes: `case-open, scanner, crack, burst, emerge, attention`. "Struggle" is a distress beat; the design takes the soft side of Q30 without closing it.
- `transitionHatch` (`packages/core/sim/hatch.ts`): `open` on `ready` mints and moves to `presenting` at `case-open`; `advance` steps phases then `hatched`; `skip` jumps to `hatched` with the same Mon; `server-confirmed` binds the server's Mon after `HatchIntegrityError` checks. `open` on `presenting` or `hatched` is a no-op. That makes "already-hatched" and "resume" free at the state level; the screen has to make them read right.
- `mintMonInstance` sets `hatchedAt = egg.incubationEndsAt`, not the device clock, so devices agree.
- 2D now: the only art is `hatch-night.webp` (an egg in an open case on a Harlem stoop, crack glowing) and three Baby plates (`squeaklet`, `kittee-cee`, `yotito`), all scene paintings, not cut-outs (`packages/assets/creatures`). Models come later from Mike.

## Risks

- **Duplicate individual (P0).** Any path that mints outside `transitionHatch`/`resolveHatch`, or writes the Mon twice, breaks Law 6. The screen must persist `presenting` before the first frame of the reveal, so a kill during the show resumes the same individual.
- **Rejection spectacle.** A "hesitate" read too strongly (turning away, backing off, a sad sound) becomes the rejection the brief and #14 forbid. Hesitation must read as shy, not as no.
- **Confetti reflex.** Every reference hatch uses rays, confetti or a burst of stars (Finch). The brief bans confetti. The burst is light from inside the shell, once.
- **Skip that lies.** If skip lands on a different end pose than the full show, skipping changes what the Caller saw the Mon choose.
- **Hard cut to Home.** Unmounting the hatch and mounting M13 drops the creature for a frame. The brief forbids a hard cut.
- **Cold start from a notification.** The Caller may tap the banner while walking. Auto-playing the moment the app opens wastes it.
- **Photosensitivity.** A white burst on a night screen is the highest flash risk in the app.
- **Overdue hatch, hungry Baby.** If care starts at `incubationEndsAt`, a Caller who returns six hours late meets a Baby whose meters have already decayed, which punishes the late return M11 promised not to punish.

## Usability questions (hallway test, 5 people)

1. After the show: "Who chose whom?" (Pass: "we both did" or "it chose me". Fail: "I picked it".)
2. On the hesitate path: "How does the Baby feel about you?" (Pass: shy, unsure, curious. Fail: "it doesn't like me".)
3. Skip at 3 s, then ask: "Did skipping change anything about your Mon?" (Pass: "no".)
