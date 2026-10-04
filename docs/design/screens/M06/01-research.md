# M06 Notifications permission: research

Route `/(onboarding)/notify` · Shell: none · States: pre / granted / denied (with Settings deep link) · Spec: BUILD_PROMPT_v3 §1.5 ("notifications are local only"), §2.1, §4.1; M23.

## Jobs to be done

- **Dani (teen):** When I leave the app while my egg incubates, I want to be told when it's ready, so I don't miss the hatch.
- **Dani:** When an app asks to notify me, I want to know exactly what it'll send, so I don't get spammed.
- **Marcus (lapsed):** When I've been away, I want at most a gentle reminder, never a guilt trip.
- **Renée (parent):** When my kid's app sends notifications, I want them to be harmless if I read them.

## Risks

- **Timing (highest).** M06 comes before the Caller has met Santoro or chosen an egg, so "your egg is ready" refers to something that doesn't exist yet. Android's guidance: "Before you ask users to grant any permissions, let them familiarize themselves with your app", and request "in the correct context, so that it's explicitly clear what the notifications are used for" (https://developer.android.com/develop/ui/views/notifications/notification-permission). M10, right after the Caller picks 15/30/60 min, is that context. Question for Mike: move the OS prompt to M10.
- **A denial is expensive.** On Android 13+, "Don't allow" blocks all of the app's notifications, and the system stops showing the dialog after repeated denials (Android runtime-permission behaviour; see the page above and its linked "handle denial" guide). Without the notification, the M11 → M12 return depends on the Caller remembering. That is the biggest funnel risk in `JOURNEY.md`.
- **Local notifications still need permission** on iOS and Android 13+. "Local only" (no push token, ADR 0001) is a privacy fact worth telling parents; it does not remove the prompt.
- **Promise only what ships.** The pre-permission screen says the only use is "your egg is ready" (M23: one notification per egg, ever). If care reminders arrive later, update this copy. v7's proposal caps care notifications at two per 24 h with quiet hours (`M7 L14670`); not canon, not Phase 1.
- **Appointment pressure.** Zagal et al. (FDG 2013) call "Playing by Appointment" a dark pattern when appointments are required for progress: https://www.diva-portal.org/smash/get/diva2:1043332/FULLTEXT01.pdf. The hatch waits for the Caller (M11 "overdue"), so copy must not imply the egg suffers if they're late (`M7 L388`: "No distress animation implies harm when the owner is away").
- **Language (Law 9):** "Caller", not "you, the owner"; no "device". Notification text that a parent may read must not contain the Caller name if it could be a real name (assumption; test with parents).

## Usability questions

1. Before the OS dialog, can players say what NYC-MON will notify them about?
2. Does grant rate or comprehension change when the prompt follows the incubation choice (M10) instead of coming before the meeting? (Run both orders in milestone 1.)
3. After denying, can players find how to turn notifications back on, and do they understand they'll need to come back to the egg themselves?
