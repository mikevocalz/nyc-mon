# Website editor verification — 2026-10-30

The expanded implementation was built and tested in an isolated Vercel sandbox with Node 24.22.1, pnpm 12.8.1, frozen workspace dependencies and PostgreSQL 18 on a private Unix socket. No production database, storage, credentials, published content, merge or deployment was changed.

## Verified results

- 81 content, embed-URL, reference, copy-binding and signed-preview contracts passed.
- All 109 existing website tests passed.
- Four existing media URL tests passed.
- Twelve actual Payload/PostgreSQL integration checks passed: editor access, anonymous draft exclusion, role-denied writes, unique media names and CDN URLs, publish, draft isolation, page/section usage reporting, immutable bytes/deletion safety, revision restore, iframe rejection, scoped preview and immediate preview revocation after role removal.
- Eleven grouped end-to-end browser checks passed with zero website page errors: native drag/drop upload, selecting an image from the library into Home/Hero, Save Draft without changing the public page, saved-draft preview/noindex, preview refresh after saving, exit preview, Publish changing copy and images without redeployment, gallery/YouTube/UI iframe rendering, all twelve public marketing/legal routes, unpublish without hardcoded fallback, and a phone-width Story page without horizontal overflow. A fresh content-editor login also landed directly on Website pages.
- Whole-site export contains 13 page/settings records and 68 image placements. The isolated import created drafts; repeating it skipped all 13 existing records without overwriting content.
- The additive migration passed apply → rollback → apply. Existing auth/account/session/version table names were unchanged.
- Full website and Payload package typechecks, changed-source lint, generated types/import map, production admin build and feature-on/live-mode production website build passed.
- The concurrent caller-avatar/User ID change was preserved and its 33 isolated contracts passed.

## Boundaries

Bunny's external storage PUT transport was replaced with a guarded local test transport. Actual Payload processing, upload hooks, database writes and CDN URL rendering were tested, but production Bunny credentials and cache propagation were not. YouTube and the approved UI iframe used controlled browser responses; this is not a claim of live YouTube playback or the deployed UI host's framing/CSP compatibility.

An older migration in the pre-existing full empty-database chain references mon_voices before its table exists. The new migration was therefore tested against an isolated declared feature-off baseline. No historical migration was rewritten and production schema push was never enabled.

CodeRabbit 0.9.1 was installed but not authenticated. Its agent login returned environment_unsupported and requires an Agentic API key. No CodeRabbit review was executed or claimed.

Production activation requires the reviewed migration, feature/API/preview/allowed-origin environment settings, actual Bunny import, review/publication of initial records and switching bootstrap mode to live mode. Physical-device and final production visual checks remain separate.

The implementation is being transferred to this PR through direct repository file operations after the bulk commit operation was blocked. This verification record alone does not imply that every implementation file has been committed yet.
