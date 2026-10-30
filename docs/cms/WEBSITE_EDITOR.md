# NYC-MON website editor

## Scope

The existing Payload 4 admin is the sole editor. Better Auth, Neon and the existing Bunny Storage hooks remain in place; game-city R2 streaming, game canon, mechanics and native screens are not migrated.

Website pages → page name/path → named sections → labeled copy and media placements. Supported routes: Home, Story, City, How it works, Get, Mons, the three starter detail pages, Privacy, Terms and Children's Privacy. The `/website-shell` document owns the shared header/footer, navigation, call-to-action labels/links and optional replacement logos; it is not a public website route. The initial manifest contains 13 documents and 68 image placements, with shared image bytes deduplicated during import.

The frontend preserves its authored layouts, typography and components. The CMS changes content, section ordering/visibility, and additional content blocks, not arbitrary JavaScript/CSS or game definitions. Changing a label never changes a stable section identifier. Adding a page record does not invent a new frontend route.

## Editing

Content and operations staff enter Website pages from the current console; content editors land there directly after login. The editor is Payload's own list, edit, version and upload views inside the console's frame: the console sidebar (`ConsoleEditorNav` in `packages/payload/src/admin/console/Shell.tsx`) is Payload's `Nav`, with Website opening onto Pages and Media library, and `apps/admin-vite/src/editor.css` sets Payload's CSS variables and a few component rules to the console's tokens. `editor-theme.test.mjs` fails if those values drift from `packages/theme/tokens.ts`. Open a page and expand the named section. Edit its labeled copy rows, or expand Images, videos and extra content. An image's `slot` identifies its exact placement (for example `hero`, `world.primary`, `starter.1.baby`). Select an image, create a new image from that field, or drag a file into the Media library. An `inline` image adds content after the section rather than replacing a named placement.

The media picker offers existing images. Remove the current relationship and choose another media record to change one placement. Each media record has a derived **Used on website pages** report listing page, section and reference field, including draft and revision references. Uploaded bytes are immutable while this editor is enabled: replacing bytes/deleting records is blocked to protect shared references and rollback. Metadata such as alternative text remains editable. Permanent orphan cleanup is a separate maintenance operation, not an editor delete button.

Section blocks include text/links, images, galleries, YouTube links and allowlisted UI iframe links. Native Payload drag handles reorder sections, blocks and gallery rows. Named native sections can be hidden. Fixed choreography is disabled when its authored section order/visibility changes. Iframes never accept pasted script/HTML. YouTube watch/short URLs normalize to privacy-enhanced embeds. UI frames require a configured exact HTTPS origin, an accessible title and a supported aspect ratio. Cross-origin and same-origin sandbox permissions differ. The embedded application's own frame-ancestors/X-Frame-Options and authentication restrictions still apply; use a public embeddable UI route rather than an admin login page.

**Save Draft** keeps published visitors unchanged. **Preview saved draft** opens a scoped private preview; unsaved form changes are not shown. Save again and the visible preview refreshes. **Publish changes** updates request-time website content without a code deployment. **Exit preview** clears the preview cookie. Versions restore previous copy and image relationships.

## Security and delivery

Anonymous reads are published-only. Only `ops` and `content` can write. Public Local API operations do not bypass access controls. Preview grants are HMAC-signed, page/actor/route/audience scoped, valid for ten minutes, HttpOnly and secure on HTTPS; removing the editor role revokes further preview reads. Preview responses are private/no-store and noindex. Preview expiry is checked after `connection()` to remain compatible with Next cache components. Public content fetches use no-store and never share a private draft cache.

In `SITE_CONTENT_MODE=live`, a missing/unpublished page is not found; a backend failure errors rather than silently showing old content. The temporary `bootstrap` mode alone permits shipped fallback content during initial import. Do not leave bootstrap on after activation. Unpublishing a streamed Next route may send a 200 transport status if headers already streamed, but the route renders not-found and noindex, never the previously hardcoded page.

All upload object names are randomized. The trusted Bunny hook persists its computed URL with an explicit system operation and the same request/transaction; the upload response immediately exposes the canonical CDN URL. Clients cannot write `bunnyUrl`. Image replacements clear stale blur/caption metadata and use CDN-safe UI image rendering. Browser file bytes remain outside Postgres.

