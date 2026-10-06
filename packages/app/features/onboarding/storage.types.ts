/**
 * The storage shape the onboarding feature needs: string keys only. The web
 * resolver backs it with localStorage; the native one with MMKV.
 */
export interface KeyValueStorage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
}
