const MAGIC = 0x43544c31;

type CtlCtor = Float32ArrayConstructor | Uint8ArrayConstructor | Uint32ArrayConstructor | Int16ArrayConstructor | Uint16ArrayConstructor;
const CTORS: Record<string, CtlCtor> = { Float32Array, Uint8Array, Uint32Array, Int16Array, Uint16Array };

export interface CtlSection {
  readonly name: string;
  readonly type: string;
  readonly offset: number;
  readonly bytes: number;
  readonly length: number;
}

export interface CtlHeader {
  readonly v: number;
  readonly level?: number;
  readonly ci?: number;
  readonly cj?: number;
  readonly origin: readonly number[];
  readonly scale?: number;
  readonly err?: number;
  readonly regions?: number;
  readonly towers?: number;
  readonly count?: number;
  readonly bkeys?: readonly string[];
  readonly sections: readonly CtlSection[];
}

export interface CtlTile {
  readonly header: CtlHeader;
  readonly S: Readonly<Record<string, Float32Array | Uint8Array | Uint32Array | Int16Array | Uint16Array>>;
}

export function parseCtl1(buf: ArrayBuffer | Uint8Array): CtlTile {
  const ab = buf instanceof Uint8Array ? (buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer) : buf;
  const dv = new DataView(ab);
  if (dv.getUint32(0, true) !== MAGIC) throw new Error('bad tile magic');
  const hLen = dv.getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(ab, 8, hLen))) as CtlHeader;
  const base = 8 + hLen + ((4 - ((8 + hLen) % 4)) % 4);
  const S: Record<string, Float32Array | Uint8Array | Uint32Array | Int16Array | Uint16Array> = {};
  for (const s of header.sections) {
    const C = CTORS[s.type];
    if (!C) throw new Error(`unknown section type ${s.type}`);
    S[s.name] = new C(ab, base + s.offset, s.length);
  }
  return { header, S };
}
