// The per-cell street-name label loader (VGC1 kind 5), the read half of
// tooling/city/vd-port/write-labels.mjs — the compiled tiles' own name table (OSM-derived CSCL street
// names, no invented text), one anchor per named piece per cell it crosses.
//
// Pure decoder: no three.js, no platform IO.
import { PACK_KIND, openPack, packString, type PositionFrame } from './cell-pack.ts';

/** One place a street name can be drawn in this cell. */
export interface StreetLabel {
  /** The CSCL name verbatim (e.g. 'W 125 ST', 'ADAM CLAYTON POWELL JR BLVD'). */
  readonly name: string;
  /** CSCL physicalid of the piece it sits on. */
  readonly segId: number;
  readonly rclass: number;
  /** The polyline's in-cell point nearest the cell centre, absolute scene metres; y is the road grade. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Local heading of the piece at the anchor, radians (atan2(dz, dx), scene frame). */
  readonly angle: number;
  /** The piece's full length, metres — how much street the label speaks for. */
  readonly lengthMeters: number;
}

export interface LabelCellPackage {
  readonly cx: number;
  readonly cz: number;
  readonly key: string;
  readonly positionFrame: PositionFrame;
  readonly labels: readonly StreetLabel[];
}

/** Decodes one `labels/<cx>_<cz>` pack. Throws on a foreign or torn pack. */
export function decodeLabelCell(bytes: Uint8Array): LabelCellPackage {
  const { head, r } = openPack(bytes, PACK_KIND.labels);
  const { x: ox, z: oz } = head.positionFrame;

  const nLabels = r.u32();
  const labels: StreetLabel[] = [];
  for (let i = 0; i < nLabels; i++) {
    const name = packString(head, r.u16()) ?? '';
    const segId = r.u32();
    const rclass = r.u8();
    r.u8();
    const x = r.f32() + ox;
    const z = r.f32() + oz;
    const y = r.f32();
    const angle = r.f32();
    const lengthMeters = r.f32();
    labels.push({ name, segId, rclass, x, y, z, angle, lengthMeters });
  }
  if (!r.done) throw new Error('labels pack: trailing bytes');

  return { cx: head.cx, cz: head.cz, key: head.key, positionFrame: head.positionFrame, labels };
}
