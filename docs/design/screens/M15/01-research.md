# M15 Rest: research

Route `/(home)/rest` · Shell: H-Lynk · States: awake→sleep / sleeping / wake · Spec: brief §4.3 M15 ("Dim the room; the Mon sleeps; Energy recovers on the sim curve. Waking early has a cost. Lights-off uses the time-of-day rig."), §3.2 clips `sleep_in`, `sleep_loop`, `wake`; OPEN_QUESTIONS Q19, Q25.

## Jobs

- **Dani:** When my Mon is tired, I want to put it to bed and leave, trusting it will be fine.
- **Jayden:** I want to wake my Mon up to play right now, and know what that costs.
- **Renée:** I want bedtime in the game to model calm, not a reason to keep checking the phone.

## What the sim does (verified 2026-10-08, `packages/core/sim/care.ts`, `tuning.ts`)

- `rest` → `activity: asleep`, `lastRestedAt` set; declined `already-asleep`.
- Asleep: Energy recovers at `energyRecoveryPerHourAsleep` = 1/3 per hour (empty to full in 3 h). Fullness and Social still decay, more slowly (1/16 per hour; half-life 18 h).
- The Mon wakes by itself when Energy reaches 1 (`woke`, cause `rested`). The Caller does not have to come back.
- `wake` → awake; if Energy < `earlyWakeEnergyBelow` (0.6) it is an early wake and Social drops by `earlyWakeSocialCost` (0.05). Declined `already-awake`.
- No food request while asleep (`ensureFoodRequest` requires awake); low Fullness can still cross needs-you while asleep.

## Risks

- **Cost hidden until after.** "Waking early has a cost" must be shown before the Caller commits, or it reads as a trap.
- **Accidental wake.** A single tap on a sleeping Mon must not wake it. The brief's Home tap says "attention"; on a sleeping Mon that becomes a quiet look, not a wake.
- **Real night vs game sleep.** Q25: v7 proposes an 8-hour owner-chosen window; the brief has manual Rest. With manual only, a Mon put to bed at 22:00 wakes by 01:00 at the latest and spends the night awake and decaying. Design follows the sim (manual); the mismatch goes to Q25.
- **Dark room contrast.** Dimming the scene must not dim the controls or the text below AA.

## Usability questions

1. Do players understand they can close the app while the Mon sleeps?
2. Before waking early, can players say what it costs?
3. Do players find the wake action without trying to tap the Mon?
