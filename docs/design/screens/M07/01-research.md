# M07 Caller name: research

Route `/(onboarding)/caller` · Shell: none · States: empty / typing / invalid / confirmed · Spec: BUILD_PROMPT_v3 §4.1; Law 9; Decision #5; Q32 in `docs/canon/OPEN_QUESTIONS.md`.

## Jobs to be done

- **Dani (teen):** When I pick what my Mon will call me, I want a name that sounds like me, so being addressed by it feels personal.
- **Sol (adult):** When I set my name, I want to change it later, so a choice made in onboarding isn't permanent.
- **Jayden (under-13):** When I type a name, I want it to be OK to use a nickname, so I don't have to share my real name.
- **Renée (parent):** When my child chooses a name, I want it kept private.

## Risks

- **Nobody to preview with.** The prompt asks for a "live preview in the Mon's address style". Under Decision #5 the Caller hasn't met Santoro or seen an egg yet, and the Mon doesn't exist until M12. Whose voice is the preview in? Options: Santoro (the only character on stage so far), the H-Lynk UI voice, or move M07 after M09 so the hatched Baby can react. Question for Mike.
- **Babies may not speak.** v11: "Hatchlings may use baby-talk/gibberish, then limited speech, then full speech" (`V11 ¶56`). Q32 asks whether Phase 1 Babies use only species sounds. If yes, a Baby can never say the Caller name in Phase 1, and the "address style" preview has no canon basis.
- **Caller / Callah (Law 9).** The screen label and field are "Caller" (`voice: "ui"`). "Callah" is allowed only in a preview line flagged `voice: "character"` and spoken by a character with that pronunciation (`V11 ¶19`, `¶58`). Never "Callah" in a label or button.
- **Profanity and length rules** need to handle NYC names and slang without flagging legitimate names from the communities the Bible lists (`V11 ¶53`). Test the filter with real names from those communities before launch; a false positive on someone's own name is a sharp moment (assumption).
- **COPPA.** A first name is personal information if real. For under-13s whose consent is pending, keep the name on the phone until approval (ADR 0001's queued-write model), and consider suggesting a nickname.
- **Notification leakage.** If the name appears in M23 notification text, it shows on a lock screen a parent or classmate may see (see M06).
- **Reserved names.** The Caller name is the player's, not the Mon's, so "Ratti" (reserved for Malik's Mon, Decision #1) doesn't apply here. Don't reuse the M09 reserved-name rule by mistake.

## Usability questions

1. Before typing, can players say who will use this name?
2. Do players type a real name or a handle, and does that differ for under-13s?
3. If a name is rejected, can players tell why and pick another within one attempt?
