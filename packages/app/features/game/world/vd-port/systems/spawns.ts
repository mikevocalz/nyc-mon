// The per-cell mon spawn-zone loader (VGC1 kind 4), the read half of
// tooling/city/vd-port/write-spawns.mjs — a data-driven spawn table per cell: the habitats Valdrada's
// records place there crossed with the encounter atlas's per-bloodline Manhattan tier
// (packages/content/mons/borough-encounters.ts). A ring reads the zones for the cells it streams and rolls
// against the per-mille weights.
//
// Pure decoder: no three.js, no platform IO.
import { PACK_KIND, openPack, packString, type PositionFrame } from './cell-pack.ts';

/** The atlas's habitat vocabulary (borough-encounters.ts), bit-coded on the wire. */
export type SpawnHabitat = 'street' | 'transit_set' | 'courtyard' | 'plaza' | 'rooftop' | 'community_hub';
export const SPAWN_HABITAT: readonly SpawnHabitat[] = ['street', 'transit_set', 'courtyard', 'plaza', 'rooftop', 'community_hub'];
export type EncounterTier = 'C' | 'U' | 'R' | 'Q' | 'P';
const TIER: readonly EncounterTier[] = ['C', 'U', 'R', 'Q', 'P'];

export interface SpawnEntry {
  /** Bloodline id from the encounter atlas ('F01'...). */
  readonly bloodlineId: string;
  readonly tier: EncounterTier;
  /** How many of the cell's habitats this bloodline lists. */
  readonly matches: number;
  readonly habitats: readonly SpawnHabitat[];
  /** Share of the cell's spawn rolls, per mille (the table's weights sum to ~1000). */
  readonly weightPermille: number;
}

/** A concrete place the habitat touches in the cell — where a spawn of that habitat may anchor. */
export interface SpawnAnchor {
  readonly habitat: SpawnHabitat;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface SpawnCellPackage {
  readonly cx: number;
  readonly cz: number;
  readonly key: string;
  readonly positionFrame: PositionFrame;
  readonly habitats: readonly SpawnHabitat[];
  readonly entries: readonly SpawnEntry[];
  readonly anchors: readonly SpawnAnchor[];
}

/** Decodes one `spawns/<cx>_<cz>` pack. Throws on a foreign or torn pack. */
export function decodeSpawnCell(bytes: Uint8Array): SpawnCellPackage {
  const { head, r } = openPack(bytes, PACK_KIND.spawns);
  const { x: ox, z: oz } = head.positionFrame;
  const hab = (mask: number): SpawnHabitat[] =>
    SPAWN_HABITAT.filter((_, i) => (mask & (1 << i)) !== 0);

  const habitatsMask = r.u16();
  const habitats = hab(habitatsMask);

  const nEntries = r.u32();
  const entries: SpawnEntry[] = [];
  for (let i = 0; i < nEntries; i++) {
    const bloodlineId = packString(head, r.u16()) ?? '';
    const tier = TIER[r.u8()] ?? 'C';
    const matches = r.u8();
    const mask = r.u8();
    r.u8();
    const weightPermille = r.u16();
    entries.push({ bloodlineId, tier, matches, habitats: hab(mask), weightPermille });
  }

  const nAnchors = r.u32();
  const anchors: SpawnAnchor[] = [];
  for (let i = 0; i < nAnchors; i++) {
    const h = r.u8();
    r.u8();
    const x = r.f32() + ox;
    const y = r.f32();
    const z = r.f32() + oz;
    anchors.push({ habitat: SPAWN_HABITAT[h] ?? 'street', x, y, z });
  }
  if (!r.done) throw new Error('spawns pack: trailing bytes');

  return { cx: head.cx, cz: head.cz, key: head.key, positionFrame: head.positionFrame, habitats, entries, anchors };
}
