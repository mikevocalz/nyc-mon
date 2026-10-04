# M05 Parental consent: research

Route `/(auth)/consent` · Shell: none · States: pending / approved / denied · Spec: BUILD_PROMPT_v3 §1.5, §4.1; Decision #3 (Resend); ADR 0001.

Two audiences: the child on this screen, and the parent who gets the email.

## Jobs to be done

- **Jayden (child):** When the app needs a grown-up's OK, I want to know I can still play, so waiting doesn't feel like being kicked out.
- **Jayden:** When my parent says no, I want to understand what that means without feeling I did something wrong.
- **Renée (parent):** When I get an email from an app I've never heard of, I want to see who it's from, what it keeps about my kid and for how long, so I can decide in a minute.
- **Renée:** When I've decided, I want to approve or say no without making an account.

## Risks

- **What may be collected.** FTC COPPA FAQ I.2 and C.11: the parent's contact may be collected for the sole purpose of sending the notice; if consent doesn't come in a reasonable time, it must be erased (https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions). The screen asks for the parent's email and nothing else: no child name, no Caller name, no photo.
- **Consent method.** "Email plus" is available only when data is used internally and not disclosed (FAQ I.3). The amended rule (effective June 23, 2025; compliance by April 22, 2026) adds a "text plus" option and requires a written data retention policy (FTC: https://www.ftc.gov/legal-library/browse/federal-register-notices/16-cfr-part-312-coppa-final-rule-amendments; summary: https://www.venable.com/insights/publications/2025/01/ftc-finalizes-coppa-rule-changes-in-the-biden). The method is a counsel decision (ADR 0001). Research tests trust, not legality.
- **Phishing look-alike.** A cold email asking a parent to "verify" resembles phishing (assumption). Sender name, a plain subject, and no urgency language matter more than visual design.
- **"Limited mode" is undefined.** The prompt says the app "waits in a limited mode"; ADR 0001 says the child "keeps playing locally" with writes queued. Which screens are limited? If the child can meet, incubate and hatch locally, the hatch must still obey Law 6 (one `monInstanceId`) through a server-replayable deterministic function. If the parent denies, what happens to the locally hatched Baby? Canon says a Mon is never inventory (`V11 ¶123`) and faint is never death (Law 8); a denial that deletes a hatched Mon in front of a child would be the worst moment in the app. Question for Mike.
- **Caller name collected while pending.** M07 comes after M05. If a child types their real first name as their Caller name, and it syncs on approval, that is personal information. Keep it local until consent; consider whether M07 should warn against real names for under-13s.
- **Guilt and pressure.** No Mon pleading with the child to get their parent to approve (UK ICO Children's Code, standard 13 "Nudge techniques": https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/).
- **Language (Law 9):** the email names the game, the H-Lynk only if needed, and the player as "your child". Don't use "Caller" in the parent email without explaining it.

## Usability questions

1. (Child) After sending the request, can the child say whether they can keep playing, and what happens next?
2. (Parent) From the email alone, can the parent say what data is kept and what "No" does?
3. (Parent) Does any parent treat the email as spam or a scam, and what made them think so?
