'use client';

import type { KeychainSnapshot } from './keychain-snapshot.ts';

/** PLATFORM FORK (web / Android): no keychain widget. The iOS fork writes to the App Group. */
export function writeKeychainSnapshot(_snapshot: KeychainSnapshot): boolean {
  return false;
}

export function clearKeychainSnapshot(): void {}
