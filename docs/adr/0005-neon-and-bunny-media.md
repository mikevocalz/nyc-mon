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

## Neon Auth boundary

Neon's current Managed Better Auth is powered by Better Auth and stores identity in the `neon_auth` schema, with auth state branching alongside the database.

NYC-Mon currently has additional server-side identity requirements that are implemented through the Payload Better Auth integration: passkeys, custom `birthYear` fields, guardian-consent enforcement, and the Payload admin authentication strategy.

Neon's managed auth does not currently support arbitrary Better Auth plugins or custom server-side handlers. Therefore this PR moves the **database** to Neon and establishes the Neon Auth migration boundary, but does not silently remove the existing server-side consent/security controls.

The follow-up Neon Auth migration must preserve:

1. server-authoritative age/guardian enforcement;
2. passkey support;
3. stable Caller/user IDs used by Mon ownership;
4. Payload admin authentication;
5. Apple/Google sign-in;
6. device/session handoff semantics.

Until those are proven against Managed Better Auth, the existing Better Auth runtime remains the identity implementation, backed by the Neon Postgres database.

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
