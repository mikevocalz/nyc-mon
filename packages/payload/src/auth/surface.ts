// Which kind of screen a session belongs to (ADR 0004 §9). "A device session
// is a surface, not a new creature": the label is for the devices list only
// and never changes which Mon a session sees.

/** The surface labels a session can carry. */
export const SURFACES = ['phone', 'tablet', 'quest', 'vision-pro', 'web', 'admin'] as const;

/** One of {@link SURFACES}. */
export type Surface = (typeof SURFACES)[number];

/** Request header a first-party client sends to name its surface. */
export const SURFACE_HEADER = 'x-nycmon-surface';

export function isSurface(value: unknown): value is Surface {
  return typeof value === 'string' && (SURFACES as readonly string[]).includes(value);
}

/** Device-authorization client ids to the surface they sign in. */
const CLIENT_SURFACES: Readonly<Record<string, Surface>> = {
  'nyc-mon-quest': 'quest',
  'nyc-mon-visionos': 'vision-pro',
  'nyc-mon-tablet': 'tablet',
};

/** The surface a device-authorization `client_id` signs in, if it is one of ours. */
export function surfaceForClientId(clientId: unknown): Surface | undefined {
  return typeof clientId === 'string' ? CLIENT_SURFACES[clientId] : undefined;
}

/** Words the new-sign-in email uses for each surface. */
export function surfaceLabel(surface: Surface): string {
  switch (surface) {
    case 'phone':
      return 'phone';
    case 'tablet':
      return 'tablet';
    case 'quest':
      return 'Meta Quest headset';
    case 'vision-pro':
      return 'Apple Vision Pro';
    case 'web':
      return 'web browser';
    case 'admin':
      return 'staff console';
    default: {
      const unreachable: never = surface;
      return unreachable;
    }
  }
}
