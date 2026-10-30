# NYC-MON website editor — draft implementation and rollout gates

## Scope and truthful status

This extends the existing Payload 4 admin, existing Better Auth roles, Neon database,
and Bunny-backed media collection. It does not introduce WordPress, a second CMS,
Supabase, another login, or a new media provider. The R2 game-city pipeline is untouched.

Implemented in this change:

- A `site-pages` collection: page path/name/SEO → named sections → copy fields and
  image/text/gallery/YouTube/approved-iframe blocks. Sections and content blocks are
  sortable; copy rows have readable labels. Native upload controls support file
  selection and drag/drop; the existing media library's redirect is removed.
- Content and ops roles can edit; anonymous reads are published-only; saved drafts
  and up to 30 revisions are enabled. Public reads never forward credentials.
- Media's “Used on website pages” field is derived from actual relationships in
  current pages, drafts and revisions. In-use image bytes cannot be replaced or
  deleted: upload a new media record and select it in the relevant section. Other
  game/app uses are not included in this website usage report.
- Homepage integration for Hero, district board, World, H-Lynk marketing, starter
  cards, Care, Hatch and Waitlist marketing. Text and named image slots preserve
  the authored components, responsive classes and motion IDs. Inline blocks are
  attached to their owning section. Gameplay definitions, form submission/consent
  logic, and the internal H-Lynk HUD are not CMS-edited.
- A protected read-only bootstrap export and an explicit, dry-run-first importer
  for the existing homepage copy and ten rendered image placements. The importer
  creates a DRAFT only and refuses to overwrite an existing Home record.
- Pure validation/REST/placement regression tests. These are NOT browser, database,
  full-repository, deployment, or device-test evidence.

**Not complete / do not merge as production-ready:** other marketing route adapters
(`/story`, `/city`, `/how-it-works`, `/mons`, Mon detail, `/get`, legal pages), shared
header/footer/logo editing, generated schema migration/types/import map, live draft
preview, production asset import, authenticated drag/drop-to-publish browser tests,
and full app build/typechecks. Schema supports page identities, but creating a CMS
record alone does not create or wire a website route. No live database, media bucket,
production environment, or published content has been changed by this PR.

## Operator setup, on isolated staging first

Set `NYCMON_SITE_EDITOR=1` for the Payload admin and web app only after preparing
an isolated database. Keep `PAYLOAD_PUSH=false`. Generate the additive Payload
migration, generated types and admin import map using this repository's existing
Payload/admin-vite CLI setup. Review the SQL: it must not drop/recreate auth tables,
users, content, or existing media. Apply to staging, then run the full typechecks,
admin build and web build. These generated artifacts are intentionally not guessed
or hand-written in this draft.

The marketing web app also needs `PAYLOAD_SITE_API_URL` set to the existing admin's
public `/payload-api` base. It holds no database or storage credentials. Both apps
need the same comma-separated `SITE_EMBED_ORIGINS`, each an exact HTTPS origin with
no paths or wildcards. `NEXT_PUBLIC_SITE_URL` must accurately identify the public
site: the renderer grants same-origin sandbox capability only for known
cross-origin embeds. Missing/invalid origin configuration fails to an opaque-origin
sandbox, rather than weakening it.

Existing `BUNNY_STORAGE_ZONE`, `BUNNY_STORAGE_PASSWORD`, `BUNNY_STORAGE_REGION`,
`BUNNY_CDN_URL`, `DATABASE_URL` and `PAYLOAD_SECRET` remain the existing server-side
configuration. Never put them into `NEXT_PUBLIC_*`, commits, logs or seed manifests.

Native editor routes, on the existing admin origin:

- `/admin/collections/site-pages`
- `/admin/collections/media`

The native editor navigation links these views back to Operations and Mon content.
The custom Operations sidebar still needs its own Website shortcut before rollout.

## Import the shipped homepage without rewriting its copy

1. On a staging web deployment set `SITE_CONTENT_SEED_TOKEN` to a new secret of at
   least 32 characters. With `NYCMON_SITE_EDITOR=1`, request
   `GET /api/site-content/seed` using `Authorization: Bearer <token>` and save the
   JSON locally. The endpoint is read-only, sends `Cache-Control: no-store`, and
   returns 404 without the separate token. Remove this environment variable after
   the import. Do not paste the secret into a tracked file.
