# ADR 0005: Neon Postgres and Bunny media

- **Status:** Accepted (2026-10-05)
- **Scope:** database, identity boundary, and media storage
- **Decision:** Neon Postgres is the production database; Bunny Storage + Bunny CDN is the production media path. Payload remains the CMS/admin layer.

## Decision

NYC-Mon does **not** use Supabase.

Payload already uses the standard Payload Postgres adapter with `DATABASE_URL`, so the production connection is a Neon Postgres connection string. No Supabase SDK, Supabase Auth, Supabase Storage, or Supabase-specific database API is part of the architecture.

Media is intentionally separate from the database:

- **Neon/Postgres:** relational application data, Payload collections, indexes, transactions, and application state.
- **Payload:** CMS/admin API and metadata for media records.
- **Bunny Storage:** source-of-truth bytes for images, video, audio, and story assets.
- **Bunny CDN/Pull Zone:** public delivery and caching of media.

Payload's local filesystem must remain a development fallback only. Production media must not be written to the app filesystem.

## Better Auth on Neon

NYC-Mon already runs self-managed Better Auth through `@delmaredigital/payload-better-auth` and Payload. That is the correct identity architecture for this app because NYC-Mon depends on Better Auth plugins and server hooks that Neon Managed Auth does not expose: passkeys, two-factor, device authorization, one-time handoff tokens, phone verification, username auth, account merge hooks, custom fields, guardian-consent enforcement, and Payload admin integration.

Neon is the Postgres backing store for that Better Auth/Payload stack through the same server-only `DATABASE_URL`. Auth rows, sessions, accounts, verification records, passkeys and application records therefore live in the Neon-backed Payload schema and branch with the database.

Do **not** provision Neon Managed Auth for NYC-Mon while these plugin requirements exist. Doing so would create a second identity system and regress the existing security contract.

The supported identity path is:

1. Better Auth runtime in Payload;
2. `@delmaredigital/payload-better-auth` for generated auth collections, adapter and Payload session strategy;
3. Neon Postgres via `DATABASE_URL`;
4. Bunny Storage/CDN for media bytes.

## Media contract

Media documents store metadata and a stable public CDN URL; the binary is owned by Bunny.

Production configuration will use:

- `BUNNY_STORAGE_ZONE`
- `BUNNY_STORAGE_PASSWORD`
- `BUNNY_STORAGE_REGION`
- `BUNNY_CDN_URL`

The Bunny Storage S3-compatible API is currently in public preview, so the first production adapter should use Bunny's documented Storage HTTP API unless the project explicitly opts into the S3 preview after compatibility testing.

The storage adapter must:

- upload bytes to Bunny Storage;
- delete/rewrite the previous object when a media record is replaced;
- generate the Bunny CDN URL;
- never expose the storage-zone password to clients;
- keep Payload's media metadata queryable in Postgres;
- support local development without requiring Bunny credentials.

## Consequences

- Neon branching can become the database foundation for preview/test environments.
- Database state and media bytes intentionally have different lifecycles.
- Bunny CDN handles media distribution instead of Neon Object Storage.
- The app is not coupled to Supabase APIs.
- Neon Managed Better Auth remains a deliberate follow-up rather than a risky auth rewrite that would remove NYC-Mon's current server-side policy enforcement.


## Payload admin media behavior

The Payload Admin `Media` collection is backed by Bunny Storage through Payload's cloud-storage adapter. Admin users can use the normal Payload media UI for upload, bulk upload, replacement, deletion, and thumbnail/list previews; uploaded file URLs resolve to the Bunny CDN.

Payload does not persist media bytes locally in production. Bunny Storage is the source of truth for media objects, while Neon/Postgres stores Payload's media metadata.

The Bunny storage credential is server-only. It must never be exposed to the browser or included in `NEXT_PUBLIC_*` / `EXPO_PUBLIC_*` variables.
