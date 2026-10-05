export {
  DEFAULT_FAMILIAR_PERMISSIONS,
  FamiliarPersonSchema,
  MAYBE_THRESHOLD,
  PermissionSchema,
  PRESENCE_FRESHNESS_MS,
  PRESENCE_TIERS,
  PRESENT_THRESHOLD,
  PresenceEventSchema,
  PresenceSourceSchema,
  PresenceTierSchema,
  presenceTier,
} from './types.ts';
export type { FamiliarPerson, Permission, PresenceEvent, PresenceSource, PresenceTier } from './types.ts';
export { PresenceService, presenceService } from './service.ts';
export type { PresentPerson } from './service.ts';
