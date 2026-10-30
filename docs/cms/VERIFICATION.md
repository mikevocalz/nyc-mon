# Website editor verification — 2026-10-30

This report supersedes the earlier partial draft report. The implementation was tested against the installed workspace dependencies in an isolated Vercel sandbox (Node 24.22.1, pnpm 12.8.1, PostgreSQL 17), with real Payload 4, Better Auth, Next.js and Chromium. No production database, secrets, published content or storage was changed.

## Passed

- Full dependency-aware TypeScript checks: @acme/content, @acme/ui, @acme/payload, web and admin-vite.
- Production admin build and production website build with the editor enabled.
- 132 dependency-free content/copy/preview/URL/seed/avatar checks; 0 failures.
- 109 existing website tests; 0 failures.
- Payload regression suite: 408 passed, 17 pre-existing skipped, 0 failed (29 passing files, 5 skipped).
- Changed-source ESLint checks for website, Payload/editor, content and assets; 0 errors.
- Actual additive migration UP against the pre-editor schema preserved all 1,005 existing columns and the sentinel user; no tables removed. DOWN also executed successfully on a separate disposable test database and preserved the sentinel user. Historical migrations were not rewritten.
- Whole-site import: 13 draft records, 74 image placements, 22 unique source images. A second apply skipped all 13 existing routes without overwriting them.
- 11 authenticated HTTP integration checks: imported drafts excluded from anonymous reads; publish; draft isolation; signed private preview; public Next.js updates; all 12 public marketing routes; unpublish without hardcoded fallback; referenced-media deletion guard; Caller edit denial; unsafe iframe rejection; published-only sitemap.
- 5 native Chromium browser checks with zero page errors: drag/drop upload and Save, private autosave, Publish changing the actual public page, Avatar first / full User ID second, and avatar visibility at phone width.
- 5 additional media/revision checks: image relationship replacement, ordered gallery and YouTube rendering, accurate page/section usage, version restoration of the original image, rejection of referenced-byte overwrite, and restored public content.

## Storage and environment boundaries

The real Payload storage hook ran, but its Bunny HTTP transport was replaced with the explicitly guarded test double in tooling/site-editor/mock-bunny.mjs. Bytes were persisted under /tmp/editor-bunny and image relationships were persisted in PostgreSQL. This proves the upload/import-to-publish path, not production Bunny credentials or remote CDN behavior. Browser checks used Chromium desktop and a phone-sized viewport, not physical iPad/iPhone hardware. YouTube embed URL generation/rendering is verified, not remote video playback. Actual UI iframe providers must be configured in SITE_EMBED_ORIGINS and permit framing through their own headers.

## Rollout gate

Code and isolated verification are complete. Production enablement still requires the reviewed additive migration, matching admin/website configuration, a dry-run then draft import using an existing ops/content actor, inspection of actual CDN media and draft previews, and publication of the original-content records before switching the public website to CMS reads. Do not run PAYLOAD_PUSH in production. Keep the feature off until those steps are complete. CodeRabbit was not run and no CodeRabbit approval is claimed.

The repeatable integration workflow is .github/workflows/site-editor-verification.yml. Evidence artifacts exclude generated passwords, authentication cookies, preview tokens and full server logs. Test scripts and production rollout commands are documented in docs/cms/WEBSITE_EDITOR.md.
