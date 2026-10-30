# NYC-MON website editor

The existing Payload 4 admin owns website pages, named sections, copy and image relationships. Neon stores content; existing Bunny hooks store image bytes. R2 city assets, game canon, Better Auth and gameplay are unchanged.

## Editing

Open **Operations console → Website pages & media**. Select a page, then its named section. Copy rows have descriptive labels and stable keys; change the value, not the key. Upload an image by dragging it onto the native upload control or select an existing item. The media library shows its page/section/field usage, including revisions. To replace one placement, upload a new media item and select it in that image block. Replacing shared bytes and deleting media are deliberately blocked so drafts and saved versions cannot break.

Sections support text, image, gallery, YouTube and approved UI iframe blocks. Drag section/gallery rows to reorder them; hide a section with its visibility checkbox. Native layout image slots have stable position keys; `inline` adds an ordinary image beneath that section. Gallery rows carry independent alternative text and captions; image blocks have focal-point controls. Only approved HTTPS iframe origins are allowed; arbitrary HTML, JavaScript, credential URLs and admin/auth/preview embedding are rejected. The UI component renders accessible titles, responsive aspect ratios and a sandbox. A provider must also permit framing in its own CSP/X-Frame-Options.

Draft autosave does not update the live site. Publish does. Preview is an expiring signed link bound to its page, editor and exact website origin; the server rechecks the editor's current role. Preview pages are private/no-store and noindex. Never share a preview URL publicly. Versions retain 30 revisions. Public requests use published-only anonymous reads with no-store; an unpublished page does not fall back to the old shipped page. A CMS outage surfaces an error rather than silently showing old copy. The sitemap includes only published public routes.

## Included content

The import starts with the existing site, not placeholders: Home, Story, City, How It Works, Mons, its three starter detail pages, Get, the three legal pages, and the shared header/footer document. This is 13 CMS records, 12 public pages, 74 image placements and 22 unique image sources. Display-copy overrides do not change canonical game data. Existing form submission, consent logic and renderer behavior are preserved. A new route can use ordinary content sections through the catch-all template.

The Callers table uses the stored profile image in column one and the full User ID in column two. Missing/broken photos fall back to a generic avatar. Names/emails retain their existing reveal controls; no extra Caller permissions are granted.

## Configuration and rollout

Admin: `NYCMON_SITE_EDITOR=1`, existing database/auth/Bunny settings, `SITE_PUBLIC_URL` (exact public website origin), `SITE_PREVIEW_SECRET` (a separate random 32+ character secret), and optional comma-separated `SITE_EMBED_ORIGINS` (exact approved UI origins). Keep `PAYLOAD_PUSH=false` in every deployed environment.

Website: `NYCMON_SITE_EDITOR=1`, `PAYLOAD_SITE_API_URL` (the existing admin's `/payload-api` URL), the same `SITE_PREVIEW_SECRET`, `SITE_ADMIN_ORIGIN` (exact admin origin), the same `SITE_EMBED_ORIGINS`, and `NEXT_PUBLIC_SITE_URL`. Preview configuration and iframe origin policy must match on both apps.

For the read-only import export, temporarily set `SITE_CONTENT_SEED_TOKEN` to a separate random 32+ character token, and `SITE_SEED_SOURCE_ORIGIN` (or `SITE_PUBLIC_URL`) to the exact deployment serving the source images. Fetch `/api/site-content/seed` with a Bearer token and save the JSON outside the repository. Disable the seed token after import. Do not put any secret in public environment variables, a commit, a screenshot or a PR comment.

Deploy the reviewed migration `20261030_044717_website_editor` to an isolated branch first. Its UP is additive: website tables/types/indexes/relationships, media fingerprints and locked-document relationships only. It does not remove or replace auth/version tables. Back up production before applying it. Review the DOWN separately: rollback deletes editor content, so normal operational rollback is disabling the feature flag while retaining the additive schema, not running DOWN.

The older repository migration sequence has a fresh-database ordering problem: `mon_lingo_seed` expects version tables introduced by the later `schema_rels_sync`. This change does not rewrite historical migrations. The isolated test harness creates the current pre-editor baseline schema, then exercises only the new migration while asserting every existing column and sentinel user is preserved. Production's migration ledger must already include the baseline migrations before rollout.

With the reviewed schema applied, run the importer from the monorepo using Payload's installed loader:

```sh
# Environment: SITE_SEED_MANIFEST, SITE_IMPORT_SOURCE_ORIGIN,
# NYCMON_SITE_EDITOR=1, PAYLOAD_PUSH=false, existing database/Bunny settings.
pnpm --filter admin-vite payload run ../../packages/payload/src/site-content/import-home.mjs

# Only after the dry run verifies every source file:
# Add SITE_IMPORT_APPLY=1 and SITE_IMPORT_ACTOR_ID=<existing ops/content user id>.
# SITE_IMPORT_REPORT may point to a private audit JSON destination.
pnpm --filter admin-vite payload run ../../packages/payload/src/site-content/import-home.mjs
```

The importer validates the manifest and raster file signatures, rejects cross-origin or redirecting downloads, limits file size/time, deduplicates bytes by a protected SHA-256 field and skips existing routes. It never overwrites an existing page or publishes automatically. Imports use an explicitly identified ops/content staff member so the existing storage hook's nested writes have the correct identity. Re-running it is safe. Validate the imported drafts, image URLs and previews, then publish the original-content records before enabling CMS reads on the public website. Do not enable the public flag while the required pages are absent/unpublished.

## Verification

Run `test:site-content`, all five touched-package typechecks, and both admin/web production builds. The isolated harness uses real Payload, PostgreSQL, Better Auth, Chromium and Next.js; `mock-bunny.mjs` is an explicitly guarded network double for storage transport only. It must never be loaded by application code or against a remote database. Test evidence from this harness is not a claim that production Bunny credentials, production publishing, iPad hardware or a third-party iframe's headers have been verified.

Fixtures and browser session files live under `/tmp/editor-evidence` only. Never upload `auth-fixtures.json`, `admin-state.json`, database credentials or complete server logs as artifacts. Retain only sanitized build/test results and test-fixture screenshots.
