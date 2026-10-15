# Kit issues found during the Alexa+ work

Draft, for Mike to decide. The kit (`packages/ui`) is Mike's: feature work doesn't edit it, so these are listed here instead of fixed. Each has a proposed fix; nothing in this PR changes the kit.

## 1. Care ring contrast is under 4.5:1 in daylight

`packages/ui/care/care-colors.ts:11-12`: fill `palette.royal[500]` on track `palette.concrete[200]` measures 3.77:1. That passes WCAG's 3:1 for graphics, but Alexa's add-on rules ask 4.5:1 for colour inside graphics.

Proposed: a darker daylight fill or a darker track until the pair reaches 4.5:1, checked in the CareMeterRing GroupDaylit story.

## 2. AuthProviderButton disappears inside a toned Card

Inside any `Card` with a `tone` or `district`, the card overrides `--color-text` and `--color-text-muted` to white, but `AuthProviderButton` keeps painting `bg-surface-raised`. The label and border go white on white. The linking page works around it by placing the button outside the card, as M03's sign-in does.

Proposed: the button resets those two text tokens on its own root, plus an `InsideToneCard` story covering every tone in light and dark. This was written and then reverted on 2026-10-08 because kit changes need Mike's approval.

## 3. StatusRow chip and ring captions inside a toned Card in dark mode

Same cause as #2: inside an orange card in dark mode, the neutral `Badge` chip text and the `CareMeterRingGroup` captions go dark on dark. The Alexa views avoid it by placing the status and rings beside the card, as their stories show them.

Proposed: same token reset on those two components, with stories. Also written and reverted.

## 4. Creature alt texts are too long for Alexa

The `CREATURE_ART` alt texts in `packages/assets/creatures/index.ts` run 161–170 characters; Alexa's limit is 125.

Proposed: shorter alt texts (Mon form, Bloodline and pose), kept in the assets package.

## 5. Server render logs `requestAnimationFrame is not defined`

From react-native-worklets via reanimated's frame registry when the kit is server-rendered in admin-vite. The pages still render.

Proposed: define no-op `requestAnimationFrame` and `cancelAnimationFrame` in `packages/ui/rn-globals-shim.ts` only when there's no `window`. Also written and reverted.
