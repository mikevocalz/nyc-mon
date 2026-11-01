'use client';
import { CITY_DATASET_MIGRATIONS } from '../city-dataset.ts';
import { useLayoutEffect } from 'react';
import { useStore } from 'zustand';
import { resolveResume, type ResumeCandidate, type ResumeResult } from '@acme/core';
import { bundledCity } from '../city-data.ts';
import { worldSaveStore } from '../world-resume/world-save.store.ts';
import { datasetOriginOf } from '../world-resume/world-snapshot.ts';
import { readLobbyIdentity } from './lobby-identity.ts';
import { lobbyStore } from './lobby.store.ts';

// P1 of the lobby (08-handoff.md § Route and intent): decide from local
// state whether an eligible save exists, before any network call and before
// the first paint. `worldSaveStore` read MMKV synchronously at module load;
// `resolveResume` is pure; the layout effect writes the result before the
// frame is committed. Re-runs when the stored snapshot changes (a save
// committed by gameplay, or the explicit "start new" clear).
//
// Decision: DEFER remote candidates (no `/v1` world-save endpoint exists;
// lane E's `ResumeCandidateSource` has the `remote` slot ready) and offline
// detection (no network module in the app; `toResumeSummary`'s `offline`
// flag stays false until one lands).

/** Pure: what START would do for the current local snapshot. */
export function resolveLobbyResume(now: number = Date.now()): ResumeResult | null {
  const city = bundledCity();
  const identity = readLobbyIdentity();
  if (!city.ok || identity === null) return null;
  const { snapshot } = worldSaveStore.getState();
  const candidates: ResumeCandidate[] = [];
  switch (snapshot.status) {
    case 'loaded':
      candidates.push({ source: 'local', blob: snapshot.save });
      break;
    case 'unreadable':
      // Hand the raw bytes over so the rejection names the real reason (corrupt / invalid), never a quiet new game.
      candidates.push({ source: 'local', blob: parseLoosely(snapshot.raw) });
      break;
    case 'missing':
      break;
  }
  return resolveResume({
    candidates,
    now,
    ownerId: identity.playerId,
    dataset: { datasetId: city.dataset.id, datasetVersion: city.dataset.version, originRef: datasetOriginOf(city.dataset) },
    // v1 -> v2 kept the origin, so old saves migrate in place (city-dataset.ts).
    datasetMigrations: CITY_DATASET_MIGRATIONS,
  });
}

function parseLoosely(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

/** Resolves on mount and whenever the world save changes; the lobby reads `lobbyStore.resume`. */
export function useLobbyResume(): ResumeResult | null {
  const snapshot = useStore(worldSaveStore, (s) => s.snapshot);
  useLayoutEffect(() => {
    const now = Date.now();
    const result = resolveLobbyResume(now);
    if (result !== null) lobbyStore.getState().setResume(result, now);
  }, [snapshot]);
  return useStore(lobbyStore, (s) => s.resume);
}
