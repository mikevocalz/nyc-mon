# R2 cell release `r20261030-c98106d6` — rings 1–10 (release record)

Date: 2026-10-30. Requested as "ship a new R2 cell release so `/city/walk` covers rings 7–10". Audit found the
release already published earlier the same day; this record is the verification log.

## Release

- Id: `r20261030-c98106d6` (`r<yyyymmdd>-<manifest sha8>`; the sha8 is the canonical pin list's sha256 — content
  addressed, so identical pins can only ever produce this id).
- Bucket: `nyc-mon-valdrada-prod`, objects under `releases/r20261030-c98106d6/`; `releases/current` points at it.
- Base URLs: `https://city-assets.nyc-mon.city/releases/r20261030-c98106d6` (prod),
  `https://pub-8272e2d358874d0580d90a49b1bede7d.r2.dev/releases/r20261030-c98106d6` (staging bucket also carries it).
- `manifest.json`: 200, 1,692 cells, carries the ODbL 1.0 attribution block (`license`, `credit`, `url`, `notice`)
  per `tooling/city/R2.md` §ODbL 4.4.

## Cell counts

- Before: `r20261029-cd5483ac`, 458 cells (Manhattan slice only).
- After: `r20261030-c98106d6`, 1,692 cells, 828.6 MB — `far/` 290, base `near`/`lite` 50+50, `structures` 75 +
  `structures/ringN` 205, and per-ring near+lite pairs: ring1 38, ring2 2, ring3 0 (Central Park emits no block
  cells — its generated manifest is empty by construction), ring4 178, ring5 134, ring6 34, ring7 166
  (Brooklyn waterfront), ring8 296 (western Queens), ring9 112 (South Bronx), ring10 62 (Staten Island north shore).

## Provenance

- Bake: `packages/app/features/game/world/vd-port/blocks/data-ring7..10` landed via the ring PRs (through
  `b6de391d`, ring 10). `tooling/city/vd-port/write-cells-manifest.mjs` run on 2026-10-30 regenerated
  `vd-cells-manifest.ts` byte-identical — the committed manifest is the published pin set; nothing un-baked.
  `write-systems-manifest.mjs --pins` likewise clean (1,708 system cells, bundled only — not an R2 tier).
- Client flip: `EXPO_PUBLIC_VD_CELL_BASE` → this release in `apps/web/next.config.ts` and both `apps/mobile/eas.json`
  profiles (PR #153); walk route + docs in `city-walk-web.md`.

## Verification (2026-10-30)

- `r2-publish.mjs --dry-run`: 1,692 cells, all pins verified locally (re-hash vs manifest before upload).
- `r2-publish.mjs` (idempotent re-run): `0 uploaded, 1692 resumed`, `manifest.json` last, `releases/current` flipped.
- `r2-verify.mjs --head-only` over the public base: transient local timeouts under parallel HEADs (17, then 25
  different keys per run — never a 404 or pin mismatch); every transiently-failed key re-checked sequentially is
  HTTP 200 with the pinned length and `Cache-Control: public, max-age=31536000, immutable`.
- Sampled GET + sha256 rehash: 86/86 PASS across every tier (`far`, base `near`/`lite`, `structures`,
  `structures/ringN`, `ring{1,2,4,5,6,7,8,9,10}-{near,lite}`).
- Probes: CORS `access-control-allow-origin: https://nyc-mon.city` PASS; Range `bytes=0-63` → 206 PASS.
- Live page: `nyc-mon.city/city/walk` 200; its deployed bundle inlines
  `EXPO_PUBLIC_VD_CELL_BASE=https://city-assets.nyc-mon.city/releases/r20261030-c98106d6` and embeds the
  ring 7–10 manifest pins (`ring10-near/-55_173` etc. present in the served JS). "The city is ready." copy ships in
  the client chunk (rendered after streaming, not in the SSR HTML).
- Local `.env` `R2_PUBLIC_BASE_URL` / `_STAGING` still pointed at `r20261029-cd5483ac` — corrected to this release
  (gitignored file; affects only local `r2-verify.mjs` runs).

## Note on "new release dir"

The release id is content-addressed: re-publishing the same 1,692 pins on the same date reproduces
`r20261030-c98106d6` exactly. A second dir for identical bytes would need a non-conventional id and duplicate
828.6 MB; skipped deliberately. Rollback remains `node tooling/city/r2-publish.mjs --rollback r20261029-cd5483ac`.
