# W03: published layout regression

The first publication, source `5564de3b3ef64349a2092f282b9a17bb50602097`, passed CI and the Pages snapshot/deployment. Its post-deployment cloud-browser check exposed the previously unverified height issue: at a 1180px viewport, Downtown's list item spanned 995.66px, but its implicit grid row was only 566px and its panel root was 560px tall. The leading photo stayed at its 384px minimum, leaving an empty lower-left region.

Cause: React Native Web's inherited `align-content: flex-start` prevented the implicit row from using the grid item's allocated height. The fix explicitly applies `content-stretch` to each district item. It does not alter the shared kit, home, copy, assets or motion.

Independent source review confirmed this measured cause and the narrow fix. Two unit regressions lock down alignment and spans. The new `tooling/site-qa/city-layout.mjs` browser check measures the actual route at 320, 390, 768, 1180 and 1280 pixels with reduced motion, checking overflow, mobile order, desktop panel-bottom alignment and leading-photo growth. It runs in the existing CI job after the production build, using the Chromium already installed there. Local browser execution remains unavailable; record the exact-head CI and published-browser result separately rather than treating this document as a pass.

The first published browser check also confirmed all three photos loaded and no horizontal overflow at 1180px. Scrolling into the unchanged StreetPulse then produced the same cloud WebGL-context error previously seen on the baseline. That environment limitation is separate from the confirmed atlas layout defect and does not establish device/GPU acceptance.
