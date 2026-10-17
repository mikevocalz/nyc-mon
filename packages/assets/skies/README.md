# skies/ — time-of-day sky lighting data

Precomputed lighting JSONs for the three sky states the realism pass uses —
morning, dusk, night — each derived from a real Poly Haven HDRI by
`scripts/precompute-skies.mjs`. Lane L1 consumes `<id>.json`; nothing in this
directory requires the .hdr payload at runtime, and **no HDR file is ever
committed** (`./.cache/` is gitignored).

## Files

| File | Committed | What it is |
| --- | --- | --- |
| `manifest.json` | yes | Written by `fetch-skies.mjs`: per-asset id, API URLs, licence, fetch timestamp, sha256 + md5 of the downloaded file, preview path |
| `fetch-skies.mjs` | yes | Build-time downloader (node ≥ 20, zero deps) |
| `scripts/decode-hdr.mjs` | yes | Radiance RGBE decoder (header, flat + new-RLE scanlines) |
| `scripts/precompute-skies.mjs` | yes | Emits `<id>.json` + `previews/<id>.png` |
| `<id>.json` | yes | `sunDirection`, `sunIrradiance`, `skyIrradianceSH` (9 × RGB, R&H cosine-lobe folded in), `horizonColor`, `source` metadata |
| `previews/<id>.png` | yes | 512×256 tonemapped contact sheet, for attribution/review UI only |
| `.cache/` | **no** | The downloaded .hdr payloads |

## Fetch (build time only)

```sh
cd packages/assets/skies
node fetch-skies.mjs                # all three skies at 2k -> .cache/
node fetch-skies.mjs --check        # verify ids + URLs exist, no download
node fetch-skies.mjs --resolution 4k --out /tmp/skies
```

`fetch-skies.mjs` hits `https://api.polyhaven.com/assets?t=hdris` (the listing —
the per-asset route is `/files/<id>` for downloads; `/assets/<id>` 404s) to
confirm each id exists and is an HDRI (`type === 0`), then downloads the
`.hdr` variant and rewrites `manifest.json` with the file's sha256. Re-run it
whenever the pinned assets change.

## Precompute

```sh
node scripts/precompute-skies.mjs            # every asset in the manifest
node scripts/precompute-skies.mjs qwantani_dusk_1_puresky
```

Decodes each .hdr (own decoder — no three.js/native deps), then writes
`<id>.json`. Conventions and the SH basis/cosine-lobe maths are documented in
each JSON's `axes` / `shConvention` fields; the projection is Ramamoorthi &
Hanrahan 2001 with the cosine-lobe weights A_l = π, 2π/3, π/4 folded in, basis
order `[1, x, y, z, x*y, y*z, 3y²−1, x*z, x²−z²]` (y-up).

## Assets and licences

All three are **CC0** (public domain dedication,
<https://polyhaven.com/license>) — attribution is not legally required, but we
record it anyway and surface it in the app's attribution surface.

| id | Name | Author(s) | Asset page |
| --- | --- | --- | --- |
| `qwantani_morning_puresky` | Qwantani Morning (Pure Sky) | Jarod Guest | <https://polyhaven.com/a/qwantani_morning_puresky> |
| `qwantani_dusk_1_puresky` | Qwantani Dusk 1 (Pure Sky) | Greg Zaal (photography), Jarod Guest (processing) | <https://polyhaven.com/a/qwantani_dusk_1_puresky> |
| `qwantani_night_puresky` | Qwantani Night (Pure Sky) | Greg Zaal (photography), Jarod Guest (processing) | <https://polyhaven.com/a/qwantani_night_puresky> |
| `qwantani_dusk_2_puresky` | Qwantani Dusk 2 (Pure Sky) | Greg Zaal, Jarod Guest | <https://polyhaven.com/a/qwantani_dusk_2_puresky> |
| `qwantani_sunset_puresky` | Qwantani Sunset (Pure Sky) | Greg Zaal, Jarod Guest | <https://polyhaven.com/a/qwantani_sunset_puresky> |
| `qwantani_moonrise_puresky` | Qwantani Moonrise (Pure Sky) | Greg Zaal, Jarod Guest | <https://polyhaven.com/a/qwantani_moonrise_puresky> |
| `qwantani_moon_noon_puresky` | Qwantani Moon Noon (Pure Sky) | Greg Zaal, Jarod Guest | <https://polyhaven.com/a/qwantani_moon_noon_puresky> |

Attribution text for the app's attribution surface (trim to whichever assets
ship):

> Skies: "Qwantani" HDRI series by Poly Haven (polyhaven.com), licensed CC0.

## Recommendation for L1 (measured, from the committed JSONs)

The brief asked for one dusk candidate with a real sun disc (cluster spread
< ~3°, elevation > 0°) and one night candidate whose brightest cluster is the
moon. `sunClusterSpreadDeg` is the discriminator.

