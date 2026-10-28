# Toon look spec: the Game world's cel material

Owner: `graphics`. Written 2026-10-16. Status: proposal. Nothing here is implemented; it is the brief a shader writer builds the replacement cel material from, without reference to the material it replaces.

Clean-room note: this brief was written from canon, the world's own code and docs, and published papers only. No constants, parameter names or structure carry over from the previous cel material. Every number below is a starting point marked **to be tuned** on device, not a value recovered from old code.

## Sources

- Canon and decisions:
  - `docs/NYC_MON_Clean_City_Legacy_and_Great_Miscalculation_v2.md`: near-future New York that "built its futuristic success story" on the cleanup; Harlem around the Apollo is the shipped tile.
  - `docs/design/DECISIONS.md` **D17**: the Game world is fixed at dusk. A low south-west sun, a sky from dusty rose through royal to brand night, and brand-colour light added *after* the cel shading so the bands stay.
  - `docs/design/DECISIONS.md` **D18**: street-level Harlem vernacular. Stoops, fire escapes, cornices, awnings, water towers, the Apollo marquee. The material has to serve all of it, not just bare prisms.
  - `docs/implementation/MOBILE_WORLD_PR_PACK.md`: Blade Runner / Ghost in the Shell *atmosphere*, "believable and lived-in, not uniform neon cyberpunk"; no unverified frame-rate claims.
  - `docs/implementation/caller-proxy.md`: the character this material shades first. A 1.8 m primitives figure, grey mannequin head and hands, royal jacket, ink trousers, carolina ground ring.
- The renderer as it stands:
  - `docs/implementation/city-world.md` and `packages/app/features/game/world/index.ts`: a dusk sun about 25° up in the south-west (`SUN`), a hemisphere light, `Fog`, TSL node materials only, **no shadow maps** (contact-shadow strips lean away from the sun instead), linear output with no tone-mapping pass, no bloom, an on-demand canvas that draws only while something moves.
  - `packages/app/features/game/world/palette.ts`: every material colour is a recipe over `@acme/theme` palette steps; no hex literal lives outside `packages/theme/tokens.ts`.
- Published technique (described here in our own words; the implementations must be too):
  - Junya Motomura, *GuiltyGearXrd's Art Style: The X Factor Between 2D and 3D*, GDC 2015. Anime cel shading principles.
  - Ravi Ramamoorthi and Pat Hanrahan, *An Efficient Representation for Irradiance Environment Maps*, SIGGRAPH 2001, <https://graphics.stanford.edu/papers/envmap/>. The nine-coefficient spherical-harmonics irradiance approximation.
  - three.js TSL wiki, <https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language>. The node vocabulary the material is written in (per `docs/design/reference-roster.md`).

There are no committed Duo screenshots of the city; the look is defined by the decisions and the colour table in `city-world.md`. The first device capture becomes the reference image (see Acceptance).

## 1. Target look

A banded, flat-lit dusk. West- and south-facing walls catch one warm key and pop; everything else sits in a cool mid or shadow band that keeps its colour instead of going black. The sky is doing that work, not a fill light. Shadow boundaries are crisp edges, not gradients: a facade is either in the lit band or out of it, and the line lands cleanly on geometry. On top of the bands, lit windows, neon trims, the Apollo marquee and the streetlight pools glow as pure emissive. They were drawn after the shading in D17 and stay that way, so fog still veils them.

The Caller (and later the Mons) shade in the same bands as the buildings so they sit inside the scene rather than pasted over it. At chase distance (8 m, eye about 4 m) a figure reads in two or three tones: a warm edge toward the sun, a cool body in shade, and at most a thin cool rim where the silhouette turns away from the sky.

The Motomura principles this is built on, restated: the shadow line is *chosen*, not simulated, so normals and the ramp threshold are art tools; two tones carry the form and a third appears only where it earns its place; the shaded side keeps colour because ambient light has a hue; rim and highlight are drawn accents placed where they read, not physics.

## 2. Lighting model

The material computes its own lighting in TSL on an unlit base (`MeshBasicNodeMaterial`). Three's built-in lighting is PBR-shaped, and we want the cost and the response fixed regardless of scene light count. `city-world.md` already relies on `setupLighting` adding `emissiveNode` to the unlit basic material, and fog applies on top for free.

Per fragment, in `colorNode`:

```text
shaded = albedo * ( ambient + direct ) + rim
```

