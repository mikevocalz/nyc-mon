// The gen lane's places (Phase 3 slice 2): what one cell's spec hands the Mon
// systems, derived from the same spec the massing draws from — pure, no three,
// so the same spec emits identical records every call and `node --test` covers
// all of it. Nothing here renders; these are the data contracts the record
// systems already read, emitted for lots the record city lacks.
//
// Four record families per cell, each matching an existing consumer's shape:
//
//   anchors    POI anchors for the 'place' uses (school / park+its open kinds /
//              pitch / office): cell-local f32x3, the lot's containment radius
//              and a descriptor name where the marked area supplies one —
//              offices stay anonymous, the port invents no proper names.
//   prisms     collider prisms in the ColliderPrism shape
//              (vd-port/systems/colliders.ts, the decode of write-colliders.mjs
//              kind 1): footprint ring extruded groundY -> groundY + height.
//              srcId takes the u32's top bit — record ids pack (tile, index)
//              into < 2^27, so a gen prism can never alias a record building.
//   walks      WalkEdge-compatible stubs (living-city/topology.ts): a perimeter
//              'edge' loop around each building lot and a 'gate' path through
//              each open lot — a pednet seam for a later consumer; nothing
//              stitches them into LaneTopology yet.
//   spawn      SpawnAnchor records (vd-port/systems/spawns.ts, the decode of
//              write-spawns.mjs kind 4) mapped into the atlas's six-habitat wire
//              vocabulary: school -> community_hub (its CIVIC_STONE style is the
//              same record rule), open grounds -> plaza, and any lot at least
//              ROOFTOP_MIN_M tall -> rooftop on its roof, exactly the record
//              footprint rule. 'park' itself is not in the wire vocabulary — the
//              bloodlines listing it match nothing baked today either.
//
// createGenBlocked turns the prisms into the extra walkability layer the flag
// adds in bundled-queries.ts: the same body-radius rim rule walkability.ts
// runs over record footprints. Flag off, nothing builds the index and nothing
// consults it.
import type { AreaKind } from '../../city-dataset.ts';
import { CELL, cellNum } from '../cells/cell-rules.ts';
import type { ColliderPrism } from '../vd-port/systems/colliders.ts';
import { pointInPrism } from '../vd-port/systems/colliders.ts';
import type { SpawnAnchor, SpawnHabitat } from '../vd-port/systems/spawns.ts';
import type { WalkEdge } from '../../living-city/topology.ts';
import { BODY_RADIUS } from '../walkability.ts';
import type { GenDataset, GenLotSpec, GenSpec, GenUse } from './spec.ts';
import { buildGenIndex, genSpecForCell } from './spec.ts';

/**
 * Every gen use, mapped into the atlas's wire habitat vocabulary
 * (write-spawns.mjs HABITAT / spawns.ts SPAWN_HABITAT). Height-gated habitats
 * emit their anchor only when the rule's bar is met — a two-storey home is not
 * a rooftop — but the mapping itself is total: a consumer may look any use up.
 */
export const GEN_USE_HABITAT: Readonly<Record<GenUse, SpawnHabitat>> = {
  school: 'community_hub', // civic style 8 — the record rule for civic/church footprints
  stadium: 'plaza', // a pitch's grounds: open public gathering ground
  park: 'plaza', // open ground (park/garden/grass/playground/plaza/parking): the public-open-space habitat
  office: 'rooftop',
  home: 'rooftop',
  mixed: 'rooftop',
};

/** write-spawns.mjs: a footprint this tall earns a rooftop anchor on its roof. */
export const GEN_ROOFTOP_MIN_M = 20;

/** The uses a POI anchor is emitted for — the 'place' uses. Home and mixed infill stays anonymous. */
const ANCHOR_USES: ReadonlySet<GenUse> = new Set(['school', 'stadium', 'park', 'office']);

/** Descriptor names for marked-area lots — the kind words, never invented proper names (the labels' own rule). */
const AREA_LABEL: Readonly<Record<AreaKind, string | undefined>> = {
  school: 'School',
  pitch: 'Playing pitch',
  park: 'Park',
  garden: 'Garden',
  grass: 'Park',
  playground: 'Playground',
  plaza: 'Plaza',
  parking: 'Parking lot',
  water: 'Water',
};

