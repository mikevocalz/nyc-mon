import type { PermissionAccess, PermissionId } from './permission-center-model';

/**
 * Web/SSR fallback. Native builds load the .native fork instead and invoke
 * actual platform permission APIs. No browser permission dialogs during SSR.
 */
export async function getDevicePermission(_id: PermissionId): Promise<PermissionAccess> {
  return 'unavailable';
}

export async function requestDevicePermission(_id: PermissionId): Promise<PermissionAccess> {
  return 'unavailable';
}
