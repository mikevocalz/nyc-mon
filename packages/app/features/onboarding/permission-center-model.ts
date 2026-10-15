/**
 * Final onboarding permission choices. These are requests, not durable claims
 * that an OS grant exists. The only preselected choice is Notifications.
 * Kept independent of React/native modules so it can be tested under Node.
 */
export const PERMISSION_IDS = [
  'notifications',
  'location',
  'camera',
  'microphone',
  'motion',
  'photos',
] as const;

export type PermissionId = (typeof PERMISSION_IDS)[number];
export type PermissionAccess = 'undetermined' | 'granted' | 'denied' | 'blocked' | 'unavailable';

export const DEFAULT_SELECTED_PERMISSIONS: readonly PermissionId[] = ['notifications'];

export const PERMISSION_COPY: Record<PermissionId, { title: string; detail: string }> = {
  notifications: {
    title: 'Notifications',
    detail: 'One alert when your egg is ready. You can hatch it without an alert, too.',
  },
  location: {
    title: 'Location · while using',
    detail: 'Discover nearby encounters. Background location is not requested.',
  },
  camera: {
    title: 'Camera',
    detail: 'Scan objects and use AR when those features are available.',
  },
  microphone: {
    title: 'Microphone',
    detail: 'Talk to your Mon when voice features are available. This does not enroll a voiceprint.',
  },
  motion: {
    title: 'Motion & orientation',
    detail: 'Place and move AR objects. Only requested on supported devices.',
  },
  photos: {
    title: 'Save to Photos',
    detail: 'Save Mon moments. Browsing selected photos uses the system picker instead.',
  },
};

/** Request one OS permission at a time; one denial never blocks later choices. */
export async function requestSelectedPermissions(
  selected: readonly PermissionId[],
  request: (permission: PermissionId) => Promise<PermissionAccess>,
  afterEach?: (permission: PermissionId, outcome: PermissionAccess) => void,
): Promise<Partial<Record<PermissionId, PermissionAccess>>> {
  const outcomes: Partial<Record<PermissionId, PermissionAccess>> = {};
  for (const permission of PERMISSION_IDS) {
    if (!selected.includes(permission)) continue;
    let outcome: PermissionAccess;
    try {
      outcome = await request(permission);
    } catch {
      outcome = 'unavailable';
    }
    outcomes[permission] = outcome;
    afterEach?.(permission, outcome);
  }
  return outcomes;
}

/** A skipped permission screen never makes an OS request. */
export const PERMISSION_CENTER_ROUTE = '/(onboarding)/permissions' as const;
