# Harlem realism pass: handoff

The implementation contract for the world-look lane. Inputs: `../research/realism.md`, `../review/realism-a11y.md`, `packages/app/features/game/world/look.ts` (every parameter below, named once), `packages/app/features/game/world/palette.ts` (`CITY_COLORS`, `WALL_TONES`), `world/windows.ts` (lit-window seeds), `world/materials.ts` and `world/index.ts` (what exists today), `docs/implementation/city-world.md`. Laws: `CONTRIBUTING.md` (R1–R5, Laws 2, 4, 5, 9, 10).

## Blockers before implementation

| # | Blocker | Owner | Blocks |
|---|---|---|---|
| B1 | A post path that runs on react-native-webgpu: three's output pass renders black there today (`docs/implementation/city-world.md`), and `packages/ui/three` has none to reuse | renderer | BLOOM, GRADE, vignette |
| B2 | Env-map capture for the glass/paint reflections, 256 px phone / 512 px high (`RESOLUTION.envSizePhone`, `RESOLUTION.envSizeHigh`) | renderer | GLASS, PAINT |
| B3 | Mike's Apollo-block photos at the three positions and three times (`../research/realism.md` § Acceptance test) | Mike | every `TODO(tune)` constant, acceptance sign-off |
| B4 | Interior-map room texture set (back + side walls, floor, ceiling, light panels, furniture, door) | art | the ROOM spec below |

Not blocking code, blocking sign-off: `design-director` confirms position C's camera anchor once the photos land.

## Surface families

Roughness and metalness per family. Measured values are the Flying Roadster numbers; the rest are `TODO(tune)` starts, resolved in the capture session. Colours stay `CITY_COLORS`/`WALL_TONES` — this table is about response to light, not albedo.

| Family | Roughness | Metalness | Notes |
|---|---|---|---|
| Masonry (brownstone, brick, nycha, civic, church, plain) | 0.85–0.95 TODO(tune) | 0 | Photoscanned feel comes from a roughness map over the flat vertex tone: mortar lines and repointed patches read rougher, sills wet-dark read smoother. |
| Asphalt | 0.9–1.0; wheel lanes and stop bars 0.6–0.75 TODO(tune) | 0 | Wear clusters where tyres and feet go (`../research/realism.md` § 5), not sprayed evenly. Patches a half-tone darker keep higher roughness. |
| Curtain-wall glass | `GLASS.curtainRoughness` 0.03 | `GLASS.curtainMetalness` 0.75 | Measured. The env map is the mirror; albedo stays `glass`/`glassDark`/`glassTeal`. |
| House windows | `GLASS.windowRoughnessMin` 0.04 – `windowRoughnessMax` 0.12, seeded per pane | `GLASS.windowMetalness` 0.75 TODO(tune) | Seeded `tiltMinDeg` −4° … `tiltMaxDeg` +4° TODO(tune) so reflections slide and break as the camera walks. |
| Storefront (fascia, framing, roll-down gates) | 0.4–0.6 TODO(tune) | 0.6–0.8 TODO(tune) | Painted aluminium and corrugated steel (`gate`). Gates read duller at the bottom where hands and trucks rub them. |
| Painted metal (doors, fire escapes, railings, poles, car paint) | `PAINT.baseRoughness` 0.38 | 0.6–0.8 TODO(tune) for street metal; car bodies keep the car tones | `PAINT.clearcoat` 1.0 / `PAINT.clearcoatRoughness` 0.025 measured on vehicles; street metal starts there, `TODO(tune)` whether hydrants and poles keep the full clearcoat or flatten it. |
| Foliage | 0.9–1.0 TODO(tune) | 0 | Leaf crowns keep the existing alpha-cutout; the pass adds no sheen. |

## The window spec

One window system, same per-building seed discipline as `windows.ts` today: every variation is a hash of (column, row, building seed), so the pattern is stable frame to frame and testable in node.

