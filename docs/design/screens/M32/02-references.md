# M32 Mon Space: references

Mobbin queries (iOS, `mcp__mobbin__search_screens`, 2026-10-29): "virtual pet care screen with icon menu of care actions"; "lock screen widgets showing app status"; "pixel art game screen with character and status hearts". Mobbin has no Tamagotchi, Pou or Bitzee screens (confirmed again in this pass), so the references below carry structure only: a menu of care verbs, a character with almost no chrome, and a glanceable status outside the app. References inform hierarchy, never pixels.

| Ref | Take | Reject |
|---|---|---|
| Lifesum quick-add menu — https://mobbin.com/screens/167ac79d-8ebd-4aed-842b-6eb8fd84857e | A grid of round icons, each with a one-word label (Breakfast, Lunch, Dinner, Snack, Weight, Exercise), and one round close button at the bottom. Meal and snack are separate verbs, the same split Decision #33 makes. One clear cancel. | Full-colour illustrations; our icons are 1-bit LCD glyphs. The meal-per-time-of-day split; we have one meal action |
| Tolan home — https://mobbin.com/screens/672c31d4-76ef-48cc-b55f-110f54475a91 | A full-bleed 3D companion on a ground plane, three small actions at the bottom, nothing else. The Mon owns the screen the same way when it steps out of the LCD | Sky gradients and a chat verb |
| WHOOP Lock Screen Live Activity — https://mobbin.com/screens/8e5c6a84-be67-48f2-89a1-4923f0a71f50 | A heart glyph with one number, read at a glance on the Lock Screen; dark panel, large numerals. The keychain widget's job in one block | A live workout timer; the keychain is a widget with no countdown |
| WHOOP Dynamic Island — https://mobbin.com/screens/b65ab661-c2c3-4989-a404-629011ba0d77 | The smallest useful readout: a heart and a value. Proof that hearts survive at accessory-widget size | — |
| Jomo Lock Screen — https://mobbin.com/screens/33f005dd-806b-467c-b7e0-563e8116e26a | Monochrome panel, one big numeral, one line of plain text under it. The segment-numeral age readout and status line at small size | Unlock-count framing |

Earlier references still apply and were verified in prior passes: Abode pet screen (https://mobbin.com/screens/d450f05c-bebb-4852-a443-c8f62468ff03, two meters top-left, a night toggle, three care buttons) and BitePal's Lock Screen pet (https://mobbin.com/screens/6367f897-015b-4f82-8ce7-0b4d21b5b4d0), both cited in `docs/research/vpet-modern-design-directions.md` §1.

Hardware references from the research (press sources, not Mobbin): Playdate's reflective memory LCD (https://sdk.play.date/1.9.3/Designing%20for%20Playdate.html) for the day look; Nothing's Glyph "Essential Notifications" (https://nothing.wiki/software/glyph_interface) for a light that stays until handled.
