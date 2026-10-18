// Living City PR07 — visible traffic-signal heads and pedestrian signal
// displays, plus the snapshot extension that carries them. The single
// source of truth is the PR03 controller: the host packs each signalized
// junction's `vehicleAspects`/`pedAspects` into the SAME flat snapshot
// the vehicle and ped sims already publish, and this actor renders the
// lamps from those packed bytes — it never calls `signals.state()`
// itself. The honesty test (signal-viz.test.ts) decodes the packed
// section and asserts it reproduces `SignalSystem.state` element for
// element: what AI sees is what the street shows, by construction.
//
// Snapshot layout — EXTENDED, not forked (same rule as PR06):
//
//   [vehicle section: VSNAP_HEADER + count×VSNAP_STRIDE]   (untouched)
//   [ped section:     PSNAP_HEADER + count×PSNAP_STRIDE]   (untouched)
//   [signal section:  SSIG_HEADER + count×SSIG_STRIDE]     (new)
//   [env section:     CSNAP_HEADER + CSNAP_STRIDE]         (new, clock.ts)
//
// The signal section binds aspect codes to a canonical element roster —
// `signalRoster(signals)`, which any runtime rebuilds identically from
// the deterministic topology (topology ids and matrix order are
// byte-stable, so a JS-side packer and a worklet-side reader agree on
// index→element without shipping the ids themselves). Each record is
// [aspectCode, aux]: aspect 0/1/2 = R/Y/G for connectors, D/F/W for
// crosswalks; aux carries the FDW countdown seconds for future countdown
// digits.
//
// Rendering (spec §10, "no shadow-casting point light per streetlamp" —
// signal lamps are emissive, never light sources): one InstancedMesh of
// near-corner pole+head props per approach leg of every signalized
// junction, one of ped boxes at each crosswalk mouth, and ONE instanced
// quad mesh for every lens — lit state lands in instanceColor, so a
// phase change is a colour write, not a geometry rebuild. All three sets
// follow the tree-lod/light-pool precedent: nearest-N picks within a
// radius around the camera focus, refreshed only after a ~10 m move.
//
// FDW blink reads `simTime` out of the packed env section — the sim
// clock, not wall time — so the flash is phase-locked with the sim and
// pauses when it pauses.

import type { Three } from '@acme/ui/three';
import type { ActorFrame, SceneActor, SceneActorFactory } from '../scene-actor.ts';
import { pickWithin, TREE_REFRESH_METRES } from '../world/tree-lod.ts';
import {
  CSNAP_HEADER,
  CSNAP_SCHEME,
  CSNAP_STRIDE,
  packEnvSection,
  readEnvSection,
  type CityClockState,
} from './clock.ts';
import { PSNAP, PSNAP_HEADER, PSNAP_STRIDE, packPedSection, pedSectionOffset } from './ped-sim.ts';
import type { PedSim } from './ped-sim.ts';
import type { SignalSystem } from './signal-controller.ts';
import type { LaneTopology } from './topology.ts';
import {
  VSNAP,
  VSNAP_HEADER,
  VSNAP_STRIDE,
  packVehicleSnapshot,
  type VehicleSim,
} from './vehicle-sim.ts';

// --- Signal section codec --------------------------------------------------------

/**
 * Canonical element roster: every claimable element at every signalized
 * junction, grouped by node (controllers iterate in sorted node id
 * order) with connectors before crosswalks per node — exactly the
 * matrix's own ordering, which is deterministic given the topology.
 * Both sides of the channel build it once and agree on index → element.
 */
export interface SignalRosterEntry {
  readonly node: string;
  readonly element: string;
  readonly kind: 'connector' | 'xwalk';
}

export function signalRoster(signals: SignalSystem): SignalRosterEntry[] {
  const out: SignalRosterEntry[] = [];
  for (const [node, controller] of signals.nodes) {
    for (const c of controller.matrix.connectors) out.push({ node, element: c.id, kind: 'connector' });
    for (const x of controller.matrix.xwalks) out.push({ node, element: x.id, kind: 'xwalk' });
  }
  return out;
}

/** Aspect codes packed per element. Shared numeric space; the roster's `kind` says which table applies. */
export const VEHICLE_ASPECT_CODE = { R: 0, Y: 1, G: 2 } as const;
export const PED_ASPECT_CODE = { D: 0, F: 1, W: 2 } as const;
/**
 * Signal section: [count, stride, scheme, nodeCount] then `count`
 * records of [aspectCode, auxSeconds]. `aux` = seconds left in the FDW
 * change interval for a flashing crosswalk (the countdown feed), 0
 * otherwise.
 */
