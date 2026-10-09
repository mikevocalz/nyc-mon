import { ReadyNotificationDataSchema } from '@acme/core/schemas';
import type { ReadyNotificationData } from '@acme/core/types';

/** Result of {@linkcode parseReadyNotificationData}. On failure, `issues` is a log line, never shown to the Caller. */
export type ReadyNotificationParse =
  | { readonly ok: true; readonly data: ReadyNotificationData }
  | { readonly ok: false; readonly issues: string };

/**
 * Parses a received notification's `content.data` as the hatch-ready deep
 * link (M12 B3, Law 5). Pure. The root-layout wiring routes on `ok` to
 * `/(home)/hatch` with `params: { eggId }` and logs `issues` otherwise; any
 * other notification payload is not a hatch-ready one and is ignored.
 *
 * @example
 * ```ts
 * const parsed = parseReadyNotificationData(response.notification.request.content.data);
 * if (parsed.ok) router.push({ pathname: parsed.data.url, params: { eggId: parsed.data.eggId } });
 * else log(parsed.issues);
 * ```
 */
export function parseReadyNotificationData(data: unknown): ReadyNotificationParse {
  const result = ReadyNotificationDataSchema.safeParse(data);
  return result.success ? { ok: true, data: result.data } : { ok: false, issues: result.error.message };
}
