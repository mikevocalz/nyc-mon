# M09 Naming ceremony: research

Route `/(onboarding)/name` · Shell: H-Lynk Core · States: empty / typing / confirmed · Spec: `docs/phase-1-brief.md` §4.2 M09, §2.2 ("The naming ceremony names the individual"); canon Decisions #1, #5, #9, #14; PS-005 / Q14 (no pronoun, gender unstated in Phase 1); open Q17 (suggested names), Q32 (Baby voice).

**Position moves (Decision #5).** Naming happens after the hatch, so M09 is reached from M12, not from M08: M08 → M10 → M11 → M12 Hatch → **M09** → M13 Home. The Caller is naming a Baby they can see: Squeaklet (#002), Kittee Cee (#009) or Yotito (#062), as the roster names the forms (Decision #9).

## Jobs to be done

- **Dani (teen Caller):** When my Mon has just hatched and looked at me, I want to give a name that fits who I'm looking at, so the partner feels like mine and not a species.
- **Jayden (under-13):** When I name my Mon, I want to type a name I like without being told it's wrong, so the moment stays happy.
- **Sol (adult):** When I name my Mon, I want to know if I can change it later, so I don't freeze over the choice.
- **Marcus (lapsed):** When I come back after closing the app on this screen, I want to land on the naming again, not on a nameless Mon at home.

## Risks

- **The Mon's choice is already made.** Decision #14 puts the Mon's choice at the hatch (the Baby's first look at the Caller). Any reaction on M09 must read as noticing, never as approving or refusing a name. A head tilt on a typing pause is attention; a frown at a name would be a judgment the canon doesn't give the Baby.
- **Baby voice is open (Q32).** The brief asks for a species sound as the Mon reacts. v11 allows baby-talk (`V11 ¶56`); v7 lists species sounds (chirps, chirrup and purr, yips). No sound asset exists and Q32 is open. Sound is a slot, off until both land.
- **"Ratti" (Decision #1).** "The player's Hood Ratti is never named 'Ratti' by default." Canon rules out a default; it doesn't say the Caller is barred from typing it. `JOURNEY.md` risk 7 assumed a refusal. Blocking a name a Caller chose is a sharp moment; letting it through could blur Malik's individual. Open for Mike; the rule is built as a list that ships empty.
- **No suggestions.** No canon names exist for the player's starters (Q17). A shuffle button (Finch) would mean inventing names (Law 1).
- **No rename in Phase 1.** M17 shows the nickname; nothing in §4.3/§4.4 edits it. The copy says so plainly rather than promising "you can change this later".
- **Keyboard vs shell.** The H-Lynk shell on SE leaves 139 pt for the control row under a 468 pt screen. A keyboard (≈ 260 pt) cannot coexist with that layout. While typing, the shell must drop to its compact form, and the trackpad, covered by the keyboard, cannot be the only way to confirm.
- **Resume mid-ceremony.** `resolveBootRoute` sends any save with a Mon to `companion` (M13). A Caller who quits on M09 would land on a nameless Mon. Needs a boot step.
- **Schema mismatch.** `MonInstanceSchema.nickname` allows 1–64 characters; the plate and the M07 rule are sized for 16.
- **Under-13s.** A Mon's name isn't personal information about the child, but children sometimes type their own or a friend's real name. No extra rule; the name stays local while consent is pending (ADR 0001).

## Usability questions

1. After the hatch, do players understand they're naming this one individual (not the species), and can they say whose name "Squeaklet" is?
2. Do players notice the Mon reacting while they type, and do any of them read the reaction as liking or disliking the name?
3. With the keyboard up, can every player find how to confirm without the trackpad?
