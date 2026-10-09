# M11 Incubating: research

Route `/(home)` while the save holds an egg and no Mon · Shell: H-Lynk · States: counting / ready / overdue (plus `resume`, a sub-state of ready for a hatch interrupted mid-presentation) · Spec: `docs/phase-1-brief.md` §2.1, §2.4, §4.2 M11; `V11 ¶49`; Decisions #4, #5, #7, #8; P2; `docs/design/research/JOURNEY.md` friction 1.

The Caller has chosen an egg (M08), picked 15, 30 or 60 minutes (M10) and seen the case close. M11 is the wait. Most Callers leave the app here and come back through the M23 notification, so this screen is seen twice: right after M10, and again on return.

## Jobs to be done

- **Dani (teen):** When I've just chosen my egg, I want to know how long it takes and that I'll be told, so I can put the phone down without worrying.
- **Dani:** While I wait, I want something small to do with the egg, so the wait feels like keeping it company and not like a loading bar.
- **Sol (adult):** When I come back, I want the screen to tell me at once whether it's ready, so I don't have to read a timer.
- **Marcus (lapsed):** When I open the app hours after the egg was ready, I want it to still be waiting for me with no damage report, so I don't feel I failed it.
- **Jayden (under-13, consent pending):** I want the wait to work the same as everyone else's, on this phone.

## What canon and the code already fix

- Incubation is 15, 30 or 60 minutes. "When ready, the player receives a notification; tapping it opens the hatch screen. Hatch is atomic" (`V11 ¶49`). Length has no stated effect (Q27, open): copy must not imply a longer wait buys anything.
- The egg sits in the single-egg case (`V11 ¶64`); whether the case is the incubation cradle is still Q4. The brief says it is (§2.4). Copy says "case", never "capture" (Q4 asks this; the safe answer is the one that can't be wrong).
- The scanner LED reports `incubating` then `ready` (Decision #7, `docs/design/hlynk/DIRECTION.md` "The scanner LED is a status light"). `ready` covers "ready or overdue".
- The egg is `EggRecord` in `save.eggs`; its hatch state is `HatchState` in `save.hatches` (`packages/core/schemas/hatch.ts`). There is no `MonInstance` yet, so the brief's "`stage: "Egg"`" cannot be read from `selectStage` (it returns `undefined` before hatch). M11 keys off the egg, not the stage.
- `resolveBootRoute` already returns `incubating` and `egg-ready` for M11, and `egg-ready` also covers a hatch that was `presenting` when the process died (`packages/core/sim/boot.ts`, `isEggReady`).
- `scheduleReadyNotification` already exists and is idempotent per egg (`identifier: egg-ready-${eggId}`, `packages/app/features/onboarding/notify-permission.native.ts`). M06 already wrote the M11 status rows for notifications off and scheduling failed.

## Risks

- **The missed return (highest).** JOURNEY friction 1: the Caller leaves and never comes back. M11 must schedule the notification on entry (not only at M10), show plainly when notifications are off, and give the time it will be ready as a clock time the Caller can remember.
- **Countdown as pressure.** A seconds counter turns a 15-minute wait into a game of watching. The brief bans countdown pressure. Minutes only, a ring that fills, and no seconds anywhere except the last minute's "Less than a minute".
- **Overdue as guilt.** Copy that says "late", "waiting for you" or counts hours past ready reads as blame. Overdue is a calm fact: "Ready since 4:12 PM". No red, no badge count.
- **"Warm the case" as a lie.** If warming looks like it speeds things up, the Caller learns a false rule. The hint states the truth: it does not change the time. It is company, not a mechanic.
- **Haptic-only feedback excludes people.** Haptics fail on phones with haptics off, on most Android tablets, and in the Quest 2D window (phone haptic APIs do not reach the Touch controllers). The warm needs a visual and spoken equivalent.
- **Poké Ball read.** A closed case drawn round, red-over-white, or with a centre button reads as a Poké Ball (§2.4). Square, metal, hinge at the back, handle on top, the rounded-square pad offset on the front face.
- **Foreground notification double-tap.** If the Caller is on M11 when the egg turns ready, the OS banner and the in-app ready state arrive together. The banner is redundant on M11.

## Usability questions (hallway test, 5 people)

1. After the case closes, without touching anything: "When will your egg be ready, and how will you find out?" (Pass: a clock time or minutes, and "a notification".)
2. "Does holding the case do anything to the egg?" (Pass: "no, it's just for fun" or similar. A "yes, it speeds it up" answer fails the hint copy.)
3. Open the app 3 hours past ready: "How do you feel about your egg right now?" (Pass: neutral or eager. Any "I neglected it" answer fails the overdue state.)
