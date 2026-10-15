# W03 City: independent source review

Baseline: `b4080307965d541069ac2544ae03a818961d32f9`, PR #28. Local draft reviewed 2026-10-13; no publication.

Result: PASS for the bounded local candidate. This is source review, not rendered design acceptance.

Reviewed the City composition, existing asset and copy reuse, Kinetrell adapter boundary, asynchronous lifecycle and cleanup, reduced-motion behavior, accompanying tests, and separate href-only routing correction.

Resolved during review:
- Corrected the existing ESLint basename pattern so `kinetrell/web/gsap` is permitted while direct `gsap` and `gsap/ScrollTrigger` remain forbidden outside the existing scoped exception. Regression tests cover both sides and the unrelated platform import restriction.
- The server HTML checker inspects actual class attributes, not globally bundled homepage selector text.
- The checker requires all three known photo images, nonempty alternative text and base-prefixed local asset URLs before fetching each. Missing images can no longer silently skip verification.
- Removed Next's generated worktree-specific TypeScript include paths from the deliverable.

No remaining source blocker found. Fresh per-screen Mobbin research and post-change browser/visual acceptance remain open. The independent reviewer performed no edits, builds, tests or publication; execution evidence is recorded separately.
