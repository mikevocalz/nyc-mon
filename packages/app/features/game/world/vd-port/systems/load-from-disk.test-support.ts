// Test support: reads the emitted game-system cell packs from the files the Phase 4 emitters wrote
// (tooling/city/vd-port/write-*.mjs run first), the same convention as vd-port/blocks'
// load-from-disk.test-support.ts. Returns every cell's bytes keyed by its file name (`<cx>_<cz>`).
import { readdirSync, readFileSync } from 'node:fs';

const DIR = new URL('./data/', import.meta.url);
export const SYSTEM_KINDS = ['colliders', 'pednet', 'traffic', 'spawns', 'labels'] as const;
export type SystemKind = (typeof SYSTEM_KINDS)[number];

/** Every emitted pack of `kind`, file name -> bytes. Empty when the kind's dir is absent. */
export function readSystemCells(kind: SystemKind): Map<string, Uint8Array> {
  const dir = new URL(`./${kind}/`, DIR);
  let names: string[] = [];
  try {
    names = readdirSync(dir).filter((n) => n.endsWith('.bin'));
  } catch {
    return new Map();
  }
  const out = new Map<string, Uint8Array>();
  for (const n of names) out.set(n.slice(0, -4), new Uint8Array(readFileSync(new URL(`./${kind}/${n}`, DIR))));
  return out;
}
