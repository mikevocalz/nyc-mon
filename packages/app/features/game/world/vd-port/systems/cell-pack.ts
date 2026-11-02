// The read half of the VGC1 cell envelope the Phase 4 game-system emitters write
// (tooling/city/vd-port/vd-game-cells.mjs). One binary layout for every system pack:
//
//   0  'VGC1' | u8 version | u8 kind | i16 cx | i16 cz | u16 reserved | f64 ox | f64 oz | u16 nStrings
// 30+  nStrings × (u16 byteLen + utf8), then the kind's payload
//
// Positions are cell-local float32 around the cell centre; a package's `positionFrame` is the absolute
// cell centre (the CellPackage.positionFrame convention: absolute = frame + local). Y values are absolute —
// Valdrada's height datum, passed through unmodified like decode.mjs does.
//
// Pure decoder: no three.js, no platform IO, so `node --test` covers it and any runtime can consume it.

export const PACK_MAGIC = 'VGC1';
export const PACK_VERSION = 1;

/** Kind bytes the emitters stamp (vd-game-cells.mjs PACK_KINDS). */
export const PACK_KIND = {
  colliders: 1,
  pednet: 2,
  traffic: 3,
  spawns: 4,
  labels: 5,
} as const;
export type PackKind = keyof typeof PACK_KIND;
export const PACK_KIND_NAME: Readonly<Record<number, PackKind>> = Object.fromEntries(
  Object.entries(PACK_KIND).map(([k, v]) => [v, k as PackKind]),
);

/** Cell edge, metres — world/cells/cell-rules.ts CELL. */
export const CELL = 128;

export interface PositionFrame {
  /** Absolute scene metres of the cell centre; local coordinates add to this. */
  readonly x: number;
  readonly z: number;
}

export interface CellPackHead {
  readonly kind: number;
  readonly kindName: PackKind | undefined;
  readonly cx: number;
  readonly cz: number;
  /** The cell key `${cx}_${cz}` — the manifest's key minus its `<kind>/` prefix. */
  readonly key: string;
  readonly positionFrame: PositionFrame;
  readonly strings: readonly string[];
}

export class PackReader {
  private readonly dv: DataView;
  private readonly bytes: Uint8Array;
  pos: number;

  constructor(bytes: Uint8Array, pos = 0) {
    this.bytes = bytes;
    this.dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.pos = pos;
  }
  u8(): number { const v = this.dv.getUint8(this.pos); this.pos += 1; return v; }
  i8(): number { const v = this.dv.getInt8(this.pos); this.pos += 1; return v; }
  u16(): number { const v = this.dv.getUint16(this.pos, true); this.pos += 2; return v; }
  i16(): number { const v = this.dv.getInt16(this.pos, true); this.pos += 2; return v; }
  u32(): number { const v = this.dv.getUint32(this.pos, true); this.pos += 4; return v; }
  f32(): number { const v = this.dv.getFloat32(this.pos, true); this.pos += 4; return v; }
  f64(): number { const v = this.dv.getFloat64(this.pos, true); this.pos += 8; return v; }
  get done(): boolean { return this.pos >= this.bytes.byteLength; }
}

/**
 * Reads the envelope and returns the head plus a reader parked at the payload.
 * Rejects truncated input, bad magic, a version or kind it does not know — a corrupt or
 * foreign cell must never decode halfway (cell-source.ts already pins sha256 + length upstream).
 */
export function openPack(bytes: Uint8Array, expectedKind?: number): { head: CellPackHead; r: PackReader } {
  if (bytes.byteLength < 30) throw new Error('cell pack: shorter than the envelope');
  const r = new PackReader(bytes);
  const magic = String.fromCharCode(r.u8(), r.u8(), r.u8(), r.u8());
  if (magic !== PACK_MAGIC) throw new Error(`cell pack: bad magic ${JSON.stringify(magic)}`);
  const version = r.u8();
  if (version !== PACK_VERSION) throw new Error(`cell pack: version ${version}, expected ${PACK_VERSION}`);
  const kind = r.u8();
  if (expectedKind !== undefined && kind !== expectedKind) {
    throw new Error(`cell pack: kind ${kind}, expected ${expectedKind}`);
  }
  const cx = r.i16();
  const cz = r.i16();
  r.u16(); // reserved
  const ox = r.f64();
  const oz = r.f64();
  const nStrings = r.u16();
  const strings: string[] = [];
  const dec = new TextDecoder();
  for (let i = 0; i < nStrings; i++) {
    const len = r.u16();
    if (r.pos + len > bytes.byteLength) throw new Error('cell pack: string runs past the end');
    strings.push(dec.decode(bytes.subarray(r.pos, r.pos + len)));
    r.pos += len;
  }
  const head: CellPackHead = {
    kind,
    kindName: PACK_KIND_NAME[kind],
    cx,
    cz,
    key: `${cx}_${cz}`,
    positionFrame: { x: ox, z: oz },
    strings,
  };
  return { head, r };
}

/** String-table read: 0xffff is the writer's absent marker; any other index past the table is a torn pack. */
export function packString(head: CellPackHead, idx: number): string | undefined {
  if (idx === 0xffff) return undefined;
  const s = head.strings[idx];
  if (s === undefined) throw new RangeError(`cell pack ${head.key}: string index ${idx} past a ${head.strings.length}-entry table`);
  return s;
}
