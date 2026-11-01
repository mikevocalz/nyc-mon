// The walk's street-name supply: the baked `labels/<cx>_<cz>` system packs (vd-port/systems/labels.ts, the
// read half of write-labels.mjs — OSM-derived CSCL street names, no invented text), fetched per streamer cell
// and decoded once each. Packs exist for the home tile's cells only, so outside them a lookup simply finds
// nothing; the cell grid is the world's own (cell-rules.ts CELL = 128 m, scene frame).
//
// The byte source is injected: the stage hands a loader over the bundled-asset path (fetchAssetBytes), tests
// hand bytes straight in. A missing or torn pack caches as an empty cell — asked once, never retried in a loop.
import { cellKey, CELL } from '../world/cells/cell-rules.ts';
import { decodeLabelCell, type StreetLabel } from '../world/vd-port/systems/labels.ts';

export type StreetLabelLoader = (cellKey: string) => Promise<Uint8Array | ArrayBuffer | null>;

export interface StreetLabelSource {
  /** The streamer cell of a scene point. */
  cellOf(x: number, z: number): [number, number];
  /** Starts (or joins) the fetch of a cell's labels; resolves with what it decoded (empty for a missing pack). */
  ensure(cx: number, cz: number): Promise<readonly StreetLabel[]>;
  /** Every label decoded so far, across all fetched cells. */
  labels(): readonly StreetLabel[];
  /** The nearest decoded label to a ground point, or null while nothing near it has loaded. */
  nearest(x: number, z: number): { label: StreetLabel; meters: number } | null;
}

export function createStreetLabelSource(load: StreetLabelLoader): StreetLabelSource {
  const cells = new Map<string, readonly StreetLabel[]>();
  const pending = new Map<string, Promise<readonly StreetLabel[]>>();
  const all: StreetLabel[] = [];

  return {
    cellOf: (x, z) => [Math.floor(x / CELL), Math.floor(z / CELL)],
    ensure(cx, cz) {
      const key = cellKey(cx, cz);
      const held = cells.get(key);
      if (held) return Promise.resolve(held);
      const inFlight = pending.get(key);
      if (inFlight) return inFlight;
      const promise = load(key)
        .then((bytes) => {
          let labels: readonly StreetLabel[] = [];
          if (bytes && bytes.byteLength > 0) {
            try {
              labels = decodeLabelCell(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).labels;
            } catch {
              labels = [];
            }
          }
          cells.set(key, labels);
          for (const l of labels) all.push(l);
          return labels;
        })
        .catch(() => {
          cells.set(key, []);
          return [] as readonly StreetLabel[];
        })
        .finally(() => {
          pending.delete(key);
        });
      pending.set(key, promise);
      return promise;
    },
    labels: () => all,
    nearest(x, z) {
      let best: StreetLabel | null = null;
      let bestD = Infinity;
      for (const label of all) {
        const meters = Math.hypot(label.x - x, label.z - z);
        if (meters < bestD) {
          best = label;
          bestD = meters;
        }
      }
      return best ? { label: best, meters: bestD } : null;
    },
  };
}