2. Set `SITE_SEED_MANIFEST` to that local JSON file and `SITE_IMPORT_SOURCE_ORIGIN`
   to the exact staging origin that served it. Run from the payload package:

   ```sh
   pnpm exec payload run src/site-content/import-home.mjs
   ```

   Default is DRY RUN: validates the manifest and planned placements only; does
   not fetch image bytes, connect to the database, upload, or publish.
3. After reviewing the dry run and applying the staging schema migration, rerun
   with `SITE_IMPORT_APPLY=1`. The script accepts only the approved origin's
   `/_next/static/media/` and `/home/` asset paths, rejects redirects, bounds image
   bytes to 12 MB and checks raster signatures. It uploads through Payload's
   existing Bunny hooks and then creates the draft Home record with actual media
   relationships. Each upload has a unique filename. A partial failure can leave
   unused uploaded media; it never deletes existing data to undo a failure.
4. Review the draft in Payload. Check all copy, labels, image placements and alt
   text. Only publish manually after the browser acceptance checks below.

The homepage manifest excludes unused reserved art slots and design-system
branding. It is not an inventory/migration of every route or every site asset.
Do not claim whole-site media migration until those adapters and inventories land.

## Editing model

Examples: `Home → Hero → title`, `Home → World → body2`, and
`Home → World → image position world.primary`. `inline` adds a new image beneath
that section. Named positions replace only their matching existing image. Use
new media records for swaps; old page revisions keep their old image references.

YouTube accepts watch/share/short/embed links, converts them to privacy-enhanced
embed URLs, strips autoplay and rejects deceptive hosts. An iframe block accepts
only a URL on the server allowlist, not HTML/JavaScript. Admin/auth/API paths,
credentials and unsafe schemes are rejected. Frames have accessible titles,
restricted sandbox permissions, responsive aspect presets and an external-open
fallback. A target's CSP or X-Frame-Options can still block embedding; this code
does not bypass those headers. Same-origin interactive demos may need a dedicated
approved embed origin because the opaque sandbox deliberately removes origin
privileges.

Publishing updates content on subsequent server requests without a code rebuild.
An already-open browser tab is not pushed a live refresh. GitHub Pages static
snapshots remain snapshots, not a live CMS environment. Until migration is complete,
missing/disabled/unavailable CMS content falls back to the shipped homepage. In
particular, unpublishing Home restores that bootstrap fallback; a final whole-site
rollout needs an explicit unpublish/error policy and a last-known-good snapshot.
Custom section hiding/reordering disables the original fixed-layout motion timeline
rather than running animations against missing or rearranged targets. Partial
records preserve the default section order.

## Acceptance gates before rollout

- Generate and review non-destructive migrations, types and import map with the
  installed Payload 4 version. Run all touched-package typechecks and builds.
- With an ops/content account, drag/drop PNG/WebP/JPEG and select an existing file.
  Confirm upload progress/errors, save, reload, thumbnail and Bunny URL playback.
- Change only World's primary image and a paragraph; save draft. Verify an
  anonymous browser still sees the published version. Publish and verify the
  changed text and image on a fresh request, with no code redeploy.
- Check mobile, tablet and desktop layouts, long/empty copy, alt text, focus order,
  unchanged submit/consent behavior, failed uploads and broken image responses.
- Add/reorder an inline gallery, YouTube and approved UI iframe in several sections.
  Test denied domains, unsafe schemes, blocked framing, browser sandbox behavior
  and external-open fallback. Check the deployed CSP, not just URL validation.
- Verify website usage on every shared image, deletion/replacement guards, revision
  restore, roles, direct API draft requests, and concurrent edit/delete races. The
  hook checks are not a substitute for a database-level concurrency guarantee.
- Complete and test the remaining routes and shared site areas before calling the
  requested whole-site editor finished. Never auto-merge based only on unit tests.

## Verification performed during authoring

`node --experimental-strip-types --test packages/content/site-content/core.node-test.ts packages/content/site-content/reader.node-test.ts`

69 tests passed. Standalone strict TypeScript checking passed for `core.ts` and
`reader.ts`. This does not establish that Payload schema/hooks, React components,
Next cache integration, importer uploads, or native admin views have passed their
integration gates. CodeRabbit, authenticated browser checks and deployment
were not run in this authoring environment.
