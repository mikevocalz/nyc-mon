# M01 Boot / power-on: research

Route `/` · Shell: H-Lynk · States: first-run / returning / offline · Spec: BUILD_PROMPT_v3 §4.1, Decisions #7, #8. Personas: `docs/design/research/PERSONAS.md`.

## Jobs to be done

- **Dani (teen, first run):** When I open the app for the first time, I want to see right away that this is something from the NYC-MON world, so I know it isn't another generic pet app.
- **Marcus (lapsed):** When I come back after days away, I want to land on my Mon in one step, so I don't have to sign in again or sit through onboarding I've already seen.
- **Sol (adult):** When I open it at night, I want it to start fast and look like an object, so it feels like a device I own instead of a splash screen.
- **Everyone, offline:** When I have no signal on the subway, I want the app to still open to my Mon, because the sim runs locally (§1.4).

## Risks

- **Routing is the real job.** The 600 ms power-on only works if the route decision is ready by then. A returning player whose egg is mid-incubation must land on M11; one whose egg is ready or overdue goes to M11 "ready" or M12; one with a Baby goes to M13. A player who lands on M02 again will think their Mon is gone (lapsed persona, `JOURNEY.md` risk 8).
- **The LED is a status light, not decoration** (§2.4). Red per Decision #7. If it pulses like a loading spinner, players read it as "waiting for network". Its power-on meaning should differ from its "needs you" meaning at M13.
- **Canon and language (Law 9):** no "device" in any visible or VoiceOver text; the object is the H-Lynk. Decision #8: no boot copy may imply the H-Lynk owns or controls the Mon ("Connecting to your Mon…" suggests the device holds it). The bezel appears here even though BUILD_PROMPT §2.4 lists the bezel only on companion screens; confirm with `design-director` that M01 is the deliberate exception the screen map already says it is.
- **COPPA:** a first-run boot must not create a persistent identifier tied to an account before M04. Local-only state is fine; any analytics call before the age gate is not. The FTC COPPA FAQ (https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions) treats persistent identifiers as personal information.
- **Reduced motion:** the power-on needs an authored reduced-motion sibling (a steady LED, no ramp), not the same animation sped up.
- **Offline first run:** with no network and no account, the app can't reach sign-in. It must still show the boot and then say plainly what it needs, not hang.

## Usability questions

1. On cold start, do first-time players read the red LED as "powering on", "loading" or "something is wrong"?
2. Do returning players with a hatched Baby reach M13 without tapping anything, and do they notice they skipped onboarding?
3. When offline on first run, can players tell what to do next within 5 seconds?