export const SSIG_HEADER = 4;
export const SSIG_STRIDE = 2;
export const SSIG_SCHEME = 1;
export const SSIG = { count: 0, stride: 1, scheme: 2, nodes: 3 } as const;

/** Absolute offset of the signal section inside a world snapshot. */
export function signalSectionOffset(snapshot: readonly number[] | null | undefined): number {
  if (!snapshot || snapshot.length < VSNAP_HEADER) return VSNAP_HEADER + PSNAP_HEADER;
  const pedOff = pedSectionOffset(snapshot);
  const peds = snapshot.length > pedOff ? (snapshot[pedOff + PSNAP.count] ?? 0) : 0;
  return pedOff + PSNAP_HEADER + peds * PSNAP_STRIDE;
}

/** Absolute offset of the env (clock) section — immediately after the signal section. */
export function envSectionOffset(snapshot: readonly number[] | null | undefined): number {
  const off = signalSectionOffset(snapshot);
  if (!snapshot || snapshot.length < off + SSIG_HEADER) return off + SSIG_HEADER;
  const count = snapshot[off + SSIG.count] ?? 0;
  const stride = snapshot[off + SSIG.stride] ?? SSIG_STRIDE;
  return off + SSIG_HEADER + count * stride;
}

/** Element count in a world snapshot's signal section (0 when predated). */
export function signalSectionCount(snapshot: readonly number[] | null | undefined): number {
  const off = signalSectionOffset(snapshot);
  if (!snapshot || snapshot.length < off + SSIG_HEADER || snapshot[off + SSIG.scheme] !== SSIG_SCHEME) return 0;
  return snapshot[off + SSIG.count] ?? 0;
}

/** Aspect code of roster element `index`, or -1 when the snapshot predates the section. */
export function signalAspectAt(snapshot: readonly number[], index: number): number {
  const off = signalSectionOffset(snapshot) + SSIG_HEADER + index * SSIG_STRIDE;
  return snapshot[off] ?? -1;
}

/** Aux seconds (FDW countdown) of roster element `index`. */
export function signalAuxAt(snapshot: readonly number[], index: number): number {
  const off = signalSectionOffset(snapshot) + SSIG_HEADER + index * SSIG_STRIDE + 1;
  return snapshot[off] ?? 0;
}

/**
 * Pack every signalized element's aspect, in roster order. One
 * `state()` call per node covers all its elements — the exact same
 * controller call the sims make. Fresh array every call.
 */
export function packSignalSection(signals: SignalSystem, roster: readonly SignalRosterEntry[]): number[] {
  const out = new Array<number>(SSIG_HEADER + roster.length * SSIG_STRIDE).fill(0);
  out[SSIG.count] = roster.length;
  out[SSIG.stride] = SSIG_STRIDE;
  out[SSIG.scheme] = SSIG_SCHEME;
  out[SSIG.nodes] = signals.nodes.size;
  let node = '';
  let state: ReturnType<SignalSystem['state']> | undefined;
  for (let i = 0; i < roster.length; i++) {
    const entry = roster[i]!;
    if (entry.node !== node) {
      node = entry.node;
      state = signals.state(node);
    }
    const o = SSIG_HEADER + i * SSIG_STRIDE;
    if (!state) continue; // unreachable for roster elements — a missing node packs 0 (R/D)
    if (entry.kind === 'connector') {
      out[o] = VEHICLE_ASPECT_CODE[state.vehicleAspects[entry.element] ?? 'R'];
    } else {
      const aspect = state.pedAspects[entry.element] ?? 'D';
      out[o] = PED_ASPECT_CODE[aspect];
      if (aspect === 'F') {
        const window = state.cycleSeconds > 0
          ? signals.controllerFor(node)?.plan.pedWindows.find((w) => w.xwalk === entry.element)
          : undefined;
        if (window) out[o + 1] = Math.max(0, window.flashEnd - state.tCycle);
      }
    }
  }
  return out;
}

/** The empty signal section — keeps the layout stable with no signalized nodes. */
export function emptySignalSection(): number[] {
  const out = new Array<number>(SSIG_HEADER).fill(0);
  out[SSIG.stride] = SSIG_STRIDE;
  out[SSIG.scheme] = SSIG_SCHEME;
  return out;
}

