# M14 Feed: research

Route `/(home)/feed` (sheet over M13) · Shell: H-Lynk · States: tray / dragging / eating / full / declined · Spec: brief §4.3 M14, §2.1 ("every food-capable Mon has an anatomy-appropriate eating animation and reaction"), §3.2 clips `eat_{food_class}`, `eat_react_good`, `eat_react_bad`, `refuse`; `V11 ¶51`; OPEN_QUESTIONS Q7, Q22, Q23, Q24, Q31.

## Jobs

- **Dani:** When my Mon asks for food, I want to give it something it likes and watch it eat, so feeding feels like taking care of someone, not tapping a refill button.
- **Jayden (under-13):** I want to know which food to pick without reading a menu.
- **Renée (parent):** If my kid feeds too much, I want the result to be gentle, not a sick pet.

## What exists (verified 2026-10-08)

- `CareActionSchema` `feed` = `{ kind: 'feed', foodClassId, nutrition }`; `nutrition` comes "from the food's content record" (`packages/core/schemas/care.ts`).
- **There is no food content.** `packages/content` has `eggs.ts` and `mons/*` only. No `food.ts`, no `FoodDefSchema` in `@acme/core`. Every species has `foodClassIds: null` (`content/mons/define.ts`, "TODO(canon): food classes (OPEN_QUESTIONS Q22)").
- Sim outcomes for feed (`applyCareAction`): `eaten`; `overfed` when Fullness was ≥ `overfeedAtOrAbove` (0.9) before the meal, which sets `sluggishUntil` (+45 min); `declined` with `asleep` or `sluggish`.
- Feeding while a request is pending adds `answeredRequestBondGain` (0.01) to bond on top of `feedBondGain` (0.005).
- v7 (proposal, not canon) favourites: Hood Ratti line chopped cheese and fries; Bodega Cee line chicken wings and fries; Yotes spicy chicken over rice (Q24). v7: "Favorites are preferences, not restrictions" (Q22). v7 Babies: "caretaker-prepared fictional starter portions; no adult takeout mouth animation" (Q23).

## Risks

- **The tray has nothing in it.** Without `content/food` the screen cannot ship. No agent invents a food (Law 1). This is the M14 blocker and a milestone-4 item ("food content", §9).
- **Overfeeding reads as punishment.** The brief wants a canon-safe consequence: sluggish, never sick. Copy must say what happens before it happens.
- **Sim edge.** Overfeed is judged on Fullness before the meal. Feeding at 0.85 with a 0.4 meal lands at 1.0 (clamped) with no consequence; feeding at 0.9 with a snack is "overfed". Players will read this as random. Flag to `sim-core` (proposal: judge on the post-meal value, `fullness + nutrition > 1`).
- **Drag is a precision gesture.** Drag-to-Mon must have a tap-to-select twin (WCAG 2.5.7 Dragging Movements, https://www.w3.org/TR/WCAG22/#dragging-movements).
- **One eat clip for all** would break §2.1. Clip sets are per bloodline and wait on Mike's models.

## Usability questions

1. Without instruction, do players drag food to the Mon or tap it? (Both must work.)
2. When the Mon is full, do players understand why it turns away and what happens if they insist?
3. Do players notice which food the Mon prefers from its reaction alone?
