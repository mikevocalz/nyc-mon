import { createStore } from 'zustand/vanilla';
import { ListMyMonsResponseSchema } from '@acme/core/schemas';
import type { CallerProfile, SaveCurrent } from '@acme/core/types';
import type { KeyValueStorage } from '../onboarding/storage.types.ts';

export const CARE_OWNER_KEY = 'mon-care-save-owner-v1';
export const CARE_FRESH_SAVE_KEY = 'mon-care-fresh-save-v1';
/** Invalidation only. Authentication/native handles never enter this store. */
export const careOwnershipChanges = createStore(() => ({ revision: 0 }));
const changed = () => careOwnershipChanges.setState((state) => ({ revision: state.revision + 1 }));
export const careSaveIdentity = (save: SaveCurrent | undefined): string => JSON.stringify([save?.queue.deviceId, save?.caller?.callerId, save?.mons.map((mon) => mon.monInstanceId).sort()]);

function record(storage: KeyValueStorage, key: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(storage.getString(key) ?? 'null');
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch { return null; }
}

export function careConsentAllowed(save: SaveCurrent | undefined): boolean {
  return save?.caller?.consentStatus === 'approved' || save?.caller?.consentStatus === 'not-required';
}

function empty(save: SaveCurrent): boolean {
  return save.caller === null && save.mons.length === 0 && save.care.length === 0 && save.eggs.length === 0 && save.hatches.length === 0;
}

/** Only the actual creation path calls this. Existing saves are never claimed
 * by signing in, including pre-feature saves with no ownership record.
 */
export function recordFreshCareSave(storage: KeyValueStorage, save: SaveCurrent): void {
  if (!empty(save)) return;
  clearCareSaveOwner(storage);
  storage.set(CARE_FRESH_SAVE_KEY, JSON.stringify({ deviceId: save.queue.deviceId, at: save.savedAt }));
}

/** M07 creates a Caller in a newly-created empty save while authenticated.
 * This is the local-first ownership boundary for eggs/Mons not synced yet.
 */
export function bindFreshCareCaller(storage: KeyValueStorage, before: SaveCurrent, caller: CallerProfile, authUserId: string): void {
  const fresh = record(storage, CARE_FRESH_SAVE_KEY);
  if (!authUserId || !empty(before) || fresh?.deviceId !== before.queue.deviceId || fresh.at !== before.savedAt) return;
  storage.set(CARE_OWNER_KEY, JSON.stringify({ source: 'fresh', authUserId, deviceId: before.queue.deviceId, callerId: caller.callerId }));
  storage.remove(CARE_FRESH_SAVE_KEY);
  changed();
}

function ownershipMatches(storage: KeyValueStorage, save: SaveCurrent | undefined, authUserId: string | null): boolean {
  if (!authUserId || !save?.caller) return false;
  const owner = record(storage, CARE_OWNER_KEY);
  if (owner?.authUserId !== authUserId || owner.deviceId !== save?.queue.deviceId || owner.callerId !== save?.caller?.callerId) return false;
  if (owner.source === 'fresh') return true;
  return owner.source === 'server' && JSON.stringify(owner.monIds) === JSON.stringify(save?.mons.map((mon) => mon.monInstanceId).sort());
}

export function careSaveOwnedBy(storage: KeyValueStorage, save: SaveCurrent | undefined, authUserId: string | null): boolean {
  return careConsentAllowed(save) && ownershipMatches(storage, save, authUserId);
}

/** Direct widget URLs obey ownership, authentication and consent before any
 * Mon selection or navigation into the retained local save.
 */
export function careLinkTarget(storage: KeyValueStorage, save: SaveCurrent | undefined, authUserId: string | null) {
  if (!ownershipMatches(storage, save, authUserId)) return '/(auth)/sign-in?intent=sign-in' as const;
  if (save?.caller?.consentStatus === 'denied') return '/(auth)/consent?state=denied' as const;
  if (save?.caller?.consentStatus === 'pending') return '/(auth)/consent' as const;
  return careConsentAllowed(save) ? '/(home)' as const : '/(auth)/sign-in?intent=sign-in' as const;
}

/** Call only after verifyCareSaveRoster and after checking the session/save
 * have not changed during its request. Survives sign-out for same-account
 * offline resume, but never grants access to another authentication user.
 */
export function rememberVerifiedCareOwner(storage: KeyValueStorage, save: SaveCurrent, authUserId: string): void {
  if (!save.caller || !authUserId || !careConsentAllowed(save)) return;
  storage.set(CARE_OWNER_KEY, JSON.stringify({ source: 'server', authUserId, deviceId: save.queue.deviceId, callerId: save.caller.callerId, monIds: save.mons.map((mon) => mon.monInstanceId).sort() }));
  storage.remove(CARE_FRESH_SAVE_KEY);
  changed();
}

export function clearCareSaveOwner(storage: KeyValueStorage): void {
  storage.remove(CARE_OWNER_KEY);
  storage.remove(CARE_FRESH_SAVE_KEY);
  changed();
}

/** Existing/restore saves require an authenticated server ownership proof.
 * The server derives mon.callerId from user.id, independently of the local
 * caller-* ID. Checking that ID also rejects a response from a changed cookie
 * session instead of assigning its roster to the earlier hook's account.
 */
export async function verifyCareSaveRoster(save: SaveCurrent, authUserId: string, deps: {
  baseUrl: string; headers?: Readonly<Record<string, string>>; fetch: typeof fetch;
}): Promise<boolean> {
  if (!careConsentAllowed(save) || save.mons.length === 0) return false;
  const controller = new AbortController();
  const request = async () => {
    const response = await deps.fetch(`${deps.baseUrl}/v1/me/mons`, { method: 'GET', credentials: 'include', signal: controller.signal, headers: { accept: 'application/json', ...deps.headers } });
    if (!response.ok) return false;
    const envelope: unknown = await response.json();
    if (!envelope || typeof envelope !== 'object' || !('ok' in envelope) || envelope.ok !== true || !('data' in envelope)) return false;
    const parsed = ListMyMonsResponseSchema.safeParse(envelope.data);
    if (!parsed.success) return false;
    const mine = new Set(parsed.data.mons.filter(({ mon }) => mon.callerId === authUserId).map(({ mon }) => mon.monInstanceId));
    return save.mons.every((mon) => mine.has(mon.monInstanceId));
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([request(), new Promise<false>((resolve) => { timer = setTimeout(() => resolve(false), 10_000); })]);
  } catch { return false; }
  finally { clearTimeout(timer); controller.abort(); }
}

/** Bounded direct-link verification, retaining its Mon intent until the
 * authenticated roster replies. No late response may bind a changed account,
 * deleted save or a replacement roster.
 */
export async function verifyCurrentCareOwner(storage: KeyValueStorage, readSave: () => SaveCurrent | undefined, authUserId: string, deps: {
  baseUrl: string; headers?: Readonly<Record<string, string>>; fetch: typeof fetch; isCurrent: () => boolean;
}): Promise<boolean> {
  const save = readSave();
  if (!save || !deps.isCurrent()) return false;
  if (careSaveOwnedBy(storage, save, authUserId)) return true;
  const identity = careSaveIdentity(save);
  if (!await verifyCareSaveRoster(save, authUserId, deps)) return false;
  const latest = readSave();
  if (!deps.isCurrent() || !latest || careSaveIdentity(latest) !== identity) return false;
  rememberVerifiedCareOwner(storage, latest, authUserId);
  return careSaveOwnedBy(storage, latest, authUserId);
}