/** The perimeter loop stands this far off the footprint, metres — a walkway band outside the wall. */
const WALK_LOOP_OUT_M = 1.4;
/** The loop's band width, metres — WalkEdge.widthMeters semantics (its sidewalk band). */
const WALK_LOOP_WIDTH_M = 1.6;
/** A gate path's band width and the inset keeping its ends inside the open lot, metres. */
const GATE_WIDTH_M = 2;
const GATE_INSET_M = 1.5;

/**
 * A point of interest on a generated lot: its use, a cell-local f32x3 position
 * (the CellLocalPositionFrame convention — x/z about the cell centre, y on the
 * absolute datum), the containment radius a spawn or camera may roam without
 * leaving the lot, and a descriptor name where one exists.
 */
export interface GenAnchor {
  readonly use: GenUse;
  /** f32x3, cell-local about the cell centre (y absolute — the near arrays' convention). */
  readonly position: Float32Array;
  /** Half the lot's shorter side — a spawn may roam this far and stay on the lot. */
  readonly radiusM: number;
  readonly name?: string;
}

/** A walk stub: the LaneTopology WalkEdge shape (topology.ts) plus its lot and record kind. */
export interface GenWalkEdge extends WalkEdge {
  /** Index into the spec's lots this stub belongs to. */
  readonly lot: number;
  /** 'edge': the loop around a building lot. 'gate': the path through an open one. */
  readonly kind: 'edge' | 'gate';
}

