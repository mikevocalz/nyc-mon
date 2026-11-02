# Website editor verification — 2026-10-30

Test environment: disposable Vercel sandbox, Node 24.22.1, pnpm 12.8.1, frozen workspace dependencies, PostgreSQL 18 on a private Unix socket. No production DB, credentials, published content, storage or deployment was changed.

## Passed

- 81 isolated content/URL/reference/copy-binding/preview-signature contracts.
- All 109 existing website tests.
- Four existing media URL tests.
- Twelve actual Payload/PostgreSQL integration checks: content-role create, anonymous draft exclusion, role-denied writes, unique upload keys and canonical CDN URL, publish, draft isolation, page/section usage report, immutable bytes and deletion safety, revision restore, iframe allowlist rejection, scoped draft preview and immediate role revocation.
- Native browser drag-and-drop through the actual Payload media form, media-library selection into Home → Hero, Save Draft without public changes, saved-draft preview/noindex, automatic preview refresh after a save, exit preview, Publish with changed copy and selected image, gallery/YouTube/UI iframe rendering, all twelve public marketing/legal routes, live-mode unpublishing without hardcoded fallback, and a 390×844 phone-width Story layout without horizontal overflow. A fresh browser sign-in landed content staff directly on Website pages. The 11 grouped browser checks then passed with zero website page errors.
- Whole-site seed export: 13 page/settings records, 68 image placements. Import created all records as drafts in the disposable database. A second run skipped all 13 existing records and made no content overwrites.
- New additive migration: apply → rollback → apply succeeded. Existing auth/account/session/version table names were unchanged throughout.
- Full website and Payload package typechecks; lint of every changed app/content/Payload/UI source file; generated Payload types and admin import map.
- Production admin build, feature-disabled production website build, and feature-enabled/live-mode production website build. The latter was exercised by the browser checks.

## Boundaries and remaining release operations

Bunny's external PUT transport was replaced with a guarded local test implementation. Real Payload file processing, hooks, generated CDN URLs, database writes and frontend image references were exercised. The tests do not prove production Bunny credentials or the production CDN's cache propagation. YouTube and approved UI iframe responses were controlled browser fixtures, so the tests prove the editor/renderer/sandbox policy, not live YouTube playback or the deployed UI host's framing/CSP configuration.

The existing historical full migration chain fails when bootstrapping an entirely empty database before this new migration (an older seed references `mon_voices` before it exists). To isolate this change, the declared feature-off baseline schema was initialized only in the disposable database, then the committed additive migration was tested up/down/up. No historical migration was rewritten and production schema push was never enabled.

CodeRabbit 0.9.1 was installed. `auth status --agent` returned not_authenticated, and `auth login --agent` returned environment_unsupported: this environment requires an Agentic API key. No CodeRabbit review was executed or claimed. An authorized environment can run `coderabbit auth login --api-key "<key>"` and then review the PR.

Production activation still requires the reviewed database migration, matching feature/preview/API/allowed-origin environment settings, a real Bunny content import, review/publish of the initial records, and switching from bootstrap to live mode. Those operations are documented in WEBSITE_EDITOR.md; they were not silently performed during code completion. Physical-device and final production visual checks remain separate from the browser width test.

A concurrent caller-avatar/User ID commit on this same branch was retained. Its independent contracts were rerun rather than overwritten.

## Local re-verification after merging main — 2026-10-30

Run on a Mac against the merged branch (main through #146), Node 24.15.0, PostgreSQL 14 on a throwaway local cluster, built admin and website serving on localhost. No production database, storage, environment or content was changed.

- Typecheck: `@acme/payload`, `web`, `admin-vite`, `@acme/content`, `@acme/ui` all exit 0.
- Contracts: 93/93 (site-content plus caller identity). Website tests: 109/109. `@acme/payload` vitest: 431 passed, 17 skipped (DB-gated), 0 failed.
- Payload integration (`verify-editor.mjs`) against the local database: 12/12.
- Migration `20261030_030536_website_editor`: apply, rollback, apply on a baseline built by the real migration chain. Rollback restores the baseline schema byte for byte (pg_dump, schema only); re-apply matches the first apply. `accounts`, `sessions`, `_accounts_v` and `_sessions_v` stay in place at every step.
- The empty-database chain still fails before this migration: `20261028_200000_mon_lingo_seed` reads `_language_lexicon_v_rels` through the Local API, and that table is created later by `20261029_234150_schema_rels_sync`. This is on main and unrelated to the editor. The local baseline marked the two seed migrations as applied to get past it.
- `migrate:create` with the editor on reports one drift that is also on main: the `mon_models` species enum lists the same 109 values in a different order (from main's fourth-starter content). No migration was added for it here.
- Seed export: 14 records and 76 image placements (main's fourth starter adds `/mons/lanternfye`). Local import created 14 drafts through the mock Bunny transport (21 objects written to a local directory); a second run skipped all 14.
- Browser (one Chromium, built apps): content-editor sign-in plus 11 grouped checks with zero page errors, all 13 marketing and legal routes; `reorder-restore.mjs` 2/2 (admin Move up then publish changes the public order; Restore this version brings it back).
- axe-core 4.14.0 on `/`, `/story`, `/city`, `/how-it-works`, `/get`, `/mons`, `/mons/lanternfye`, `/mons/hood-ratti`, `/legal/privacy` at 390 and 768, both motion settings: 0 violations, 0 contrast findings, after fixing a label-name mismatch on the Mon link cards that production also has.
- No horizontal overflow at 390 or 1440 on `/`, `/mons`, `/mons/lanternfye`, `/how-it-works` or the admin editor, after fixing a 4px overflow in the 3D model cards that production also has.
