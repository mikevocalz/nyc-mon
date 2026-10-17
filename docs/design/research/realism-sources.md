# Realism pass R0: source record for the sky lighting pipeline

Owner: lane R0 (sky references). Written 2026-10-16. This file cites every
public source the sky fetch/precompute pipeline in `packages/assets/skies/`
relies on, so a later lane can re-derive or re-verify any number. Nothing here
is invented: every value in `packages/assets/skies/<id>.json` is computed by
`scripts/precompute-skies.mjs` from the downloaded .hdr, and the .hdr's
sha256 is pinned in `manifest.json`.

## Assets — Poly Haven API

| Use | Source |
| --- | --- |
| Asset existence + HDRI typing | `GET https://api.polyhaven.com/assets?t=hdris` — all three ids present with `type: 0` (HDRI). Note: `GET /assets/<id>` and `GET /asset_info/<id>` both return `Cannot GET`; the listing is the per-asset metadata surface, `/files/<id>` is the download surface |
| Download URLs, sizes, md5s | `GET https://api.polyhaven.com/files/<id>` — `hdri.<res>.hdr` entries, verified at fetch time |
| `qwantani_morning_puresky` | https://polyhaven.com/a/qwantani_morning_puresky — Jarod Guest; "clear high-contrast morning sky"; whitebalance 5313, captured at Qwantani (−28.485, 29.013) |
| `qwantani_dusk_1_puresky` | https://polyhaven.com/a/qwantani_dusk_1_puresky — Greg Zaal (photography), Jarod Guest (processing); "soft dusk light with low-contrast cool blues, a gentle sunset glow" |
| `qwantani_night_puresky` | https://polyhaven.com/a/qwantani_night_puresky — Greg Zaal (photography), Jarod Guest (processing); "clear, low-contrast night sky with Milky Way and cool distant glows" |
| `qwantani_dusk_2_puresky` | https://polyhaven.com/a/qwantani_dusk_2_puresky — Greg Zaal, Jarod Guest; `time_of_day: dusk`; "warm sunset glow, thin clouds" — added as a dusk alternate |
| `qwantani_sunset_puresky` | https://polyhaven.com/a/qwantani_sunset_puresky — Greg Zaal, Jarod Guest; `time_of_day: sunset`; "calm, partly cloudy sunset with warm sun glow" — added as a dusk alternate |
| `qwantani_moonrise_puresky` | https://polyhaven.com/a/qwantani_moonrise_puresky — Greg Zaal, Jarod Guest; `time_of_day: night`; "clear moonrise night with crisp stars and high-contrast cool-blue light" — added as a night alternate |
| `qwantani_moon_noon_puresky` | https://polyhaven.com/a/qwantani_moon_noon_puresky — Greg Zaal, Jarod Guest; `time_of_day: night`; "pure, clear moonlit sky … soft horizon glow" — added as a night alternate |

All three original candidate ids existed and are HDRIs, so no substitutes were
needed for them. After measurement showed `dusk_1` has no sun disc and
`night`'s brightest cluster is a star, four real `*_puresky` alternates were
fetched through the same pipeline (all existed; none skipped). The measured
verdict, per `sunClusterSpreadDeg` in each JSON: **`qwantani_sunset_puresky`**
is the dusk pick (sun disc, spread 0.21°, elev 6.1°) and
**`qwantani_moonrise_puresky`** the night pick (moon disc, spread 0.28°,
elev 13.8°); `dusk_2` is another disc-free glow (spread 15.9°) and
`moon_noon` a valid but near-overhead moon (elev 60.7°). Full table:
`packages/assets/skies/README.md`. Resolution fetched: **2k** (2048×1024 Radiance .hdr, ≈ 4–5.5 MB
each) — enough for a 0.2° sun disc and meaningless to the order-2 SH beyond
that; `--resolution` flag bumps it if L1 wants a reflection bake.

## Licence

| Asset set | Licence | Source |
| --- | --- | --- |
| All three skies | CC0 (public domain dedication) | https://polyhaven.com/license — "All assets … are licensed as CC0". Recorded per-asset in `manifest.json` and `skies/README.md` anyway, per the lane spec |

## Maths

| Use | Source |
| --- | --- |
| Irradiance SH projection, cosine-lobe weights A_0 = π, A_1 = 2π/3, A_2 = π/4 | R. Ramamoorthi & P. Hanrahan, "An Efficient Representation for Irradiance Environment Maps", SIGGRAPH 2001. Coefficients are projected against normalised real-SH basis functions, then the A_l weights are folded in; basis order and the mapping into this repo's `evalSH9` (`packages/ui/three/cel/cel-shading.ts`) are written into each JSON's `shConvention` |
| SH normalisation constants used in-repo | `cel-shading.ts` SH_L0 = √π/2 etc. — checked to be exactly A_l × the normalised basis constants (e.g. √π/2 = π·√(1/4π)), which is what the `evalSH9Note` field documents |
| Radiance RGBE (.hdr) format | Greg Ward's "REAL Pixels" RGBE: `value = byte · 2^(E−136)`, header + `-Y h +X w` resolution line + new-style RLE scanlines (`[2,2,w_hi,w_lo]` then four per-channel run/literal streams). Decoded by `scripts/decode-hdr.mjs`; verified by energy non-negativity, resolution parse, and a recovered-sky sanity pass (sun disc compact, horizon glow at the horizon, not the zenith) |

## Repo values relied on

- `packages/ui/three/cel/cel-shading.ts`: `evalSH9` evaluation constants, the
  negative-sign L1 convention, `DSTS_DEFAULT_RIG`/`rigAroundSun` (the rig the
  JSONs feed), `hemisphereSH` (the existing stand-in these JSONs replace).
- `packages/app/features/game/world/palette.ts` + `world/index.ts`: the
  palette-synthetic `skyZenith`/`skyMid`/`skyHorizon`/`sun` tokens and the
  fixed `SUN` vector (`[-0.62, 0.45, 0.64]` normalised) — the values the
  measured sky data is being compared against.
- The lane spec mentioned "measured Flying Roadster values" — **no such
  document exists in this repo** (searched `docs/` and repo-wide). Nothing
  here depends on it; if it lands later it is a calibration check, not an
  input.

## Known gaps / honesty notes

- `qwantani_dusk_1_puresky`'s and `qwantani_dusk_2_puresky`'s suns are below
  the horizon: their "sun" fields are sunset-glow centroids (spread ≈ 15–16°,
  peak luma ≈ 4–5.5), not discs. `qwantani_sunset_puresky` is the dusk-slot
  candidate that does have a disc.
- `qwantani_night_puresky`'s brightest cluster is a 2-pixel star at ~84°
  elevation, not the moon. `sunDirection` for that asset = brightest point
  source; `moonrise`/`moon_noon` carry the real moon discs.
- Equirect azimuth is self-consistent but not compass-aligned; L1 should
  rotate `sunAzimuthDeg` to the game's compass.
- react-native-webgpu float texture upload is unverified (no device); see the
  HDR-format decision note in `skies/README.md`.