- `albedo`: vertex colour (the city already bakes its palette into vertex colours) or a uniform colour per part (the proxy's jacket, visor, skin).
- `direct`: the key term, §2.1.
- `ambient`: the SH sky term, §2.2. This is also the shadow side; `ambient` alone is what a shadowed fragment gets.
- `rim`: the fresnel accent, §2.3.
- Emissive (lit windows, neon, the ground ring) is a separate `emissiveNode` input added after this sum, per D17.

### 2.1 Toon ramp (quantized diffuse)

`ndotl = dot(normalWorld, sunDir)` against the world's sun. The ramp quantizes it:

```text
lit = smoothstep(threshold - width, threshold + width, ndotl)
```

- `threshold`: where the lit band starts, in `ndotl` units. Start near a small positive value (the terminator sits at 0); **to be tuned** per material family.
- `width`: the transition band. Small (order 0.02–0.1) gives the crisp edge the look wants; near 0 degenerates to `step`. **To be tuned**: wide enough that the boundary does not shimmer under MSAA at chase distance, no wider.
- Two bands is the default: `colour = albedo * (ambient + keyColour * keyIntensity * lit * occlusion)`. A third "mid" band is an optional per-material flag implemented as a second `smoothstep` at a lower threshold, for characters if two tones read flat on a face. **To be decided** in the acceptance pass.
- `occlusion`: the baked occlusion input, §5. Default 1 where nothing is baked.
- Half-Lambert (`ndotl * 0.5 + 0.5` before the ramp) is an allowed variant on organic shapes if a hard terminator breaks a curved silhouette. **To be tuned**, off by default.

### 2.2 SH ambient (sky light)

Ambient is a second-order spherical-harmonics irradiance probe: nine RGB coefficients evaluated against the surface normal, per Ramamoorthi & Hanrahan (2001). The irradiance for normal `n` is `E(n) ≈ Σᵢ cᵢ Bᵢ(n)`, `i = 0..8`, where `B` is the order-2 SH basis and the `cᵢ` fold the published `A_l` cosine-lobe weights (π, 2π/3, 2π/3, 2π/3, π/4 ×5) into nine `vec3`s stored as material constants. Concretely the implementer writes the paper's Appendix basis (one constant term, three linear in `x,y,z`, five quadratic in `xy, yz, 3z²−1, xz, x²−y²`) and dots each RGB coefficient with it. No texture, no loop over lights; nine fused multiply-adds per channel.

Authoring, two routes, pick one after the first device look:

1. **Hand-tuned.** Start from a hemisphere probe: sky colour (`hemiSky` recipe) up, ground colour (`hemiGround` recipe) down, a warm bias toward the horizon/sun azimuth in the linear terms. Tune the nine `vec3`s live in a debug view until the shade side reads cool and never muddy.
2. **Projected.** A small `tooling/` script renders the authored dusk environment (the sky dome gradient plus a ground plane, sun excluded, since the key is already the `direct` term) into a cube map and projects it onto SH offline. The coefficients land in a TS module like `leaf-alpha.ts` did. Reproducible, and it automatically follows palette edits.

Either way the output is nine `vec3` constants in the world package. They are derived data, not theme tokens (§4).

What the SH must express at dusk: cool carolina/royal from the zenith, a warm rose cast toward the horizon, a concrete-grey bounce from below, and a slight directional imbalance away from the sun so shaded faces are not flat. Whether the last term lives in SH or in a weak fill light is **to be tuned**.

### 2.3 Fresnel rim

```text
fresnel = pow(1 - saturate(dot(normalWorld, viewDir)), rimPower)
rim = rimColour * rimStrength * fresnel * rimMask
```

- `viewDir = normalize(cameraPosition - positionWorld)`.
- `rimPower` controls edge tightness. **To be tuned**.
- `rimMask` is the part that makes it a drawn accent instead of a glow: a factor that keeps the rim where it reads against the sky, e.g. the lit term, an up-facingness term, or an authored per-vertex mask on characters. The exact mask is **to be tuned**. The requirement is that the rim never wraps a whole object evenly and never fires on faces pointing at the ground.
- `rimColour`: cool, from the sky family, a `carolina` step. **To be tuned**; default recipe in §4.
- Per-material on/off. Default on for actors (Caller, Mons), off for the ground plane and large flat land-use areas where it would chalk every edge. Buildings: **to be decided** (open question).

### 2.4 Specular: omitted

No specular term in v1. The look is flat; nothing in the city or the proxy is meant to read glossy, and the shiny things that exist (glass curtain walls, car paint, the visor) are already drawn as flat dark panes or emissive. A quantized second lobe can come later if a material (a Mon's eyes, wet asphalt in weather) needs a placed highlight, but it is an accent added on top of this model, not a PBR term. This also keeps the fragment cheap.

## 3. Functional rig spec

One rig, described by role. The material reads rig values as uniforms; it does not query scene lights. The scene's own `DirectionalLight`/`HemisphereLight` keep existing for anything still on lit materials, and the rig constants are the single source both sides share (the sun direction is already exported as `SUN` in `world/index.ts`).

| Light | Role | Tunables |
| --- | --- | --- |
| Key | The dusk sun. One dominant direction, low (about 25° up) in the south-west, the same direction the sky glow, contact-shadow lean and facade shading already assume, so a wall lit by the ramp agrees with the shadow strip on the pavement. Warm; the `sun` palette recipe (an `orange` step) is the starting hue. | Direction (locked to `SUN`), colour, `keyIntensity`. **To be tuned** on device so the lit band reads warm without blowing to the horizon colour. |
| Sky ambient | Everything that is not the sun: zenith blue, dusty-rose horizon, concrete bounce. Carried by the SH coefficients (§2.2), standing in for a hemisphere light plus skyline bounce. A shadowed facade should read cool and luminous, never toward `ink 950` black. | Nine `vec3` coefficients, hand-tuned or projected (§2.2). Overall `ambientIntensity` scalar. **To be tuned**. |
| Cool fill (optional) | If the SH's linear terms cannot give the shadow side enough form (the Caller's silhouette against dark asphalt), a second directional at low intensity, arriving from the north-east at a shallow angle, *unquantized*: it adds into `ambient`, never into `lit`, so it cannot create a second shadow boundary. | Colour (carolina family), intensity, on/off. Default off; **to be tuned** only if needed. |
| Ground bounce | Not a light object: the lower hemisphere of the SH probe (the `hemiGround` end) and, on the ground plane itself, the baked contact shadows do this work. | Via SH authoring. |
| Rim | The fresnel term (§2.3); view-dependent, needs no light entry. | As §2.3. |

Non-roles: no point lights in the material (streetlight pools are emissive decals already), no shadows from any light (§5), no environment-map reflections (no env map exists on device).

## 4. Token surface

Repo law: hex lives only in `packages/theme/tokens.ts`; the city's material colours are recipes in `world/palette.ts` (`mixHex` over palette steps); scalars stay in code. The toon material follows the same split:

- **Reuse as-is (`CITY_COLORS` recipes in `world/palette.ts`):** `sun` for the key, `hemiSky`/`hemiGround` as the poles of the SH probe, `skyHorizon` for the horizon bias. The material takes the *same* recipes the sky dome and scene lights use, so a palette edit moves sky, fog and shading together.
- **New colour recipes (candidates, all to be tuned):**
  - `toonShadow`: the hue the shade side leans toward when `ambient` alone is too neutral. Start `ink 800` mixed toward `royal`, a cool blue-ink, because dusk shade in the brand palette is blue, not grey.
  - `toonRim`: the rim accent. Start `carolina 300`.
  - `toonFill`: if the optional fill light ships. Start `carolina 400` dimmed.
  - Add them as recipes in `world/palette.ts` first; promote to `tokens.ts` only if a raw step or a new mix must be named at theme level (no new hex without a tokens.ts row).
- **Material uniforms (never tokens):** `threshold`, `width`, `keyIntensity`, `ambientIntensity`, `rimPower`, `rimStrength`, `rimMask` weights, band count, per-feature toggles. Theme owns colour; the material owns response.
- **Derived data (neither):** the nine SH `vec3`s live as constants in the world package, regenerated or retuned as a unit.
- **Debug surface:** the tunables should be reachable from a debug overlay or fixture so they can be tuned on device without a rebuild. Where that overlay lives is a tooling question, not a token one.

## 5. Constraints

- **TSL only.** `MeshBasicNodeMaterial` + `Fn()` graphs on three r186 `three/webgpu`; the same graph compiles for the WebGL fallback used in dev. No `onBeforeCompile`, no GLSL/WGSL strings, no new runtime dependency (the TypeGPU port stays deferred, per `city-world.md`).
- **No shadow maps.** They are unavailable on react-native-webgpu; the world fakes them with baked strips and bands. The material therefore takes `occlusion` as an *input*: a vertex attribute or texture where the tile bakes it, a blob/disc under actors, `1` everywhere else. `occlusion` multiplies the key term only; it darkens `lit`, it never removes `ambient`, so occluded shade still holds the sky colour.
- **Linear output, no tone mapping, no bloom.** Colours enter as linear (`linearColor`) exactly as the city's other materials; all glow is `emissiveNode`. The ramp must not push any band past the palette's intent, because nothing downstream will pull it back.
- **On-demand canvas.** The scene draws only while something moves; an idle Caller asks for no frames. No `time` nodes, no animated rim, no per-frame uniform churn. Uniforms change on rig or palette changes only.
- **Fragment budget.** The Duo bottleneck was vertex-side (857k triangles at ~15 fps), but the fragment cost still has to stay trivial: analytic ramp (no ramp-texture fetch), branchless `mix`/`step`/`smoothstep`, no loops, target a couple dozen ALU ops. Measure before claiming headroom.
- **Normals.** Flat-shaded boxes give clean per-face bands for free; characters need real smooth normals and, where the shadow boundary matters (a face, a visor), authored normals so the band lands where intended. That is the GGXrd lesson. Vertex normals on the proxy are already adequate; Mon GLBs are **to be checked** when they land.
- **Accessibility / reduced motion.** The material is static, so reduced motion changes nothing; no shimmer or flicker is allowed at rest (ramp `width` ≥ the shimmer floor). Readability is the real requirement: at chase 8 m the Caller's lit and shade sides must both stay separable from asphalt and sidewalk tones, which is a tuning gate in §6, and the carolina ground ring remains the "find the Caller" aid, so the rim colour must not collide with it.

## 6. Acceptance criteria

Parity is judged **by eye** at saved camera states. Colours may differ slightly from the previous material; bands, mood and readability may not. Screenshot pairs (old look vs new, captured in the same session) go to `docs/evidence/` alongside the run notes. Camera states use the `CityCamera` contract (`x`, `z`, `yaw`, `distance`); exact yaw values get recorded at capture:

| View | Where | What it proves |
| --- | --- | --- |
| A. Apollo spawn, street level | Sidewalk near (−28, 22), chase 8 m, looking north-east along W 125th (street axis ≈ 119°), facades away from the sun | Shade side cool and readable; neon, shop signs and lit windows unchanged; Caller reads against asphalt |
| B. Same spot, into the sun | Yaw ~180° from A | Lit band lands on west/south walls only; boundary is a clean edge; no haloing |
| C. Mid distance | Same block, chase 18–40 m | Bands hold at distance; no ramp shimmer on facades |
| D. Overview | Distance ≥ 220 m | Fog unchanged; lit windows average out; sky, fog and material horizon agree |

Reviewers compare:

- **Bands:** two clean tones on facades; boundary crisp at A/B/C; no banding noise, no gradient mush.
- **Shade side:** keeps colour (cool), never crushes to `ink 950`/black; reads as sky-lit shade, not darkness.
- **Lit side:** warm key consistent with the sky's sun glow and the contact-shadow lean direction.
- **Actors:** Caller readable in silhouette at 8 m; rim, if on, appears only where it earns its place.
- **Emissive path:** windows, neon, marquee, lamp pools identical to before (same `emissiveNode` input).
- **Cost:** no new draw calls; triangle budget rules unchanged (`world/budget.test.ts` still green); frame pacing measured on the Duo and reported honestly, since the PR pack forbids unverified fps claims.
- **Fallback:** the same material compiles under `forceWebGL` for dev/storybook, modulo float precision.

## 7. Open questions

- **Rim on buildings?** Default off; a subtle rim could help tall glass against the zenith. Decide at View D.
- **Two bands or three on characters?** Start two; add the mid band only if faces and capsule forms read flat in View A.
- **Shade hue:** cool blue (`ink`/`royal` mix) vs neutral. Needs a device look; the answer is a `toonShadow` recipe value, not a structural change.
- **SH authoring:** hand-tuned constants vs the `tooling/` projection script. Hand-tune first for speed; build the projector only if retuning becomes routine.
- **Trees/foliage:** leaf crowns are already flat alpha cards lit cheaply; whether they adopt this material or keep their own is a cost/look call. Not a v1 blocker.
- **Actor occlusion:** the Caller has no contact shadow today. A blob shadow under actors would ground them in View A; that is the world team's call, not this material's.
- **Future states:** night, weather and day cycles are out of scope (D17 fixes dusk). If a second time of day lands, it is a second rig; the material should already take its rig as data so nothing else changes.
- **Rig plumbing:** one shared uniform block for the whole scene vs per-material uniforms. Pick whichever TSL binds once cheapest; verify the on-demand canvas does not re-upload per frame.