// --- World snapshot composition ---------------------------------------------------

/**
 * The whole packed world state the host publishes per tick: the
 * untouched PR05 vehicle layout + the PR06 ped section + the PR07
 * signal and env sections. Fresh array every call — the Synchronizable
 * identity rule holds (render-snapshot.ts / worklet-host.ts notes).
 */
export function packWorldSnapshot(
  version: number,
  vehicles: VehicleSim,
  peds: PedSim,
  signals: SignalSystem,
  clock: CityClockState,
  roster: readonly SignalRosterEntry[],
): number[] {
  const veh = packVehicleSnapshot(version, vehicles);
  const ped = packPedSection(peds);
  const sig = packSignalSection(signals, roster);
  const env = packEnvSection(clock, vehicles.metrics.simTime);
  return [...veh, ...ped, ...sig, ...env];
}

/** The empty world snapshot — valid headers for every section, zero records. */
export function emptyWorldSnapshot(): number[] {
  const veh = new Array<number>(VSNAP_HEADER).fill(0);
  veh[VSNAP.stride] = VSNAP_STRIDE;
  const env = new Array<number>(CSNAP_HEADER + CSNAP_STRIDE).fill(0);
  env[0] = CSNAP_SCHEME;
  env[1] = CSNAP_STRIDE;
  return [...veh, 0, PSNAP_STRIDE, 0, 0, ...emptySignalSection(), ...env];
}

// --- Head / ped-box placement (pure) ------------------------------------------------

/** How far the pole stands toward the approaching traffic from the leg mouth. */
const HEAD_PULLBACK_METRES = 1.5;
/** Lateral offset past the carriageway edge — the kerb-line band the streetlights share. */
const HEAD_KERB_OFFSET_METRES = 1.1;
/** Pole height for the primitive head (matches the registry's `prop.signalhead` scale: NYC side-mount). */
export const SIGNAL_POLE_HEIGHT = 5.6;
/** Ped-signal box height and kerb offset. */
const PED_BOX_HEIGHT = 2.6;
const PED_BOX_SIDE_OFFSET = 1.7;

export interface SignalHeadPlacement {
  readonly node: string;
  /** The connector id this head's lenses mirror (prefer a `through`; all connectors departing a leg share its phase group). */
  readonly element: string;
  readonly leg: number;
  readonly x: number;
  readonly z: number;
  /** Facing yaw — the head's +Z looks back at the approaching drivers. */
  readonly yaw: number;
}

export interface PedBoxPlacement {
  readonly node: string;
  /** The crosswalk id this box's lenses mirror. */
  readonly element: string;
  /** Which xwalk end the waiting ped stands at (the box sits across from them). */
  readonly servingEnd: 0 | 1;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
}

/**
 * One near-corner signal head per approach leg of every signalized
 * junction: the pole stands on the right-of-traffic side of the leg
 * mouth, pulled back from the box edge, and faces the oncoming
 * drivers. The head binds to the leg's deterministic connector pick
 * (the first `through` connector, else the smallest id) — every
 * connector departing the leg shares the leg's phase group, so the
 * pick cannot disagree with the aspect the drivers read on screen.
 */
export function signalHeadPlacements(topology: LaneTopology, signals: SignalSystem): SignalHeadPlacement[] {
  const out: SignalHeadPlacement[] = [];
  for (const [nodeId, controller] of signals.nodes) {
    const node = topology.nodeById.get(nodeId);
    if (!node) continue;
    const incoming = topology.lanesTo.get(nodeId) ?? [];
    const conns = controller.matrix.connectors;
    for (let legIndex = 0; legIndex < node.legs.length; legIndex++) {
      const leg = node.legs[legIndex]!;
      const lanes = incoming.filter((l) => !l.internal && leg.roadIds.includes(l.roadId));
      if (lanes.length === 0) continue;
      const laneIds = new Set(lanes.map((l) => l.id));
      const candidates = conns.filter((c) => laneIds.has(c.in));
      if (candidates.length === 0) continue;
      const bound = candidates.find((c) => c.turn === 'through') ?? candidates[0]!;
      const az = leg.azimuth;
      // Direction the road leaves the node; the driver travels the
      // opposite way. Right of their travel: (sin az, −cos az).
      const rx = Math.sin(az);
      const rz = -Math.cos(az);
      const off = leg.widthMeters / 2 + HEAD_KERB_OFFSET_METRES;
      const x = leg.mouth[0] + Math.cos(az) * HEAD_PULLBACK_METRES + rx * off;
      const z = leg.mouth[1] + Math.sin(az) * HEAD_PULLBACK_METRES + rz * off;
      const yaw = Math.atan2(-Math.cos(az), -Math.sin(az));
      out.push({ node: nodeId, element: bound.id, leg: legIndex, x, z, yaw });
    }
  }
  return out;
}

