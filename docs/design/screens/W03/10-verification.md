# W03 City: local verification

Baseline: `b4080307965d541069ac2544ae03a818961d32f9`, PR #28. Verification date: 2026-10-13. Local-only candidate; no remote branch, deployment or live form submission was changed.

## Passed

- Web unit tests: 86 passed, 0 failed. Includes 10 base-path helper tests, 14 City art/motion/lifecycle tests and 2 ESLint boundary tests.
- UI unit tests: 327 passed, 0 failed.
- Pure theme tests (`contrast`, `page-tokens`, `xr-tokens`): 402 passed, 0 failed.
- Workspace `turbo typecheck lint --concurrency=2 --env-mode=loose`: 28 successful tasks, including 12 cached tasks. Existing mobile/UI warnings remain. Final web typecheck and lint were rerun successfully after the ESLint regression change.
- Production web build with `NEXT_BASE_PATH=/nyc-mon`, `NEXT_DIST_DIR=.next-pages-review` and `NEXT_PUBLIC_SITE_URL=https://mikevocalz.github.io/nyc-mon`.
- `tooling/site-qa/pages-contract.mjs` against that locally served production build: all 12 public routes returned 200 and kept root-relative anchors under `/nyc-mon`; Mons back links and the home/How It Works/Story waitlist CTAs had the expected targets.
- City server HTML: district reading order, one h1, three expected photograph targets, no invented Mega City photo and no armed homepage class. All three photograph URLs returned 200 with image content types and nonempty bodies.
- Independent source review and `git diff --check`.

Use the repository-pinned pnpm 12.8.1. The HTTP contract expects a locally running production server, accepts `BASE` and `BASE_PATH`, writes its JSON report to ignored `tooling/site-qa/out/pages-contract.json`, and never publishes or submits a form. It includes City-specific checks and therefore belongs to this draft, not to the independently reviewable URL-only patch.

## Not run / open gates

- Post-change screenshots, computed responsive layout at 320/390/768/1280 widths, 200% zoom, light/dark visual checks, keyboard navigation and real browser Back/Forward.
- Real browser reduced-motion/no-JS behavior, repeated mount/route navigation and live console/page-error checks. The pure lifecycle tests cover the controller contract, not browser execution.
- Browser-based theme scope tests (`scheme-scope.test.ts`). The three pure theme files above are not the entire theme suite.
- Fresh per-screen Mobbin queries; only the repository's committed reference research was reused.
- Hardware/GPU performance or device acceptance, native world rendering and form/server-action behavior on static Pages.

Local Playwright could not launch the installed Chromium because `socket()` was denied by the execution environment, including on an approved execution retry. No browser security flags were changed. The separate cloud browser inspected the published baseline but could not reach this isolated local server. Published baseline screenshots are not after-change evidence.

The local build and HTTP checks do not certify the output of GitHub Pages deployment or browser hydration. Do not label the design pipeline, accessibility review or full acceptance complete until the open gates are satisfied.

## Preservation and ownership

Home composition, choreography, shared home motion and global styling are unchanged. The separately packaged URL correction only adjusts its CTA and shared footer destinations, plus affected non-home plain anchors. StreetPulse, district/cast/story copy, consent logic, asset binaries and dependencies are unchanged.

The active source branch `claude/jolly-dirac-dtzmjy` has a Pages workflow triggered by pushes. After the local checks above, the user explicitly authorized publication to PR #28 with that automatic Pages update disclosed. The branch head was rechecked at 20:33 UTC and remained at the tested baseline b408030; publication uses an expected-head check without force. Post-publication CI, deployment and live-browser results must be verified separately. The separately paused Three lifecycle patch was not included or retried.
