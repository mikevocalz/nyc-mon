Source baseline: `b4080307965d541069ac2544ae03a818961d32f9` (PR #28). Local-only continuation, 2026-10-13. Home composition and its choreography are outside this slice.

# W03 City: implementation handoff

Implement only the district composition described in 03 and the one photographic-settle sequence. Reuse existing assets and kit; no home redesign, native-world work or new dependencies.

Motion ownership: the route-scoped controller receives only photographic DOM targets. Use installed Kinetrell `compileMotion` / `defineMotion` and `createGsapTimeline`; an IntersectionObserver gates first play without taking over scrolling. The timeline owns GSAP's existing ticker; no Lenis or RAF loop is added. Cleanup must revert timeline styles and disconnect observers/listeners. Missing targets or reduced motion leave the server composition intact.

Required checks: pure art/motion/lifecycle tests, web/UI/theme tests where available, web typecheck/lint, production build, local desktop/mobile visual and navigation QA. Record passed/failed/not-run honestly. Screenshot and independent review are required before calling the slice complete.

Gate: copy and factual assets are established above; independent contract review passed for the local candidate; formal fresh-research and rendered-acceptance gates remain open. The user explicitly authorized publishing this tested draft to PR #28 on 2026-10-13 after being informed that the branch updates GitHub Pages. This publication approval does not close the design acceptance gates.

## Exact implementation details

- Root `w03-city`; district region `w03-districts`; grid `w03-district-atlas`; photograph targets `w03-photo-downtown`, `w03-photo-midtown`, `w03-photo-harlem`; test IDs match these names. Existing `w03-districts-title`, `w03-cast-title`, `w03-cast` remain stable.
- Downtown: 4:5 crop on phones, seven columns/two rows from md, image occupies the remaining vertical region above its fixed caption; sizes `(min-width: 80rem) 44rem, (min-width: 48rem) 58vw, 100vw`. Leading photo eager with reserved geometry.
- Midtown/Harlem: 3:2 supporting crops, five columns from md; sizes `(min-width: 80rem) 32rem, (min-width: 48rem) 42vw, 100vw`; lazy with reserved geometry. Chrysler is top-aligned to preserve the spire. Captions and copy remain outside transformed crops.
- Mega City: full-width text-only fourth module, no image or geographic caption.
- Motion: image crop scale `pageMotion.scale.enter` (1.05) → 1; duration `pageMotion.duration.sm` (620ms); ease `pageMotion.ease.out.gsap`; support offsets 80/160ms, total 780ms. No opacity change, no moving text/control, no repeat. One top-of-grid intersection gate, not a tall-grid ratio threshold.
- Initial reduced motion: no timeline. Live change to reduce: revert/dispose immediately. Switching back does not replay the already-complete/static introduction. Missing IntersectionObserver or failed lazy import: static composition. Missing targets: skip before creating any timeline. A failed image keeps reserved geometry, alt/caption and district text; do not substitute a fabricated image.
- Async import completion after unmount cannot create a timeline. Observer, media listener and timeline have one owner, idempotent cleanup, and repeated visibility callbacks cannot replay.

The isolated local worktree was explicitly requested for this task to preserve an independently paused patch; it is a scoped exception to repository R1, not a new default. The atlas is composition of existing kit primitives, with no new app-only primitive or UI package.
