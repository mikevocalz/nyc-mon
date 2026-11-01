# G01 Arcade controller overlay: research

Route: in-game overlay over `packages/app/features/game/GameScreen.tsx` (Game tab, `apps/mobile/app/(drawer)/(tabs)/game.tsx`) · Shell: none (the controller is its own hardware) · States: idle / playing / paused / stop-confirm / disabled / reduced-motion · Spec: Master Directive v2 §2, §4, §9, §10; input contract `packages/ui/game-controls/contract.ts`. Personas: `docs/design/research/PERSONAS.md`. References: `docs/design/research/arcade-controller-mobbin.md`, `arcade-ergonomics.md`.

## What the overlay is for

The Game tab today draws the city with a one-finger pan, pinch and twist, plus a camera column and a 3×3 move pad (`CameraControls.tsx`, `hud-layout.ts`). The overlay replaces that column with a left stick, six right buttons and a top-centre START/STOP pill. Until a gameplay spec exists the six buttons bind to the existing `CameraCommand` union (`camera-input.ts`: zoomIn, zoomOut, rotateLeft, rotateRight, moveForward, moveBack, moveLeft, moveRight, reset), so the overlay ships with real actions and no invented mechanics.

## Jobs to be done

- **Dani (teen, one-handed, sound often off):** When I pick up the Game tab on the train, I want to move and act without looking at my thumbs, so the controls have to sit where my thumbs already are and feel pressed through haptics and depth, not through sound.
- **Sol (adult, plays at night):** When the city is dark, I want the controller to read as a real piece of hardware, lit only where it needs to be, so it does not wash out the world I came for.
- **Marcus (returning):** When I come back after two weeks, I want the pill to say exactly what tapping it does right now (start, pause, resume), so I never stop a run by accident.
- **A left-handed Caller:** When I flip handedness, I want the stick and the cluster to swap sides with the labels still where I learned them, so a mirror is not a re-learn.
- **A Caller on a foldable:** When I half-fold into tabletop, I want the world up top and the controls below with nothing on the hinge, and I want the session to survive the fold.

## Risks

- **The arch is an easy claim and a hard proof.** "Two staggered rows on a subtle arc" (§2B) only exists if the six centres are published as numbers the Rive and layout lanes both read. `arcade-ergonomics.md` §7 is that table; any artboard that draws a rectangular grid fails review.
- **Stuck inputs.** A press that never gets its up event (a notification, a fold, a backgrounding) is the controller's worst defect. `GameInputRouter.cancelAll(reason)` exists in the contract; the design must show the cancelled state (every cap returns to idle, the pad springs home) so testers can see it.
- **The pill is three controls in one.** START, PAUSE and RESUME share one surface, and STOP is a hold. If the legend lags the session state by a frame the Caller taps the wrong thing. The session owns the state; the pill only reflects `pill/state` (§8).
- **Orange budget.** D5 allows one orange button per screen. On the overlay that is the pill in its `start` state. The six caps and the stick never take orange.
- **Daylit versus night.** The world runs in both schemes; the controller is a hardware object and does not change colour with the scheme (as the H-Lynk Core does not, Decision #16). Its graphite and black must hold contrast over a bright daytime city and a dark night one. `07-a11y.md` measures both backgrounds behind the pill's keyline.
- **Reduced motion.** Press compression, spring-return and the hold ring all need authored siblings (CONTRIBUTING.md standing standards); a stick that does not visibly deflect under reduced motion is unusable, so the reduced sibling still moves the pad, without spring overshoot.
- **Accessibility focus must not play the game.** A screen-reader user focusing a cap must hear its action and not fire it (§9); activation is an explicit double-tap. Rive semantics have to be authored for this (§8), and the native accessibility actions already on `GameScreen.tsx` (`A11Y_ACTIONS`) stay as the keyboard-free path.
- **Haptics are a setting.** `ControllerProfile.haptics` has `off`. Any press feedback that only exists as a haptic is invisible to Dani with haptics off and to web; depth and value change carry the state on every platform.

## Usability questions

1. In landscape, do Callers find all six caps with the right thumb without looking, at scale 1.0, on an SE-width phone and on a Pro Max? Which cap is missed most (prediction: Z, the far top-right)?
2. Does the hold-to-stop ring read as "keep holding" or as "something is loading"? Does anyone release early and think STOP failed?
3. When the pill flips from PAUSE to RESUME, do Callers notice without the world dimming? (If not, the dim is load-bearing and stays under reduced motion too.)
4. With handedness mirrored, do left-handed Callers reach for X where it used to be?
5. In tabletop posture, do Callers try to drag the stick across the hinge?