/**
 * Ped-signal boxes at each signalized crosswalk: one box per waiting
 * end, mounted on the far corner facing back across the zebra (the NYC
 * convention — you read the display you are walking toward). Bound to
 * the xwalk's own ped aspect.
 */
export function pedBoxPlacements(topology: LaneTopology, signals: SignalSystem): PedBoxPlacement[] {
  const out: PedBoxPlacement[] = [];
  for (const [nodeId, controller] of signals.nodes) {
    const node = topology.nodeById.get(nodeId);
    if (!node) continue;
    for (const x of controller.matrix.xwalks) {
      const p = x.points;
      const n = p.length;
      if (n < 4) continue;
      const dx = p[n - 2]! - p[0]!;
      const dz = p[n - 1]! - p[1]!;
      const len = Math.hypot(dx, dz);
      if (len < 1e-6) continue;
      const ux = dx / len;
      const uz = dz / len;
      // Right of the crossing direction (end0 → end1).
      const rx = -uz;
      const rz = ux;
      for (const end of [0, 1] as const) {
        // The box serving end `end` stands at the far end, to the right
        // of the crossing direction as the waiting ped sees it, facing
        // back toward them.
        const far = end === 0 ? n - 2 : 0;
        const side = end === 0 ? 1 : -1;
        const bx = p[far]! + rx * side * PED_BOX_SIDE_OFFSET;
        const bz = p[far + 1]! + rz * side * PED_BOX_SIDE_OFFSET;
        const yaw = Math.atan2(end === 0 ? -ux : ux, end === 0 ? -uz : uz);
        out.push({ node: nodeId, element: x.id, servingEnd: end, x: bx, z: bz, yaw });
      }
    }
  }
  return out;
}

// --- Primitive geometry (the `proc:` registry recipes) -------------------------------

export interface VizGeometryData {
  readonly positions: number[];
  readonly normals: number[];
  readonly indices: number[];
  readonly triangles: number;
  /** Flat list of lens anchor points in local space — the instanced lens quads mount here. */
  readonly lensAnchors: readonly number[];
}

