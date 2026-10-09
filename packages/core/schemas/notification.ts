import { z } from 'zod';
import { IdSchema } from './primitives.ts';

/** The M12 hatch route the hatch-ready notification opens. */
export const READY_NOTIFICATION_URL = '/(home)/hatch';

/**
 * The `data` payload of the hatch-ready notification (M11 schedules it, M12
 * opens from it). The only notification Phase 1 sends (D-15c). Parse every
 * received payload with this before routing (Law 5): the OS hands it back as
 * untyped JSON.
 */
export const ReadyNotificationDataSchema = z.object({
  eggId: IdSchema,
  url: z.literal(READY_NOTIFICATION_URL),
});
