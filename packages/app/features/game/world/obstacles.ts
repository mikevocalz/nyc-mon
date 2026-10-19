// What the Caller bumps into on the street: poles, tree trunks, hydrants,
// baskets, kiosks and parked cars. Built from the same placement functions
// the renderer draws them with (street-furniture.ts, street-props.ts,
// foliage.ts), so a blocked spot is always where something stands. Pure:
// no three import.
import type { CityDatasetV3 } from '../city-dataset.ts';
import { treePlacements } from './foliage.ts';
import { placeStreetFurniture } from './street-furniture.ts';
import { placeStreetProps } from './street-props.ts';
import { CAR_LENGTH, CAR_WIDTH } from './street-props-layout.ts';
import type { StreetClearance } from './walkability.ts';

/** Clearance kept around a round obstacle for the Caller's body, metres. */
export const BODY_RADIUS = 0.3;
const CELL = 8;

interface Circle { kind: 'c'; x: number; z: number; r: number }
/** An oriented box: centre, unit long axis, half length and half width. */
interface Box { kind: 'b'; x: number; z: number; dx: number; dz: number; hl: number; hw: number }
type Obstacle = Circle | Box;

export interface ObstacleIndex {
  /** True when (x, z) is inside an obstacle grown by the Caller's body radius. */
  blocked(x: number, z: number): boolean;
  readonly count: number;
}

export function buildObstacles(dataset: CityDatasetV3, clearance: StreetClearance): ObstacleIndex {
  const grid = new Map<number, Obstacle[]>();
  const key = (cx: number, cz: number) => ((cx + 4096) << 13) | (cz + 4096);
  let count = 0;
  const add = (o: Obstacle, reach: number) => {
    count++;
    const x0 = Math.floor((o.x - reach) / CELL); const x1 = Math.floor((o.x + reach) / CELL);
    const z0 = Math.floor((o.z - reach) / CELL); const z1 = Math.floor((o.z + reach) / CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
      const k = key(cx, cz);
      const list = grid.get(k);
      if (list) list.push(o); else grid.set(k, [o]);
    }
  };
  const circle = (x: number, z: number, r: number) => add({ kind: 'c', x, z, r: r + BODY_RADIUS }, r + BODY_RADIUS);

  const { signs, lights } = placeStreetFurniture(dataset, clearance);
  for (const s of signs) circle(s.x, s.z, 0.08);
  for (const l of lights) circle(l.x, l.z, 0.12);
  for (const t of treePlacements(dataset, clearance).trees) circle(t.x, t.z, 0.25 * t.scale);
  const props = placeStreetProps(dataset, clearance, signs, lights);
  for (const h of props.hydrants) circle(h.x, h.z, 0.22);
  for (const b of props.baskets) circle(b.x, b.z, 0.3);
  for (const k of props.linknyc) circle(k.x, k.z, 0.45);
  for (const c of props.cars) {
    const hl = CAR_LENGTH / 2 + BODY_RADIUS; const hw = CAR_WIDTH / 2 + BODY_RADIUS;
    add({ kind: 'b', x: c.x, z: c.z, dx: c.dir[0], dz: c.dir[1], hl, hw }, hl);
  }

  return {
    count,
    blocked(x, z) {
      const list = grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
      if (!list) return false;
      for (const o of list) {
        const ox = x - o.x; const oz = z - o.z;
        if (o.kind === 'c') {
          if (ox * ox + oz * oz < o.r * o.r) return true;
        } else if (Math.abs(ox * o.dx + oz * o.dz) < o.hl && Math.abs(-ox * o.dz + oz * o.dx) < o.hw) {
          return true;
        }
      }
      return false;
    },
  };
}
