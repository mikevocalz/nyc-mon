'use client';

import { keychainSignature, shouldWriteKeychain, type KeychainSnapshot } from './keychain-snapshot.ts';

/**
 * Writes the keychain snapshot to the App Group and reloads the widget
 * (apps/mobile/modules/keychain-widget). iOS only; the module is absent on
 * Android, in Expo Go and on a build without the plugin, and then this is a no-op.
 */
interface KeychainWidgetNative {
  write(json: string): boolean;
  clear(): boolean;
}

/**
 * The module's JSI host object. `expo-modules-core` 58.0.22
 * `requireOptionalNativeModule` reads `globalThis.expo.modules[name]` first;
 * this package does not depend on `expo`, so it reads the same slot directly,
 * at call time, after the runtime has installed it.
 */
function nativeModule(): KeychainWidgetNative | null {
  const host = (globalThis as typeof globalThis & { expo?: { modules?: { KeychainWidget?: KeychainWidgetNative } } }).expo;
  return host?.modules?.KeychainWidget ?? null;
}

let last: { signature: string; at: number } | null = null;

/** Writes when the widget would draw something new, or on the heartbeat. Returns whether it wrote. */
export function writeKeychainSnapshot(snapshot: KeychainSnapshot): boolean {
  const native = nativeModule();
  if (native === null || !shouldWriteKeychain(last, snapshot)) return false;
  try {
    if (!native.write(JSON.stringify(snapshot))) return false;
    last = { signature: keychainSignature(snapshot), at: snapshot.updatedAt };
    return true;
  } catch {
    return false;
  }
}

/** No active Mon: the widget shows "No Mon yet". */
export function clearKeychainSnapshot(): void {
  const native = nativeModule();
  if (native === null) return;
  try {
    native.clear();
    last = null;
  } catch {
    // The widget keeps its last snapshot and turns stale on its own.
  }
}
