// Valdrada client/src/sim/signals.js, the shared phase clock every traffic and pedestrian signal runs on (40 s: N-S green
// 0-15, amber 15-18, all-red 18-20, E-W green 20-35, amber 35-38, all-red 38-40), on the CPU for the pk lamps and in TSL
// for the pooled signal heads.
import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';

export type SignalState = 'G' | 'A' | 'R';

/** signals.js L3-L13. */
export function signalState(t: number, servesEW: boolean): SignalState {
  const c = ((t % 40) + 40) % 40;
  if (!servesEW) return c < 15 ? 'G' : c < 18 ? 'A' : 'R';
  if (c >= 20 && c < 35) return 'G';
  if (c >= 35 && c < 38) return 'A';
  return 'R';
}

/** signals.js L16-L20: seconds of green (WALK) left for the axis, 0 when it is not green. */
export function walkTimeLeft(t: number, servesEW: boolean): number {
  const c = ((t % 40) + 40) % 40;
  if (!servesEW) return c < 15 ? 15 - c : 0;
  return c >= 20 && c < 35 ? 35 - c : 0;
}

/** Lamp codes of the pooled heads (bake-furniture.mjs): 1-3 vehicle R/A/G, 4 hand, 5 man; +8 serves E-W. */
export const LAMP = { none: 0, red: 1, amber: 2, green: 3, hand: 4, man: 5, eastWest: 8 } as const;

/**
 * SignalController.update (signals.js L21-L68) for one lamp: 1 when lit, 0.001 when off (the scale it collapses an
 * unlit lens to). A vehicle lens is lit when the axis it serves is in its colour; a pedestrian walks when the axis it
 * serves is green, and shows the hand otherwise.
 */
export function lampScale(code: number, t: number): number {
  const lamp = code & 7;
  if (lamp === 0) return 1;
  const st = signalState(t, (code & 8) !== 0);
  const on = lamp <= 3 ? st === (['R', 'A', 'G'] as const)[lamp - 1] : (st === 'G') === (lamp === 5);
  return on ? 1 : 0.001;
}

/** lampScale in TSL, for the instance's code and the clock uniform `t`. */
export function lampScaleNode(THREE: Three, code: Node<'float'>, t: Node<'float'>): Node<'float'> {
  const T = THREE.TSL;
  return T.Fn(() => {
    const lamp = T.mod(code, 8);
    const ew = T.step(7.5, code);
    const c = T.mod(T.mod(t, 40).add(40), 40);
    // 0 R, 1 A, 2 G for the instance's axis
    const ns = T.select(c.lessThan(15), T.float(2), T.select(c.lessThan(18), T.float(1), T.float(0)));
    const ewSt = T.select(c.greaterThanEqual(20).and(c.lessThan(35)), T.float(2), T.select(c.greaterThanEqual(35).and(c.lessThan(38)), T.float(1), T.float(0)));
    const st = T.mix(ns, ewSt, ew);
    const vehicleOn = T.float(1).sub(T.step(0.5, T.abs(st.sub(lamp.sub(1)))));
    const green = T.step(1.5, st);
    const pedOn = T.select(lamp.greaterThan(4.5), green, T.float(1).sub(green));
    const on = T.select(lamp.lessThan(0.5), T.float(1), T.select(lamp.lessThan(3.5), vehicleOn, pedOn));
    return T.mix(T.float(0.001), T.float(1), on);
  })() as unknown as Node<'float'>;
}
