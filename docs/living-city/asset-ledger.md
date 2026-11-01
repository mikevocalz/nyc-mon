# Living City — asset provenance ledger (draft)

Started by Scout C (2026-10-17). This is the working draft; the spec's
canonical home is `docs/assets/LIVING_CITY_ASSETS.md` — promote/move when
the `WorldAssetRegistry` lands.

**Rule:** a row only becomes `status: ready` after the *exact* package we
vendor has been re-verified at its revision (license file, hash, source
URL). `pending` rows must never ship. `sim-*` = simulated/inferred
provenance, not licensed media.

| Asset id | Role | Source | Revision / file | License | Status | Fallback |
|---|---|---|---|---|---|---|
| `vehicle.sedan.city` | traffic fleet | Kenney Car Kit 3.1 GLB `sedan.glb` via fable-cities `public/assets/simulation/models/` | fable `aea8b10` | CC0 (KENNEY_LICENSE.txt) | pending — re-fetch kenney.nl + hash | `body.procedural.three-city` (CarGenerator sedan, MIT, installed) |
| `vehicle.sedan.sport` | traffic fleet | Kenney `sedan-sports.glb` (same source) | fable `aea8b10` | CC0 | pending — same check | procedural variant |
| `vehicle.suv.city` | traffic fleet | Kenney `suv.glb` / `suv-luxury.glb` | fable `aea8b10` | CC0 | pending — same check | CarGenerator SUV |
| `vehicle.hatchback.city` | traffic fleet | Kenney `hatchback-sports.glb` | fable `aea8b10` | CC0 | pending — same check | procedural |
| `vehicle.van.delivery` | delivery van | Kenney `van.glb` / `truck-flat.glb` | fable `aea8b10` | CC0 | pending — same check | procedural van box |
| `vehicle.taxi.city` | yellow cab | Kenney sedan + procedural roof sign **or** three.js CarGenerator taxi variant (`taxiColor 0xf5c518`) | installed three@0.186.1 | CC0 / MIT | ready candidate (generator is installed) | current box car + taxi tone (existing `city:cars`) |
| `vehicle.bus.city` | M60/M102 bus | three.js CarGenerator stretched variant or later licensed pack | — | MIT (generator) | pending — no CC0 bus found yet | procedural bus box |
| `signal.head.nyc` | mast-arm + 3-lens head + ped box | three.js `TrafficlightGenerator.js` geometry; lens emissive driven by controller `aState` attr | installed three@0.186.1 | MIT | ready candidate — geometry only, re-author material | procedural cylinder+boxes |
| `signal.lamp.pools` | headlight/lamp glare | in-house instanced additive quads (L1/L4 lamp-switch pattern) | — | sim-* | ready | none needed |
| `lamp.head.hero` (optional) | close-up lamp head | Poly Haven `street_lamp_01/02` (fable CREDITS) | fable `aea8b10` | CC0 | optional — repo LED lamp is procedural | existing LED lamp |
| `crowd.person.starter` | mid/far pedestrians | three.js `PersonGenerator.js` instanced people | installed three@0.186.1 | MIT | ready candidate | 2-box instanced person (metro-live pattern, MIT) |
| `person.rigged.universal` | foreground pedestrians | Quaternius Universal Base Characters | pack v1.0 Aug 2025 | CC0 per page | pending — verify downloaded zip license | `crowd.person.starter` |
| `anim.set.locomotion` | walk/idle/run clips | Quaternius Universal Animation Library (standard) | Mar 2025 | CC0 per page | pending — verify free-tier contents | vertex-shader walk (fable `aLimb/aWalk` pattern, MIT) |
| `person.rigged.kenney` | variety rigs | Kenney animated-characters packs | — | CC0 per publisher | pending — verify bundled license | `crowd.person.starter` |
| `anim.proto.mixamo` | prototyping only | Mixamo | — | Adobe terms — **not CC0**, no raw redistribution | **blocked for shipping** | `anim.set.locomotion` |
| `texture.ref.ambientcg` | wet-look reference | ambientCG asphalt (fable CREDITS) | — | CC0 | reference only | procedural asphalt shader (existing) |
| `body.procedural.night-street` | hero/near parked cars | night-street `src/world/cars.ts` loft math | `333f064` | MIT | ready (code port) | existing instanced `city:cars` |

## Provenance notes

- **Kenney GLBs:** license text bundled by fable's author (creation date
  02-04-2026); before vendoring, re-fetch the pack from kenney.nl and
  hash-compare the GLBs; record wheelbase/bounds/pivot per model — the
  registry contract is `{length,width,track,wheelbase,wheelRadius,forward:+Z,ground:y=0}`.
- **Quaternius:** site states CC0/public domain; ~60–70 % of each pack is
  the free tier — verify the *specific* zip contents + license before
  shipping. 13k-tri rigs are hero-tier, not crowd.
- **Mixamo:** prototyping allowed under Adobe terms, but skeletons/clips
  may not be redistributed — any Mixamo-derived content must be tagged
  `anim.proto.*` and replaced before shipping.
- **three.js generators:** already vendored inside `three@0.186.1` (MIT,
  TSL-native) — the only zero-download, zero-port-risk source.
- **Every `sim-*` / procedural entry** stays available so the city loads
  fully even when an external asset fails (spec §4 fallback rule).
