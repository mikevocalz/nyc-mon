/**
 * A Mon form's still picture, in one order everywhere in the app:
 *
 *   1. the approved still uploaded in the console (Payload `mon-art`),
 *   2. the bundled still in `@acme/assets/creatures`,
 *   3. none, and the screen draws Coming Soon.
 *
 * The console stills load once per TTL from the public REST read (approved
 * docs only) into a Zustand store. Any failure keeps the last good list, or
 * none, so the bundled stills show. This file never imports the bundled art
 * (WebP imports do not load under `node --test`); callers pass it in.
 */
import { createStore } from 'zustand/vanilla';
import type { CreatureArt } from '@acme/assets/creatures';
import { monArtUrl, parseMonArt, type AdminStill } from './mon-art-docs.ts';

export { monArtUrl, parseMonArt, type AdminStill } from './mon-art-docs.ts';

export type AdminStillMap = ReadonlyMap<string, AdminStill>;

/** Which bundled still stands for a form: its Baby still, its egg still, or any still but the hatch scene. */
export type StillKind = 'baby' | 'egg' | 'any';

/** How long a loaded list is trusted before the next mount reloads it. */
export const ADMIN_STILLS_TTL_MS = 5 * 60 * 1000;

const EMPTY: AdminStillMap = new Map();

/** A console still in the bundled art's shape. No blur preview ships with it, so `blurDataURL` is empty. */
export function adminStillArt(still: AdminStill, kind: 'baby' | 'egg' | 'small', dexId: number | null): CreatureArt {
  return {
    id: `mon-art:${still.speciesId}`,
    kind,
    ...(dexId === null ? {} : { dexId }),
    source: still.url,
    alt: still.alt,
    width: still.width,
    height: still.height,
    blurDataURL: '',
    generatedWith: { tool: 'console upload', model: 'mon-art', date: '' },
  };
}

function bundledStill(kind: StillKind, dexId: number | null, bundled: readonly CreatureArt[]): CreatureArt | undefined {
  if (dexId === null) return undefined;
  return bundled.find((a) => a.dexId === dexId && (kind === 'any' ? a.kind !== 'scene' : a.kind === kind));
}

/** The still for a form: the approved console still, else the bundled one, else undefined (Coming Soon). Pure. */
export function stillFor(
  kind: StillKind,
  dexId: number | null,
  speciesId: string | null | undefined,
  stills: AdminStillMap,
  bundled: readonly CreatureArt[],
): CreatureArt | undefined {
  const local = bundledStill(kind, dexId, bundled);
  const admin = speciesId ? stills.get(speciesId) : undefined;
  if (admin === undefined) return local;
  const artKind = kind !== 'any' ? kind : local?.kind === 'egg' || local?.kind === 'small' ? local.kind : 'baby';
  return adminStillArt(admin, artKind, dexId);
}

/** The `<Image placeholder>` a still can honour: blur only when it carries a blur preview. */
export function stillPlaceholder(art: Pick<CreatureArt, 'blurDataURL'>): 'blur' | 'empty' {
  return art.blurDataURL ? 'blur' : 'empty';
}

interface AdminStillsState {
  readonly stills: AdminStillMap;
  /** When the last load finished (success or failure), ms since epoch; null before the first. */
  readonly loadedAt: number | null;
  readonly loading: boolean;
}

export const adminStillsStore = createStore<AdminStillsState>(() => ({ stills: EMPTY, loadedAt: null, loading: false }));

/** The stills loaded so far, for pure callers outside React. */
export function currentAdminStills(): AdminStillMap {
  return adminStillsStore.getState().stills;
}

let inflight: Promise<void> | null = null;

/**
 * Load the approved stills unless a load is running or the last one is
 * younger than the TTL. Never throws: a failed read keeps what the store has.
 */
export function loadAdminStills(
  origin: string,
  { fetchImpl = globalThis.fetch, now = Date.now, ttlMs = ADMIN_STILLS_TTL_MS }: { fetchImpl?: typeof fetch; now?: () => number; ttlMs?: number } = {},
): Promise<void> {
  if (inflight !== null) return inflight;
  const { loadedAt } = adminStillsStore.getState();
  if (loadedAt !== null && now() - loadedAt < ttlMs) return Promise.resolve();
  if (typeof fetchImpl !== 'function' || !origin) return Promise.resolve();
  adminStillsStore.setState({ loading: true });
  inflight = (async () => {
    let next: AdminStillMap | undefined;
    try {
      const response = await fetchImpl(monArtUrl(origin), { headers: { accept: 'application/json' } });
      if (response.ok) next = new Map(parseMonArt(await response.json()).map((s) => [s.speciesId, s]));
    } catch {
      // Offline or a bad body: the bundled stills stand in.
    }
    adminStillsStore.setState((s) => ({ stills: next ?? s.stills, loadedAt: now(), loading: false }));
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** Test seam: back to the empty, never-loaded store. */
export function resetAdminStills(): void {
  inflight = null;
  adminStillsStore.setState({ stills: EMPTY, loadedAt: null, loading: false }, true);
}
