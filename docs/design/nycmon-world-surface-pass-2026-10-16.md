# NYC-Mon — grounded cinematic Harlem (surface detail spike)

**Stacked on draft #46.** This is a small **opt-in shader** step, not the claim that NYC-Mon already reaches Digimon Story: Time Stranger fidelity.

## What the code adds

- Existing TypeGPU/TSL facade and road materials remain the primary renderer.
- `EXPO_PUBLIC_WORLD_SURFACE_DETAIL=1` enables a low-amplitude mortar breakup on masonry and stable world-space asphalt grain. The facade seed picks one of three treatments per building — US modular brick, brownstone ashlar or limestone — and joints are masked out of panes, shopfronts, gates and stone dressing. Both details fade to zero long before their pattern becomes a pixel.
- The default build creates **no new shader detail**. No new draw calls, assets, geometry, labels or camera movement. Existing OSM identities, collision/navigation, proportions and shader cel model remain unchanged.
- The treatment is reversible and must pass a pixel/compile/performance comparison on Surface Duo before shipping. Disable on budget failure; this is not a free visual upgrade.

## Visual target: stylized creatures in believable New York

A recognizable 125th Street, Apollo Theater, subway/bus entrances and housing architecture with believable material roughness, layered storefront signage, asphalt wear, stoop geometry, weather effects and deliberate day/night illumination. Keep existing futuristic rooflines, EngineX remnants and holographic adverts **selective**, not a generic neon megacity. Preserve location/cultural identity and do not infer public-housing status from looks.

| Stage | Concrete deliverable | Performance release gate |
|---|---|---|
| 0 — current | City geography, merged draw calls, cel light, dusk palette, distant LOD and street props from #46 | Verify ~15 FPS baseline attribution on real Duo |
| 1 — this PR | Opt-in distance-fading procedural wall joints and ground grain, with pure unit tests | No new shader compile errors; real Duo frame time must not regress |
| 2 — PBR materials | License-cleared brick/brownstone/metal/asphalt library; KTX2 textures + roughness/normal/AO atlases, shared UV and material families | GPU memory and shader variants capped per platform; verify WebGPU + web WebGL2 |
| 3 — lighting | Physical sun/time of day, warm/cool light contrast, believable wet streets; controlled tone response, shadow alternatives | Validate native Dawn black-frame/output constraints before RenderPipeline |
| 4 — effects | Bloom on emissive objects, local fog, rain/steam, selective SSR/DoF only in scripted scenes | Mobile foreground exploration stays within measured budget |
| 5 — crowd/world | Sparse NPC/traffic animation at near LOD, authored transit behavior, meaningful environmental storytelling | Deterministic street clearance, reliable world-save resumption |

### Asset production and provenance

Use the Game Asset Production + Vendoring skills: source reference → design receipt → license and attribution → mesh/texture proof → Blender repair if authorized → GLB + KTX2 inspection → canonical hash roster → dry-run admit → separate owner approval → device GPU screenshot. No paid Meshy/Tripo job, commercial texture purchase, asset admission or copyrighted game asset is authorized here. Use *Time Stranger* for visual goals only, not redistributed game files or shader code. The existing derived cel rig requires its own commercial license/provenance review before release.

### Independent review roles

- Technical art lead: street-scale material palette, architecture, surface detail fading, before/after camera shots.
- WebGPU/TypeGPU lead: TSL shader compilation, WebGPU and WebGL2 fallback, native Dawn limitations.
- NYC environment designer: Harlem historic identity, verified NYCHA building IDs before any housing-specific override.
- Mobile performance engineer: p90 frame cost and memory before toggling detail on Duo, iPhone, XR.
- Asset/license reviewer: OSM ODbL, MIT sources, commercial PBR provenance, no imported Digimon IP.
- QA: baseline and candidate captured at the same saved coordinates, lighting and camera; screenshots do not substitute physical GPU evidence.

**Pending:** shader execution on physical devices, camera captures, original PBR textures, quality gates, end-to-end render regression.
