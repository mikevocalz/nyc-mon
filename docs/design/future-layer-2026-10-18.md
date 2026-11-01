# Future layer — 2026-10-18

What the near-future Harlem pass ships, what it is grounded on, and what stays
blocked. The layer lives behind `EXPO_PUBLIC_WORLD_FUTURE` (opt-in, same contract
as `EXPO_PUBLIC_WORLD_VD`); off, the world is byte-for-byte what it was.

## What the spec actually says

- `docs/design/DECISIONS.md` D17 — the approved future look is a *dusk* layer:
  warm/cool occupied windows, neon roofline trims in the brand 400/500 colours,
  lit storefront fascias, LED billboard panels with brand gradients and **no
  logos or lettering**, the sidewalk joint grid, royal kerb light lines, LED
  streetlights. No bloom (react-native-webgpu has no working post pass), no
  animated billboards (the canvas draws on demand).
- `docs/implementation/MOBILE_WORLD_PR_PACK.md` — the approved NYCHA facelift is
  an *additive, reversible overlay keyed by stable building ids*: refined
  brick/concrete palettes, charcoal window framing, modular façade panels,
  planted balconies and roof gardens, vertical architectural lighting, upgraded
  entrances. Selective and believable — not uniform neon. It also sequences the
  follow-on work: authored tower/rooftop add-ons with spatial metadata, then a
  holographic `AdSurface`, then Payload campaign/creative/approval contracts.
  The city-rendering milestone is explicitly *not* gated on CMS.
- `docs/design/research/realism.md` + `docs/design/handoff/*` — glass reflects,
  it does not glow; water towers and roof furniture are NYC vernacular; nothing
  arbitrary floats or shines.
- `docs/implementation/city-world.md` — the runtime `nycha` class comes from OSM
  `operator`/`owner` tags, **not** the verified NYCHA development dataset. The
  doc says no facelift should key on it until FUT-01 lands.

## What shipped (flag on)

`packages/app/features/game/world/future-layer.ts` + hooks in `city-mesh.ts` /
`index.ts`. Everything is deterministic off the stable building id, merged into
the existing shared buffers (near-detail, neon, roofs) — **zero new draw calls**
on the real tile (12 draws flag off, 12 flag on).

1. **Roofscape.** The dataset does not yet surface Valdrada's `roofKind` bits,
   so the canon-silent gap is filled with generic NYC roof furniture only —
   bulkheads, roof AC, chimney pots, standpipes — hashed per building, ≤ 4
   pieces per roof, biased toward commercial/tall/plain masses. Existing
   record-backed water towers are untouched.
2. **NYCHA facelift.** `class === 'nycha'` only (19 towers in the tile):
   charcoal spandrel bands + fins per floor, planted balcony slabs, entrance
   canopies, a roof-garden cap, and one thin brand-royal light strip up the
   edge — all additive geometry over the real footprint, all palette/surface
   tokens, no invented text or colour.
3. **Ad surfaces — plumbing only.** A stable-`AdSurface` inventory (≤ 48, the
   D17 billboard cap) with building/edge geometry, metres→geo round-trip, and
   eligibility: `campaign` on commercial/civic walls, `community` elsewhere —
   and **never on a residence** (brownstone/brick/nycha/church walls are
   residential by the canon reading). The neon buffer already paints the D17
   gradient panels; the registry is the contract a CMS would drive. There is no
   campaign/creative/approval schema in `apps/cms` yet, so no fetch, no remote
   state, nothing animated.

## Costs

Real tile (`harlem-apollo`), node harness:

| flag | draws | baked tris |
|---|---|---|
| off | 12 | 464,748 |
| on  | 12 | 574,685 |

The +110 k tris all land in the distance-banded near-detail buffer — only the
bands near the Caller draw — plus 19 thin roof-garden caps. Visible-frame cost
is a small fraction of the baked total. Roof counts: 557 bulkheads, 419 AC,
1,346 chimney pots, 556 standpipes; NYCHA: 197 panel strips, 631 balconies,
19 entrances/gardens/light strips.

## Still blocked (documented, not implemented)

- **FUT-01** — verified NYCHA development dataset. The facelift currently keys
  on the OSM-derived `nycha` class; treat it as *provisional*, not verified
  public-housing targeting.
- **Tower/rooftop kit** — canon calls for authored tower add-ons with spatial
  metadata. None exist; we shipped rule-based roof furniture only, no invented
  skyline.
- **CMS ads** — Payload collections exist but no campaign/creative/approval
  contract; the `AdSurface` registry is the integration seam.
- **Bloom/animation** — renderer limitation (D17), unchanged.

## Tests

`future-layer.test.ts`: determinism + caps + record-kinds only; nycha-only kit
selection; ad eligibility + geo round-trip; flag-on touches nycha buildings only
and adds ≤ 1 draw on synthetic tiles, exactly 0 on the real tile; real-tile
counts and unique stable ids.