## Environment and rollout

Admin and website:

```sh
NYCMON_SITE_EDITOR=1
NEXT_PUBLIC_SITE_URL=https://<public-site-host>
SITE_PREVIEW_SECRET=<same-random-32-or-more-character-secret-in-both-apps>
SITE_EMBED_ORIGINS=https://<approved-UI-embed-host>
```

Website only:

```sh
PAYLOAD_SITE_API_URL=https://<existing-admin-host>/payload-api
SITE_CONTENT_MODE=bootstrap
SITE_CONTENT_SEED_TOKEN=<temporary-random-32-or-more-character-secret>
```

Retain existing Better Auth, Neon and Bunny environment variables. Never expose database/storage/preview secrets as NEXT_PUBLIC variables. Never enable `PAYLOAD_PUSH` in production.

1. Back up the database and retain the old deployment. Deploy the feature code with the editor off first where necessary. Review/apply the committed additive `20261030_030536_website_editor` migration to staging; it adds website/version/block tables and a locked-document relationship. It does not drop auth/version tables. Generate types and the admin import map with `NYCMON_SITE_EDITOR=1` when building an editor-enabled admin.
2. Run the website in bootstrap mode. Fetch `/api/site-content/seed` with `Authorization: Bearer <SITE_CONTENT_SEED_TOKEN>` into a local manifest. The endpoint is read-only and must never be exposed without its bearer check.
3. Run the import in dry-run mode, reviewing all page/section/asset mappings:

```sh
SITE_SEED_MANIFEST=/absolute/path/site-seed.json \
SITE_IMPORT_SOURCE_ORIGIN=https://<public-site-host> \
node packages/payload/src/site-content/import-site.mjs
```

4. After migration and credentials are verified, run the explicit import under the existing admin's Payload CLI:

```sh
SITE_IMPORT_RUN=1 SITE_IMPORT_APPLY=1 \
SITE_SEED_MANIFEST=/absolute/path/site-seed.json \
SITE_IMPORT_SOURCE_ORIGIN=https://<public-site-host> \
pnpm --filter admin-vite payload run ../../packages/payload/src/site-content/import-site.mjs
```

The import creates **drafts only** and skips an already-existing page, so reruns never overwrite editor work. Download URLs are limited to the approved origin's static image directories, have bounded byte/time limits, reject redirects and validate raster signatures. A failed run can leave unused uploaded records, which must not be automatically deleted while editors may reference them.

5. Verify the real Bunny URLs/bytes, compare each page with the shipped content, test roles and preview, then publish all reviewed documents including Shared header and footer. Set `SITE_CONTENT_MODE=live`; remove the temporary seed token. Test one production image swap and copy change, then restore the intended content.
6. Code rollback can turn the flag off and revert the deployment without destroying CMS records. A database rollback removes website tables and loses their content/history; export first and use it only on an intentional maintenance rollback.

## Verification commands

```sh
node --test packages/content/site-content/*.node-test.ts
pnpm --filter web test
pnpm --filter @acme/payload exec vitest run src/collections/__tests__/media.test.ts
pnpm --filter @acme/payload typecheck
pnpm --filter web typecheck
pnpm --filter admin-vite payload:types
pnpm --filter admin-vite payload:importmap
pnpm --filter admin-vite build
pnpm --filter web build
```

`verify-editor.mjs` exercises actual Payload + migrated PostgreSQL operations and refuses any database that is not explicitly disposable and local. Its storage HTTP transport is intentionally isolated; it is not proof that production Bunny credentials work. `tooling/site-editor/mock-bunny.mjs` is a similarly guarded test-only Node preload and must never be imported by an app entry point or used in production. Browser fixtures create only disposable `.test` accounts. `tooling/site-editor/acceptance.mjs` tests built admin/web apps on localhost, including native drag/drop and image selection, private preview, draft/publish behavior and public routes. External image/embed responses are controlled test fixtures, not claims of live YouTube playback or a specific deployed UI's framing headers.

See `VERIFICATION.md` for the run evidence and deployment boundaries.
