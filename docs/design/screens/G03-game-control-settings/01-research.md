# G03 Game-control settings: research

Route: a sub-route of the existing settings screen (`apps/mobile/app/(drawer)/settings.tsx`, `packages/app/features/settings/screen.native.tsx`) · Shell: none (settings follow the OS appearance, D8) · States: default / edited / restored / invalid-clamped / placement-invalid · Spec: Master Directive v2 §13 "Game-control settings", §10 adaptation table; `packages/ui/game-controls/contract.ts` (`ControllerProfile`, `DEFAULT_CONTROLLER_PROFILE`). Personas: `docs/design/research/PERSONAS.md`.

## Jobs to be done

- **Dani (teen, one-handed, mid-range Android, sound off):** When the six buttons sit under my right thumb but I hold the phone in my left, I want to flip the controller to the other side in one tap, so I can keep playing on the train without changing my grip.
- **Sol (adult, plays at night):** When the controller covers too much of the world, I want to shrink it and let the city show through, so the overlay feels like part of the hardware and not a sticker on the scene.
- **Marcus (returning):** When I come back after weeks and my thumb drifts off the stick, I want a bigger dead zone and a slower stick without reading a manual, so the first minute back is not a fight with the camera.
- **A left-handed Caller** *(research question, no persona yet)*: When I switch to left-handed, I want the stick and the cluster to mirror and every label to stay readable, so "left-handed" is a layout and never a worse version.
- **A Caller using VoiceOver or Switch Control** *(research question)*: When I change a slider, I want to hear the value I set in words I understand ("Dead zone, 15 percent"), so I can tune the controller without seeing the track.
- **A tablet Caller:** When the clusters sit too far from where my hands rest, I want to move them to my grip and have the game refuse a position on the hinge or under the home indicator, so my layout never breaks when I fold or rotate.

## Risks

- **A second profile system.** The directive bans one (§13). Every field on this screen is a `ControllerProfile` key from `packages/ui/game-controls/contract.ts`; the screen edits that one object through one Zustand slice and the existing MMKV plus Zod storage path (Laws 4 and 5). Any field that is not in `ControllerProfile` is either added to the contract by the owning lane or not shown.
- **Invented actions.** Remapping is limited to the `ControllerBindings` the gameplay screen exposes. Today the only action union in the repo is `CameraCommand` in `packages/app/features/game/camera-input.ts` (`zoomIn`, `zoomOut`, `rotateLeft`, `rotateRight`, `moveForward`, `moveBack`, `moveLeft`, `moveRight`, `reset`). The settings screen never names a move, ability or combat verb. Until a gameplay spec exists the bindings section is a read-out, not an editor.
- **A duplicate reduce-motion toggle.** The OS owns reduced motion; `useReducedMotion` in `packages/ui/backgrounds/use-reduced-motion.{native,web}.ts` reads it. An in-app toggle would let the two disagree. The screen shows the OS state as a status line and links to system settings.
- **Drag-only placement.** WCAG 2.2 SC 2.5.7 (https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) requires a single-pointer alternative to dragging. The placement editor needs nudge buttons and keyboard arrows, not only a drag.
- **Sliders that speak numbers nobody set.** `deadZone` is a fraction (0 to 0.5), `sensitivity` a multiplier (0.5 to 2), `scale` a factor (0.8 to 1.4), `opacity` a fraction (0.3 to 1). Shown raw they read as engineering. Each needs a display unit (percent, times) and a spoken value.
- **Clamping silently.** Zod clamps or rejects out-of-range values on read. A persisted profile from an older build must not surface as a mystery change; the screen says when a value was brought back into range.
- **Preview that is a picture.** A static image of the controller would break the directive's "no static artwork" rule and would not show scale, opacity or handedness. The preview is the real `ArcadeController` mounted read-only.
- **The under-13 Caller.** Nothing here collects data, but "Restore defaults" is destructive to a child's layout. It asks first, in plain words, and does nothing on cancel.

## Usability questions

1. Do Callers find "Dead zone" and "Sensitivity" without a definition, or do the one-line captions under each slider carry the meaning?
2. Does the live preview above the controls make the scale and opacity sliders self-explaining, or do players scrub the slider and look at the game instead?
3. Left-handed Callers: after mirroring, do they expect the pill to move, the labels to flip, or both? (The pill stays top-centre; labels never mirror.)
4. On a tablet, do Callers drag the cluster to where their hands are, or do they only use the preset edges? If nobody drags, the editor is a candidate for DEFER.
5. VoiceOver: does "Dead zone, 15 percent, adjustable" read as a tuning control or as a progress value?
