import type { z } from 'zod';
import {
  PRESENCE_FRESHNESS_MS,
  PresenceEventSchema,
  presenceTier,
  type PresenceEvent,
  type PresenceTier,
} from './types.ts';

/**
 * Familiar Presence Service (ADR 0007).
 *
 * Boundary: this service *consumes* PresenceEvents. Producing them — VAD,
 * speaker embedding, match against self-enrolled prints — is the NYC-Mon
 * app/web's job, published to a Supabase Realtime channel. The Echo is never
 * a producer.
 *
 * Scaffold state: events live in a per-process in-memory ring fed by
 * `ingest()` (the dev tool `inject_presence_event` calls it) and by the
 * Supabase seam below. Swap `subscribeRealtime` for a real
 * `@supabase/supabase-js` channel subscription once credentials exist —
 * noted in FRICTION-LOG.
 */

export interface PresentPerson {
  readonly personId: string;
  readonly confidence: number;
  readonly tier: PresenceTier;
  readonly lastSeenAt: number;
}

const MAX_EVENTS_PER_CALLER = 64;

export class PresenceService {
  private readonly events = new Map<string, PresenceEvent[]>();

  /** Record a validated event. Returns the parsed event or null if malformed. */
  ingest(raw: unknown): PresenceEvent | null {
    const parsed = PresenceEventSchema.safeParse(raw);
    if (!parsed.success) return null;
    const event = parsed.data;
    const list = this.events.get(event.callerId) ?? [];
    list.push(event);
    if (list.length > MAX_EVENTS_PER_CALLER) list.splice(0, list.length - MAX_EVENTS_PER_CALLER);
    this.events.set(event.callerId, list);
    return event;
  }

  /**
   * TODO(realtime): subscribe to Supabase channel `presence-events` filtered
   * by callerId and feed each broadcast payload through `ingest()`.
   * Signature kept so the swap is one method body.
   */
  async subscribeRealtime(_callerId: string): Promise<void> {
    // TODO(supabase): const channel = supabase.channel(`presence:${callerId}`)
    //   .on('broadcast', { event: 'presence' }, ({ payload }) => this.ingest(payload))
    //   .subscribe();
  }

  /** Fresh, non-silent detections for a Caller, newest confidence wins. */
  presentPeople(callerId: string, now: number = Date.now()): PresentPerson[] {
    const byPerson = new Map<string, PresenceEvent>();
    for (const e of this.events.get(callerId) ?? []) {
      if (now - e.ts > PRESENCE_FRESHNESS_MS) continue;
      const prev = byPerson.get(e.personId);
      if (!prev || e.ts > prev.ts) byPerson.set(e.personId, e);
    }
    return [...byPerson.values()]
      .map((e) => ({
        personId: e.personId,
        confidence: e.confidence,
        tier: presenceTier(e.confidence),
        lastSeenAt: e.ts,
      }))
      .filter((p) => p.tier !== 'silent')
      .sort((a, b) => b.confidence - a.confidence);
  }

  /** Most recent event for one person, within the freshness window. */
  latestFor(callerId: string, personId: string, now: number = Date.now()): PresenceEvent | null {
    const list = this.events.get(callerId) ?? [];
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const e = list[i];
      if (e && e.personId === personId && now - e.ts <= PRESENCE_FRESHNESS_MS) return e;
    }
    return null;
  }
}

/** Shared instance for the process — one service per server, not per session. */
export const presenceService = new PresenceService();

export type PresenceEventInput = z.input<typeof PresenceEventSchema>;
export { PresenceEventSchema };