- **Glass:** per-pane roughness in `GLASS.windowRoughnessMin…Max`, `windowMetalness` `TODO(tune)`, tilt `GLASS.tiltMinDeg…tiltMaxDeg` seeded so neighbouring sashes catch the sky at different angles.
- **Interior map:** behind the pane, a room — back wall, two side walls, floor, ceiling, ceiling light panels, furniture silhouette, a door. `ROOM.mapScale` 1 room per window bay to start (`TODO(tune)`; masonry bay is 3.0 m, `WINDOW_GRID.masonry`). `ROOM.furnitureDepthFalloff` 0.5 `TODO(tune)` darkens furniture toward the back wall so the room has depth, not a flat lit quad.
- **Blinds:** drawn to a seeded height per pane — never uniform across a facade; some panes fully open, some nearly shut.
- **AC units:** a seeded share of summer windows carries a sleeve unit, `gate`-family tones, protruding past the wall plane so it catches the sky and the street.
- **Storefront glow:** open shop bays glow `windowWarm` behind their glass (the existing `shopGlow` in `materials.ts`), gated bays stay dark; the pass adds the interior depth so the glow is a lit shop, not a bright rectangle.
- **Lit-room logic:** the existing seed stands — `litDensity` 25–75 % of a building's windows, `windowTone` mostly warm, some amber, a few cool. Morning keeps the same seeds but almost nothing lit (a few early kitchens); dusk is the measured behaviour; night raises the contrast — fewer lit panes than dusk `TODO(tune)`, each against darker walls. Nothing animates per frame: a lit window stays lit (flash safety, `../review/realism-a11y.md`).

## Time of day

Three looks under `SKY_BY_TIME` in `look.ts`; field names match the sky dome and lights (`zenith`, `mid`, `horizon`, `sunGlow`, `sun`, `hemiSky`, `hemiGround`). GRADE, FOG and BLOOM are one set applied at every time; exposure is the per-time knob once the captures rule on it (`GRADE.exposure`, `TODO(tune)`).

| Field | Morning | Dusk | Night |
|---|---|---|---|
| `zenith` | `morningZenith` | `skyZenith` | `nightZenith` |
| `mid` | `morningMid` | `skyMid` | `nightMid` |
| `horizon` | `morningHorizon` | `skyHorizon` | `nightHorizon` |
| `sunGlow` | `morningGlow` | `sunGlow` | `nightGlow` (city halo, no sun) |
| `sun` | `morningSun` | `sun` | `nightMoon` |
| `hemiSky` | `morningHemiSky` | `hemiSky` | `nightHemiSky` |
| `hemiGround` | `morningHemiGround` | `hemiGround` | `nightHemiGround` |

- **Morning:** clear and cool — `carolina` sky over `concrete` pavement, the whiter `morningSun` key. Almost no interiors lit; storefronts mostly gated or just-open. The grade holds: glass and wet curb carry the reflections, walls sit mid-bright.
- **Dusk:** the shipping look. Dusty rose horizon to brand-night zenith, low sun in the south-west (`index.ts` `SUN`), lit windows and neon against `ink` walls, warm lamps and interiors carrying the street's warmth. `FOG.density` 0.00028 exp2 closes the distance.
- **Night:** `ink`-family sky that never goes black — `nightHorizon` keeps the sodium glow at the skyline — moon key `nightMoon`, hemisphere near-dark. Windows, marquees (`marquee`, `marqueeLights`) and lamp pools are the frame's light; bloom 0.045 halos only the bright cores.

## Frame governor and tiers

`RESOLUTION`: render scale drops `dropStep` 0.1 and rises `riseStep` 0.05 per `adjustWindowMs` 1500 ms window, never below `floor` 0.5. The phone band is `phoneFpsTargetMin` 27 – `phoneFpsTargetMax` 38 fps. Tiers from `docs/COPY_DECK.md` § Graphics quality: **Auto** runs the governor; **Performance** pins floor-side scale plus the small env map and reduced AO; **Quality** holds full scale, 512 px env maps and `AO.samplesHigh` 12, accepting slower frames on older phones. Scale changes must step, not slide — a gradual resolve pumps luminance and reads as flicker.

## Tests to write

| Kind | Test |
|---|---|
| Unit (`world`, node --test) | `look.ts` constants hold their measured values; `SKY_BY_TIME` covers morning/dusk/night and every field resolves to a real `CityColor` key |
| Unit | window seeds: blinds heights and AC-unit share are stable per building and vary across one facade; lit sets at dusk match `windows.ts` density |
| Unit | the governor: drop/rise asymmetry (0.1 vs 0.05), floor 0.5, one step per 1.5 s window |
| Capture | the acceptance grid: three Apollo-block positions × three times of day beside Mike's photos (`../research/realism.md`) |
| a11y | `../review/realism-a11y.md`: HUD pairs over the bright grade; no animated luminance faster than 3 Hz; reduced-motion build is static |

## Device verification

Open; no device is set up. PENDING on Mike's hardware.

- [ ] Capture grid on the target phone inside the 27–38 fps band.
- [ ] Book posture on a foldable: the world canvas spans the hinge uninterrupted (PR #29's rule); the hinge column stays readable (review § hinge line).
- [ ] Reduced-motion OS setting: static grade, no glow animation, governor steps still silent.
- [ ] Bloom path verified on react-native-webgpu before BLOOM lands (B1).
