# M03 Sign in / Create account: research

Route `/(auth)/sign-in` · Shell: none · States: idle / loading / error (per provider) / passkey unsupported · Spec: BUILD_PROMPT_v3 §1.4, §4.1; Decisions #2, #3; ADR 0001.

## Jobs to be done

- **Dani (teen):** When I need an account, I want to use what's already on my phone (Google, Apple), so I don't make another password.
- **Marcus (lapsed, new phone):** When I reinstall, I want to sign in and find my same Mon, so the one I raised isn't lost (`V11 ¶93`: "A device session is a surface, not a new creature").
- **Sol (adult):** When I sign up, I want to see what I'm agreeing to without hunting, so I can trust it.

## Risks

- **COPPA ordering (highest).** In the screen map, M03 comes before M04, yet ADR 0001 says "Neutral birth-year gate before any account exists" and "Under 13: no Better Auth account is created and no child email, Apple or Google identity is collected." If the "create" intent reaches Sign in with Apple or Google before M04, the app collects an under-13's identity before it knows their age. The FTC COPPA FAQ H.3 says to "ask age information in a neutral manner at the point at which you invite visitors to provide personal information" (https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions). Either the create intent goes to M04 first, or M03 shows only "sign in" to returning players. Question for Mike.
- **Two intents on one screen.** Returning players and new players share M03. If the screen doesn't make "I already have a Mon" obvious, Marcus may create a second account and think his Mon is gone. Law 6 protects the Mon server-side but not the player's belief.
- **Passkey comprehension.** Many players may not know what a passkey is (assumption; test it). The "passkey unsupported" state must not read as an error the player caused.
- **Verification lockout.** ADR 0001 records that a missing email sender can lock every account out silently. From the player's side this looks like "I signed up and nothing happened". The error state needs a path forward.
- **Language (Law 9):** "Caller" when referring to the player; no "device" in UI copy (say "this phone" only if the copy needs it, and check with `ux-writer`). Legal links visible on iPhone SE without scrolling (§4.1).
- **No modal stacking** (§4.1). Apple and Google sheets are system modals; don't add another on top.

## Usability questions

1. Can a returning player on a new phone tell which button gets them back to their Mon, without creating a new account?
2. Do players understand the passkey option well enough to choose it, or do they avoid it?
3. When a provider fails, do players know whether to retry, pick another provider, or wait?
