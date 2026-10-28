# Living City — third-party asset notices (PR04)

Companion to `docs/living-city/asset-ledger.md` (Scout C draft, lane-lcaudit).
Nothing in this file grants rights we don't have — `pending-verification`
entries are **linked by URI only and not vendored** until their hedge clears.
Canonical machine-readable provenance: `WorldAssetEntry.provenance` in
`packages/app/features/game/living-city/seed-assets.ts`.

| Source | License | Used for | Notice / obligation |
|---|---|---|---|
| Kenney Car Kit 3.1 (`sedan.glb`, `van.glb`, via fable-cities bundle) | CC0-1.0 | `vehicle.sedan`, `vehicle.van` GLB candidates | PENDING: license file bundled by fable's author; re-fetch kenney.nl + SHA-256 compare before vendoring. Author: Kenney Vleugels (kenney.nl). |
| Quaternius Universal Base Characters v1.0 + Universal Animation Library | CC0-1.0 per pack page | `ped.adult` rigged GLB candidate + retarget clips | PENDING: verify the exact downloaded zip's bundled license; ~60–70 % of each pack is the free tier. |
| Kenney Animated Characters | CC0-1.0 per publisher page | `ped.kid` rigged GLB candidate | PENDING: verify bundled license at download; rig differs from Quaternius. |
| three.js generators (`CarGenerator`, `PersonGenerator`, `TrafficlightGenerator`) | MIT (three.js authors) | procedural `vehicle.sedan`, `ped.adult`, `ped.kid`, `prop.signalhead` | Already vendored inside installed three@0.186.1; MIT notice ships with the dependency. TrafficlightGenerator material is decorative — re-authored in PR07. |
| `proc:*` primitive recipes (box car/van/bus, 2-box person, signal head) | internal (repo MIT) | primitive-fallback tail of every chain | No third-party content. Person recipe follows the metro-live instanced-2-box pattern (MIT, vietgangzz/vg-demos-all). |
| Mixamo | Adobe terms — **not CC0** | none registered | Ledger: prototyping only, never redistributed, never tagged `cc0`. Deliberately absent from the seed. |
| Poly Haven `street_lamp_01/02`, ambientCG asphalt | CC0-1.0 | not registered — optional/reference only | Repo already has procedural LED lamps and an asphalt shader. |

Rules enforced in code (`asset-validation.ts`): every entry must declare a
license string; `ready` requires `provenance.licenseVerified === true`;
`pending-verification` must not claim verified; every semantic id keeps a
ready `primitive-fallback` tail so nothing ships broken.