/** A named place for the walk overlay's 'landmark' label channel (walk-destinations.ts WalkLabel minus its kind). */
export interface GenPoiLabel {
  readonly key: string;
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Everything one cell's spec emits for the systems. All collections in spec order — deterministic. */
export interface GenCellPlaces {
  readonly cx: number;
  readonly cz: number;
  readonly num: number;
  readonly key: string;
  /** POI anchors, cell-local f32x3. */
  readonly anchors: readonly GenAnchor[];
  /** Collider prisms, absolute scene metres, ColliderPrism shape. */
  readonly prisms: readonly ColliderPrism[];
  /** Walk-edge stubs, absolute scene metres, WalkEdge-compatible. */
  readonly walks: readonly GenWalkEdge[];
  /** The distinct habitats this cell's spawn anchors earn, first-seen order. */
  readonly habitats: readonly SpawnHabitat[];
  /** SpawnAnchor records, absolute scene metres — mergeable into a spawn-zone table verbatim. */
  readonly spawnAnchors: readonly SpawnAnchor[];
  /** Named anchors for the walk overlay's landmark channel. */
  readonly poi: readonly GenPoiLabel[];
}

function lotCentre(lot: GenLotSpec): readonly [number, number] {
  return [(lot.rect[0] + lot.rect[2]) / 2, (lot.rect[1] + lot.rect[3]) / 2];
}

function lotHeight(lot: GenLotSpec): number {
  return lot.floors * lot.floorHeightMeters;
}

/**
 * A prism id in a space the record packing can never reach: record srcIds top
 * out at (127 x 128 + 127) x 4096 + 4095 < 2^27 (write-colliders.mjs), so the
 * top bit marks gen content. Low bits pack the cell (10 + 10) and the spec lot
 * index (6) — unique within any tile under +/-512 cells and 64 lots a cell.
 */
function genSrcId(spec: GenSpec, lot: number): number {
  return (0x80000000 | (((spec.cx + 512) & 0x3ff) << 16) | (((spec.cz + 512) & 0x3ff) << 6) | (lot & 0x3f)) >>> 0;
}

/** The spawn anchor a lot earns, or null — the rooftop rule height-gates; water earns none. */
function lotSpawnAnchor(lot: GenLotSpec, ground: number, x: number, z: number): SpawnAnchor | null {
  const habitat = GEN_USE_HABITAT[lot.use];
  if (habitat === 'rooftop') {
    // write-spawns' rule: footprints 20 m or taller anchor on the roof.
    const h = lotHeight(lot);
    return h >= GEN_ROOFTOP_MIN_M ? { habitat, x, y: ground + h, z } : null;
  }
  // open grounds are spawnable places; open water is not.
  if (lot.area === 'water') return null;
  return { habitat, x, y: ground, z };
}

/**
 * One cell's spec as system records. `groundY` is the walkable-surface query
 * (the same ctx.groundY the massing grounds on). Deterministic in spec order.
 */
export function genCellPlaces(spec: GenSpec, groundY: (x: number, z: number) => number): GenCellPlaces {
  const ox = spec.cx * CELL + CELL / 2;
  const oz = spec.cz * CELL + CELL / 2;
  const anchors: GenAnchor[] = [];
  const prisms: ColliderPrism[] = [];
  const walks: GenWalkEdge[] = [];
  const spawnAnchors: SpawnAnchor[] = [];
  const poi: GenPoiLabel[] = [];

  spec.lots.forEach((lot, i) => {
    const [x0, z0, x1, z1] = lot.rect;
    const [mx, mz] = lotCentre(lot);
    const ground = groundY(mx, mz);
    const height = lotHeight(lot);

    if (lot.floors > 0) {
      // Collider prism: footprint ring extruded base to top — write-colliders' shape, no holes.
      prisms.push({
        srcId: genSrcId(spec, i),
        ring: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]],
        holes: [],
        y0: ground,
        y1: ground + height,
        style: lot.styleId,
        landmarkId: 0,
        flags: 0,
        minX: x0,
        minZ: z0,
        maxX: x1,
        maxZ: z1,
      });
      // Walk stub: the perimeter loop a ped can circulate on, standing off the walls.
      const m = WALK_LOOP_OUT_M;
      walks.push({
        id: `walk:gen:${spec.key}:${i}:loop`,
        roadId: `gen:${spec.key}:${i}`,
        nodeA: `node:gen:${spec.key}:${i}:loop`,
        nodeB: `node:gen:${spec.key}:${i}:loop`,
        side: 'left',
        points: [x0 - m, z0 - m, x1 + m, z0 - m, x1 + m, z1 + m, x0 - m, z1 + m, x0 - m, z0 - m],
        widthMeters: WALK_LOOP_WIDTH_M,
        lot: i,
        kind: 'edge',
      });
    } else if (lot.area !== 'water') {
      // Walk stub: the desire line through an open lot, along its longer axis.
      const w = x1 - x0, d = z1 - z0;
      walks.push({
        id: `walk:gen:${spec.key}:${i}:gate`,
        roadId: `gen:${spec.key}:${i}`,
        nodeA: `node:gen:${spec.key}:${i}:a`,
        nodeB: `node:gen:${spec.key}:${i}:b`,
        side: 'left',
        points: w >= d ? [x0 + GATE_INSET_M, mz, x1 - GATE_INSET_M, mz] : [mx, z0 + GATE_INSET_M, mx, z1 - GATE_INSET_M],
        widthMeters: GATE_WIDTH_M,
        lot: i,
        kind: 'gate',
      });
    }

    if (ANCHOR_USES.has(lot.use)) {
      const name = lot.area !== undefined ? AREA_LABEL[lot.area] : undefined;
      anchors.push({
        use: lot.use,
        position: new Float32Array([mx - ox, ground, mz - oz]),
        radiusM: Math.min(x1 - x0, z1 - z0) / 2,
        ...(name !== undefined ? { name } : {}),
      });
      if (name !== undefined) {
        poi.push({ key: `genpoi:${spec.key}:${i}`, text: name, x: mx, y: ground + height + 6, z: mz });
      }
    }

    const spawn = lotSpawnAnchor(lot, ground, mx, mz);
    if (spawn !== null) spawnAnchors.push(spawn);
  });

  const habitats: SpawnHabitat[] = [];
  for (const a of spawnAnchors) if (!habitats.includes(a.habitat)) habitats.push(a.habitat);
  return { cx: spec.cx, cz: spec.cz, num: spec.num, key: spec.key, anchors, prisms, walks, habitats, spawnAnchors, poi };
}

