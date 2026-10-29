// The storefront plan tooling/city/bake-vd-storefronts.mjs writes (plan.generated.ts). Scene metres; colours are
// display-space RGB floats (sRGB), decoded to linear by the materials on the physical stack.
export type Rgb = readonly [number, number, number] | number[];

/** A face frame (Valdrada fk/kitGeom.js Frame): p0 the left end seen from the street, u along it, n outward. */
export interface FrontFrame {
  p0: readonly number[];
  u: readonly number[];
  n: readonly number[];
  len: number;
  /** Scene metres per Valdrada metre along the face (the transform's scale; u values below are Valdrada metres). */
  k: number;
  /** The same frame in Valdrada world metres (p0 and the unit direction along the face), for the placement tests. */
  vp0: readonly number[];
  vu: readonly number[];
}

/** facadeKit.js storeBay: a storefront system in the opening [u0, u1] x [0, h]. */
export interface StoreBay {
  t: 's';
  u0: number; u1: number; h: number;
  setback: number;
  glazing: { bulkhead: number; transom: number; mullions: number; frameW: number; frame: Rgb | null; kick: Rgb | null; frosted: boolean };
  door: { u: number; w: number; double: boolean; solid: boolean; recess: number } | null;
  tone: Rgb; lit: number; empty: boolean;
  /** The roll-down gate: `down` is the share Valdrada measured it down by day. */
  gate: { down: number; color: Rgb | null } | null;
}

/** facadeKit.js entranceBay. */
export interface EntranceBay {
  t: 'e';
  u0: number; u1: number; h: number;
  door: { kind: string; w: number; recess: number; h: number; transom: number; du: number; frame: Rgb | null; leaf: Rgb | null };
}

export interface SignPlan {
  text: string;
  u0: number; u1: number; y: number; h: number; z: number;
  kind: string; lit: number;
  fg: Rgb | null; bg: Rgb | null;
  /** Cell in the fascia atlas. */
  slot: number;
}

export interface AwningPlan {
  a: number; c: number; top: number; low: number; proj: number; drop: number;
  kind: string; color: Rgb | null;
  /** Valance lettering cell, or -1. */
  slot: number; fg: Rgb | null;
}

export interface NamedShop {
  key: string; from: number; to: number;
  bays: string[];
  frame: Rgb | null; fasciaBg: Rgb | null; slot: number;
  /** The shop's interior wall colour (namedShops.js interiorArt). */
  tone: Rgb | null;
}

export interface Front extends FrontFrame {
  /** 0 a spec'd face (fk/specs), 1 a namedShops.js front, 2 nycDress storefront units. */
  src: 0 | 1 | 2;
  /** The ring district the front belongs to (bake-vd-storefronts.mjs --ring ringN): drawn whether or not the
   * tile's playable square covers it. */
  ring?: 1 | 2 | 3 | 4 | 5 | 6;
  id: string;
  addr: string;
  bays: (StoreBay | EntranceBay)[];
  signs: SignPlan[];
  awnings: AwningPlan[];
  system?: { color: Rgb; height: number; head: number; fascia: number[]; bulk: number; cornice: Rgb };
  shops?: NamedShop[];
  /**
   * kit.js K.storefront units (nycDress.js FAC8 draw): centre u and width (Valdrada metres), the gate (0 none, 1 over
   * the entry on `side`, 2 the whole glazing), the kit sign's atlas cell and colours, the awning's colour or null.
   */
  units?: { u: number; w: number; gate: 0 | 1 | 2; side: 1 | -1; slot: number; fg: Rgb | null; bg: Rgb | null; awning: Rgb | null }[];
}

export interface StorefrontPlan {
  fronts: Front[];
  atlas: { width: number; height: number; cellW: number; cellH: number; cols: number; count: number };
  /** The text in each atlas cell. */
  slots: string[];
}