| Slot | Candidate | elev | spread | peak luma | Verdict |
| --- | --- | --- | --- | --- | --- |
| morning | `qwantani_morning_puresky` | 20.2° | 0.22° | 1.4×10⁵ | **pick** — real unclipped sun disc |
| dusk | `qwantani_sunset_puresky` | 6.1° | 0.21° | 5.9×10⁴ | **pick** — real disc, warm orange key (#FF9F2B), warm horizon #FFDEB9 |
| dusk | `qwantani_dusk_2_puresky` | 15.4° | 15.9° | 5.5 | fallback — no disc, broad warm glow; pinkest horizon (#FFD3E5) if L1 wants post-sunset light |
| dusk | `qwantani_dusk_1_puresky` | 28.4° | 15.4° | 4.0 | fallback — no disc, coolest/dimmest |
| night | `qwantani_moonrise_puresky` | 13.8° | 0.28° | 1.1×10⁵ | **pick** — moon disc low in the sky (PH labels the asset night/moonrise), raking key light like the existing SUN vector |
| night | `qwantani_moon_noon_puresky` | 60.7° | 0.27° | 1.0×10⁵ | fallback — moon disc but nearly overhead; darkest sky of the set |
| night | `qwantani_night_puresky` | 84.1° | 0° (2 px) | 368 | fallback — no moon; brightest cluster is a star |

So: **morning / `qwantani_sunset_puresky` / `qwantani_moonrise_puresky`** is
the recommended trio — every slot gets a compact, high-radiance key disc
(spread < 0.3°) plus full-range SH ambient and a plausible horizon.

## What the numbers mean (read before wiring a rig)

- `sunDirection` is the centroid of the brightest cluster: pixels above half
  the peak luma, refined to the 15° neighbourhood of the provisional centroid.
- `sunClusterSpreadDeg` tells you what that cluster *is*:
  - **morning** — 0.2°, a real unclipped sun disc (peak radiance ≈ 1.6×10⁵,
    mean ≈ 1.3×10⁵ linear RGB). `sunIrradiance` is a true sun-disc radiance.
  - **dusk** — 15.4°, 24k pixels. The sun has already set; there is no disc
    (peak luma ≈ 4). `sunDirection` is the centroid of the broad sunset glow —
    still the right dominant-light direction, but `sunIrradiance` (≈ 3) is glow
    radiance, not disc radiance; it needs artistic scaling before it can drive
    a key light.
  - **night** — 0°, 2 pixels, radiance ≈ 310, elevation ≈ 84°. The brightest
    cluster is a single star, not the moon. Treat `sunDirection` as
    "brightest point source", not a moon position. The fetched alternates
    `qwantani_moonrise_puresky` / `qwantani_moon_noon_puresky` do carry a real
    moon disc — see the recommendation table above.
- `horizonColor` is the mean linear radiance within ±5° of the horizon,
  averaged over all azimuths. dusk_1's is cool blue (#DFE9FF normalised) —
  the warm sunset glow only occupies a ~30° azimuth wedge (peak wedge
  radiance ≈ 1.1 vs ≈ 0.5 elsewhere), so the all-azimuth mean is not warm.
- Elevation ordering for the original three, measured: dusk glow centroid
  28.4° > morning sun 20.2°, night point source 84.1°. The expected "morning
  sun highest, dusk sun lowest" ordering does not hold for `dusk_1`/`night`
  because one sun is below the horizon and the other cluster is a star — the
  alternates fix this: `sunset` has its disc at 6.1° and `moonrise` at 13.8°.

## HDR-format decision (UNVERIFIED on device — L1 decides)

react-native-webgpu float/half-float texture upload is **unverified** — no
device check has been run (per the lane spec). Both runtime paths:

- **A — `RGBELoader` .hdr at runtime.** Works only if float/half-float
  texture upload lands on react-native-webgpu. Cost: the .hdr ships in the
  bundle (1–5 MB each at 1–2k) and is decoded + PMREM'd on device.
- **B — build-time PMREM → cubemap PNG/KTX2 fallback.** The .hdr never reaches
  the app; a build step bakes a cubemap (or the cel rig just uses
  `skyIrradianceSH` + `sunIrradiance` + `horizonColor` directly and skips
  textures entirely — the cel pipeline is SH-lit already,
  `packages/ui/three/cel/cel-shading.ts`).

Recommendation on engineering cost, not a decision: **precompute the fallback
now** so runtime never decodes HDR — path B works under either device-check
outcome, while path A dies if float textures don't upload. The JSONs in this
directory are sufficient for the SH-lit cel rig without any texture; an
equirect/cubemap bake is only needed if a reflective/realistic sky dome is
added. L1 picks after the device check.