/**
 * The whole tile's places, one record per cell with content — the same cell
 * enumeration genCellPackages walks (layer.ts). `inside` is the playable-bounds
 * predicate the spec already takes; default: the tile square.
 */
export function genPlacesForTile(
  dataset: GenDataset & { readonly extentMeters: number },
  groundY: (x: number, z: number) => number,
  inside?: (x: number, z: number) => boolean,
): GenCellPlaces[] {
  const index = buildGenIndex(dataset);
  const half = dataset.extentMeters;
  const out: GenCellPlaces[] = [];
  for (let cx = Math.floor(-half / CELL); cx <= Math.floor(half / CELL); cx++) {
    for (let cz = Math.floor(-half / CELL); cz <= Math.floor(half / CELL); cz++) {
      const spec = genSpecForCell(cx, cz, { index, inside });
      if (spec.lots.length === 0) continue;
      out.push(genCellPlaces(spec, groundY));
    }
  }
  return out;
}

/**
 * The generated-content walkable index: gen prisms as an extra blocked layer,
 * answering with walkability.ts's own rule — the body is a circle, so the
 * centre and four rim points at BODY_RADIUS must each clear every footprint.
 * Ground-level stand test only (y ignored), matching the record buildings.
 * Each prism registers into every cell its bounds plus the body radius touch
 * (write-colliders' overlap rule), so a rim point across a seam still sees it.
 */
export function createGenBlocked(places: readonly GenCellPlaces[]): (x: number, z: number) => boolean {
  const cells = new Map<number, ColliderPrism[]>();
  for (const cell of places) {
    for (const p of cell.prisms) {
      for (let cx = Math.floor((p.minX - BODY_RADIUS) / CELL); cx <= Math.floor((p.maxX + BODY_RADIUS) / CELL); cx++) {
        for (let cz = Math.floor((p.minZ - BODY_RADIUS) / CELL); cz <= Math.floor((p.maxZ + BODY_RADIUS) / CELL); cz++) {
          const num = cellNum(cx, cz);
          const list = cells.get(num);
          if (list) list.push(p);
          else cells.set(num, [p]);
        }
      }
    }
  }
  const rim = [[0, 0], [BODY_RADIUS, 0], [-BODY_RADIUS, 0], [0, BODY_RADIUS], [0, -BODY_RADIUS]] as const;
  return (x, z) => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
    for (const [ox, oz] of rim) {
      const px = x + ox, pz = z + oz;
      const list = cells.get(cellNum(Math.floor(px / CELL), Math.floor(pz / CELL)));
      if (list === undefined) continue;
      for (const p of list) if (pointInPrism(px, pz, p)) return true;
    }
    return false;
  };
}

/**
 * The blocked layer for the bundled tile: specs, places and the index in one
 * call — what bundled-queries.ts wires in behind EXPO_PUBLIC_WORLD_GEN.
 * `inside` mirrors ctx.inBounds (the tile square), the same gate the layer's
 * interior lots take.
 */
export function createGenBlockedFor(dataset: GenDataset & { readonly extentMeters: number }, groundY: (x: number, z: number) => number): (x: number, z: number) => boolean {
  const half = dataset.extentMeters;
  return createGenBlocked(genPlacesForTile(dataset, groundY, (x, z) => Math.abs(x) <= half && Math.abs(z) <= half));
}

/**
 * The tile's named generated places for the walk overlay's 'landmark' label
 * channel — the WalkLabel shape minus `kind`, which the caller sets. Descriptor
 * names only (a generated school is 'School'): the labels' own no-invented-text
 * rule, kept. Flag-off callers never build this list.
 */
export function genPoiLabelsFor(dataset: GenDataset & { readonly extentMeters: number }, groundY: (x: number, z: number) => number): GenPoiLabel[] {
  const half = dataset.extentMeters;
  return genPlacesForTile(dataset, groundY, (x, z) => Math.abs(x) <= half && Math.abs(z) <= half).flatMap((c) => c.poi);
}