function pushBox(pos: number[], nrm: number[], idx: number[], cx: number, cy: number, cz: number, sx: number, sy: number, sz: number): void {
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;
  const faces: [number, number, number, number[]][] = [
    [1, 0, 0, [hx, -hy, -hz, hx, -hy, hz, hx, hy, hz, hx, hy, -hz]],
    [-1, 0, 0, [-hx, -hy, hz, -hx, -hy, -hz, -hx, hy, -hz, -hx, hy, hz]],
    [0, 1, 0, [-hx, hy, -hz, hx, hy, -hz, hx, hy, hz, -hx, hy, hz]],
    [0, -1, 0, [-hx, -hy, hz, hx, -hy, hz, hx, -hy, -hz, -hx, -hy, -hz]],
    [0, 0, 1, [-hx, -hy, hz, hx, -hy, hz, hx, hy, hz, -hx, hy, hz]],
    [0, 0, -1, [hx, -hy, -hz, -hx, -hy, -hz, -hx, hy, -hz, hx, hy, -hz]],
  ];
  for (const [nx, ny, nz, c] of faces) {
    const base = pos.length / 3;
    for (let i = 0; i < 4; i++) {
      pos.push(cx + c[i * 3]!, cy + c[i * 3 + 1]!, cz + c[i * 3 + 2]!);
      nrm.push(nx, ny, nz);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

/** Open 6-sided tube (pole), base at y=0 — same recipe as the world's sign poles. */
function pushTube(pos: number[], nrm: number[], idx: number[], cx: number, cz: number, radius: number, height: number): void {
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * Math.PI * 2;
    const a1 = ((i + 1) / 6) * Math.PI * 2;
    const x0 = cx + Math.cos(a0) * radius;
    const z0 = cz + Math.sin(a0) * radius;
    const x1 = cx + Math.cos(a1) * radius;
    const z1 = cz + Math.sin(a1) * radius;
    const mx = Math.cos((a0 + a1) / 2);
    const mz = Math.sin((a0 + a1) / 2);
    const base = pos.length / 3;
    pos.push(x0, 0, z0, x1, 0, z1, x1, height, z1, x0, height, z0);
    for (let k = 0; k < 4; k++) nrm.push(mx, 0, mz);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

/** Lens diameter and spacing on the vehicle head (NYC 8-inch module reads ~0.2 m). */
const LENS_RADIUS = 0.11;
const LENS_SPACING = 0.32;

/**
 * The `proc:signal-head` recipe: an open pole tube to `height`, a
 * vertical three-lens head box at the top facing +Z, a visor nub per
 * lens, and three lens anchors (top=R, mid=Y, bottom=G) on its face.
 * 12 + 12 + 3×12 = 60 triangles — with ped boxes at 48 the near-field
 * caps (320 + 320 instances) stay inside the ~50 k dynamic-actor budget.
 */
export function signalHeadGeometryData(height = SIGNAL_POLE_HEIGHT): VizGeometryData {
  const pos: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];
  pushTube(pos, nrm, idx, 0, 0, 0.07, height - 1.05);
  // Head box: 0.34 wide × 1.05 tall × 0.22 deep, front face at +Z.
  pushBox(pos, nrm, idx, 0, height - 0.55, 0, 0.34, 1.05, 0.22);
  // Visor nubs over each lens.
  for (let i = 0; i < 3; i++) {
    pushBox(pos, nrm, idx, 0, height - 0.25 - i * LENS_SPACING, 0.15, 0.3, 0.09, 0.12);
  }
  const lensAnchors = [0, height - 0.25, 0.115, 0, height - 0.25 - LENS_SPACING, 0.115, 0, height - 0.25 - 2 * LENS_SPACING, 0.115];
  return { positions: pos, normals: nrm, indices: idx, triangles: idx.length / 3, lensAnchors };
}

/**
 * The `proc:ped-box` recipe: a slim pole and a small two-lens box
 * facing +Z — UPRAISED HAND over WALKING PERSON (NYC combo display),
 * with a brow over each lens. 12 + 12 + 2×12 = 48 triangles.
 */
export function pedBoxGeometryData(height = PED_BOX_HEIGHT): VizGeometryData {
  const pos: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];
  pushTube(pos, nrm, idx, 0, 0, 0.05, height - 0.5);
  pushBox(pos, nrm, idx, 0, height - 0.25, 0, 0.36, 0.5, 0.18);
  for (let i = 0; i < 2; i++) {
    pushBox(pos, nrm, idx, 0, height - 0.14 - i * 0.22, 0.11, 0.3, 0.05, 0.1);
  }
  const lensAnchors = [0, height - 0.14, 0.095, 0, height - 0.36, 0.095];
  return { positions: pos, normals: nrm, indices: idx, triangles: idx.length / 3, lensAnchors };
}

// --- Lens state mapping (pure — the honesty seam) --------------------------------------

/** A quad glow colour: off lenses read as dark glass; lit lenses bloom their aspect colour. */
export const LENS_COLORS = {
  red: [0.98, 0.12, 0.09],
  amber: [1.0, 0.62, 0.04],
  green: [0.15, 0.85, 0.38],
  walk: [0.92, 0.94, 0.9],
  hand: [0.98, 0.3, 0.12],
  off: [0.045, 0.045, 0.05],
} as const;

export type LensColorKey = keyof typeof LENS_COLORS;

/**
 * The three vehicle-lens colours for an aspect code (top→bottom = R/Y/G
 * sockets; exactly one lights). Off-map codes read all dark — a packed
 * 0 means 'R', matching the controller's own default.
 */
export function vehicleLensKeys(aspectCode: number): readonly [LensColorKey, LensColorKey, LensColorKey] {
  if (aspectCode === VEHICLE_ASPECT_CODE.Y) return ['off', 'amber', 'off'];
  if (aspectCode === VEHICLE_ASPECT_CODE.G) return ['off', 'off', 'green'];
  return ['red', 'off', 'off'];
}

/**
 * Ped-box lens colours for an aspect code (top = hand, bottom =
 * walker). `F` flashes on the sim clock: `fdwBlink(simTime)` gates the
 * hand lens, `W` lights the walker, `D` holds the hand steady.
 */
export function pedLensKeys(aspectCode: number, simTime: number): readonly [LensColorKey, LensColorKey] {
  if (aspectCode === PED_ASPECT_CODE.W) return ['off', 'walk'];
  if (aspectCode === PED_ASPECT_CODE.F) return [fdwBlink(simTime) ? 'hand' : 'off', 'off'];
  return ['hand', 'off'];
}

/** NYC flashing-DON'T-WALK cadence: ~1.6 Hz square wave on the sim clock (deterministic, pauses with the sim). */
export function fdwBlink(simTime: number): boolean {
  return ((simTime * 1.6) % 1 + 1) % 1 < 0.55;
}

// --- The scene actor -----------------------------------------------------------------

/** Near-field caps — the same discipline as the world's own lamp pools. */
export const SIGNAL_HEAD_RADIUS = 300;
export const SIGNAL_HEAD_CAP = 320;
export const PED_BOX_RADIUS = 220;
export const PED_BOX_CAP = 320;

export interface SignalActorOptions {
  /** Latest packed world snapshot (host's `latestSnapshot()` on JS, a Synchronizable `getDirty()` on the render runtime). */
  readonly read: () => readonly number[] | null | undefined;
  /** The signal system the snapshot was packed from — supplies the roster (index → element). Never stepped here. */
  readonly signals: SignalSystem;
  readonly topology: LaneTopology;
  /** Camera look-at point for the near-field caps — injected so the actor stays thread-agnostic. */
  readonly focus?: () => { x: number; z: number } | null;
  /** Host lifecycle hooks — attach/detach the sim ticker on the JS path. */
  readonly onMount?: () => void;
  readonly onUnmount?: () => void;
  /** Instance caps (tests shrink them; the budgets document the defaults). */
  readonly headCap?: number;
  readonly pedCap?: number;
  readonly headRadius?: number;
  readonly pedRadius?: number;
}

/**
 * Signal heads + ped displays as a scene actor. Reads the packed signal
 * section of the newest snapshot each frame — the same bytes the sims
 * act on — and writes lens instance colors; the head/box matrices are
 * static per placement and only rewrite when the near-field set
 * refreshes after a ~10 m focus move.
 */
export function createSignalActor(options: SignalActorOptions): SceneActorFactory {
  return (threeNamespace: unknown): SceneActor => {
    const THREE = threeNamespace as Three;
    const roster = signalRoster(options.signals);
    const rosterIndex = new Map<string, number>();
    roster.forEach((entry, i) => rosterIndex.set(entry.element, i));
    const heads = signalHeadPlacements(options.topology, options.signals);
    const boxes = pedBoxPlacements(options.topology, options.signals);
    const headCap = options.headCap ?? SIGNAL_HEAD_CAP;
    const pedCap = options.pedCap ?? PED_BOX_CAP;
    const headRadius = options.headRadius ?? SIGNAL_HEAD_RADIUS;
    const pedRadius = options.pedRadius ?? PED_BOX_RADIUS;

    const group = new THREE.Group();
    group.name = 'living-city:signals';

    // --- Shared geometry + materials ---------------------------------------
    const headData = signalHeadGeometryData();
    const boxData = pedBoxGeometryData();
    const makeGeometry = (d: VizGeometryData) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(d.positions, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(d.normals, 3));
      g.setIndex(d.indices);
      return g;
    };
    const headGeometry = makeGeometry(headData);
    const boxGeometry = makeGeometry(boxData);
    const housingMaterial = new THREE.MeshStandardMaterial({ color: '#2a2d30', roughness: 0.7, metalness: 0.35 });
    const boxMaterial = new THREE.MeshStandardMaterial({ color: '#2a2d30', roughness: 0.7, metalness: 0.35 });

    const headMesh = new THREE.InstancedMesh(headGeometry, housingMaterial, Math.max(1, headCap));
    headMesh.name = 'living-city:signal-heads';
    const boxMesh = new THREE.InstancedMesh(boxGeometry, boxMaterial, Math.max(1, pedCap));
    boxMesh.name = 'living-city:ped-boxes';

    // Lens quads: one instanced unit quad for every lens anchor. Lit
    // state lands in instanceColor — additive, radial falloff, no fog
    // (same rules as the world's own additive layers: no fog on
    // additive, depthWrite off).
    const T = THREE.TSL;
    const lensGeometry = new THREE.PlaneGeometry(1, 1);
    const lensMaterial = new THREE.MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    {
      const r = T.uv().sub(0.5).length().mul(2);
      const fall = T.float(1).sub(T.smoothstep(0, 1, r));
      lensMaterial.colorNode = T.vec4(T.float(1), T.float(1), T.float(1), 1);
      lensMaterial.opacityNode = fall.mul(fall).mul(0.9);
    }
    const LENSES_PER_HEAD = headData.lensAnchors.length / 3;
    const LENSES_PER_BOX = boxData.lensAnchors.length / 3;
    const lensMesh = new THREE.InstancedMesh(lensGeometry, lensMaterial, Math.max(1, headCap * LENSES_PER_HEAD + pedCap * LENSES_PER_BOX));
    lensMesh.name = 'living-city:signal-lenses';
    lensMesh.renderOrder = 4;

    for (const mesh of [headMesh, boxMesh, lensMesh]) {
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.needsUpdate = true;
      group.add(mesh);
    }

    // --- Scratch + active-set state ------------------------------------------
    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const color = new THREE.Color();

    const headX = new Float32Array(heads.length);
    const headZ = new Float32Array(heads.length);
    heads.forEach((h, i) => {
      headX[i] = h.x;
      headZ[i] = h.z;
    });
    const boxX = new Float32Array(boxes.length);
    const boxZ = new Float32Array(boxes.length);
    boxes.forEach((b, i) => {
      boxX[i] = b.x;
      boxZ[i] = b.z;
    });
    const headIds = new Int32Array(headCap);
    const boxIds = new Int32Array(pedCap);
    const headScratch = new Float32Array(heads.length);
    const boxScratch = new Float32Array(boxes.length);
    const activeHeads = new Int32Array(headCap);
    const activeBoxes = new Int32Array(pedCap);
    let activeHeadCount = 0;
    let activeBoxCount = 0;

    let lastFocusX = Number.NaN;
    let lastFocusZ = Number.NaN;
    let lastVersion = -1;
    let lastBlink = -1;
    let lensesDirty = true;

    const refreshFocus = (x: number, z: number) => {
      lastFocusX = x;
      lastFocusZ = z;
      // Signal heads.
      activeHeadCount = pickWithin(headX, headZ, x, z, headRadius, headIds, headScratch);
      for (let k = 0; k < activeHeadCount; k++) {
        const h = heads[headIds[k]!]!;
        activeHeads[k] = headIds[k]!;
        quat.setFromAxisAngle(up, h.yaw);
        matrix.compose(pos.set(h.x, 0, h.z), quat, scale.set(1, 1, 1));
        headMesh.setMatrixAt(k, matrix);
        // Lens anchors → world matrices (static per placement).
        for (let l = 0; l < LENSES_PER_HEAD; l++) {
          const a = headData.lensAnchors;
          const lx = a[l * 3]!;
          const ly = a[l * 3 + 1]!;
          const lz = a[l * 3 + 2]!;
          // Local offset rotated by the head yaw.
          const wx = h.x + Math.sin(h.yaw) * lz + Math.cos(h.yaw) * lx;
          const wz = h.z + Math.cos(h.yaw) * lz - Math.sin(h.yaw) * lx;
          matrix.compose(pos.set(wx, ly, wz), quat, scale.set(LENS_RADIUS * 2, LENS_RADIUS * 2, 1));
          lensMesh.setMatrixAt(k * LENSES_PER_HEAD + l, matrix);
        }
      }
      headMesh.count = activeHeadCount;
      headMesh.instanceMatrix.needsUpdate = true;
      // Ped boxes.
      activeBoxCount = pickWithin(boxX, boxZ, x, z, pedRadius, boxIds, boxScratch);
      for (let k = 0; k < activeBoxCount; k++) {
        const b = boxes[boxIds[k]!]!;
        activeBoxes[k] = boxIds[k]!;
        quat.setFromAxisAngle(up, b.yaw);
        matrix.compose(pos.set(b.x, 0, b.z), quat, scale.set(1, 1, 1));
        boxMesh.setMatrixAt(k, matrix);
        for (let l = 0; l < LENSES_PER_BOX; l++) {
          const a = boxData.lensAnchors;
          const lx = a[l * 3]!;
          const ly = a[l * 3 + 1]!;
          const lz = a[l * 3 + 2]!;
          const wx = b.x + Math.sin(b.yaw) * lz + Math.cos(b.yaw) * lx;
          const wz = b.z + Math.cos(b.yaw) * lz - Math.sin(b.yaw) * lx;
          matrix.compose(pos.set(wx, ly, wz), quat, scale.set(LENS_RADIUS * 2.2, LENS_RADIUS * 2.2, 1));
          lensMesh.setMatrixAt(headCap * LENSES_PER_HEAD + k * LENSES_PER_BOX + l, matrix);
        }
      }
      boxMesh.count = activeBoxCount;
      boxMesh.instanceMatrix.needsUpdate = true;
      lensMesh.count = activeHeadCount * LENSES_PER_HEAD + activeBoxCount * LENSES_PER_BOX;
      lensMesh.instanceMatrix.needsUpdate = true;
      lensesDirty = true;
    };

    /** Write lens colors for the active set from the packed aspects — the ONLY state the lamps read. */
    const updateLenses = (snap: readonly number[], simTime: number) => {
      for (let k = 0; k < activeHeadCount; k++) {
        const h = heads[activeHeads[k]!]!;
        const idx = rosterIndex.get(h.element);
        const code = idx === undefined ? -1 : signalAspectAt(snap, idx);
        const keys = vehicleLensKeys(code);
        for (let l = 0; l < LENSES_PER_HEAD; l++) {
          const c = LENS_COLORS[keys[l]!];
          lensMesh.setColorAt(k * LENSES_PER_HEAD + l, color.setRGB(c[0], c[1], c[2]));
        }
      }
      for (let k = 0; k < activeBoxCount; k++) {
        const b = boxes[activeBoxes[k]!]!;
        const idx = rosterIndex.get(b.element);
        const code = idx === undefined ? -1 : signalAspectAt(snap, idx);
        const keys = pedLensKeys(code, simTime);
        for (let l = 0; l < LENSES_PER_BOX; l++) {
          const c = LENS_COLORS[keys[l]!];
          lensMesh.setColorAt(headCap * LENSES_PER_HEAD + k * LENSES_PER_BOX + l, color.setRGB(c[0], c[1], c[2]));
        }
      }
      if (lensMesh.instanceColor) lensMesh.instanceColor.needsUpdate = true;
      lensesDirty = false;
    };

    options.onMount?.();

    return {
      id: 'living-city:signals',
      object: group,
      update: (frame: ActorFrame): boolean => {
        void frame; // state derives from the packed snapshot + env simTime, never wall time
        const snap = options.read();
        const version = snap && snap.length >= VSNAP_HEADER ? (snap[VSNAP.version] ?? 0) : -1;
        const env = readEnvSection(snap, envSectionOffset(snap), snap && snap.length >= VSNAP_HEADER ? (snap[VSNAP.simTime] ?? 0) : 0);
        const blink = fdwBlink(env.simTime) ? 1 : 0;
        const f = options.focus?.() ?? null;
        const moved = f !== null && (!Number.isFinite(lastFocusX) || Math.hypot(f.x - lastFocusX, f.z - lastFocusZ) > TREE_REFRESH_METRES);
        if (moved && f) refreshFocus(f.x, f.z);
        const versionChanged = version !== lastVersion;
        if (versionChanged) lastVersion = version;
        const blinkChanged = blink !== lastBlink;
        if (blinkChanged) lastBlink = blink;
        let anyFlashing = false;
        if (snap && activeBoxCount > 0) {
          for (let k = 0; k < activeBoxCount; k++) {
            const idx = rosterIndex.get(boxes[activeBoxes[k]!]!.element);
            if (idx !== undefined && signalAspectAt(snap, idx) === PED_ASPECT_CODE.F) {
              anyFlashing = true;
              break;
            }
          }
        }
        if (snap && (versionChanged || blinkChanged || lensesDirty)) {
          updateLenses(snap, env.simTime);
        }
        // Keep drawing while the sim publishes (versions move) or a
        // flashing DON'T WALK needs its blink repainted.
        return versionChanged || moved || anyFlashing;
      },
      dispose: () => {
        options.onUnmount?.();
        headGeometry.dispose();
        boxGeometry.dispose();
        lensGeometry.dispose();
        housingMaterial.dispose();
        boxMaterial.dispose();
        lensMaterial.dispose();
        headMesh.dispose();
        boxMesh.dispose();
        lensMesh.dispose();
        group.clear();
      },
    };
  };
}
