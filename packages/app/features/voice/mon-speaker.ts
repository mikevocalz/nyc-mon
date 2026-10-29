import { FALLBACK_MON_LINGO, gateMonLine, monVoiceRef, planMonUtterance, type MonLingo, type MonVoicePort, type MonVoiceRef } from '@acme/content/voice';
import type { LifecycleStage, MonMood } from '@acme/core';

/**
 * Plays the Mon's lines one at a time on any platform. The caption goes up
 * the moment a line is said (captionText: "Caller", no stage directions) and
 * stays while the voice plays; with Sound off, for a stage with no pitch, or
 * when no clip comes back, the caption alone carries the line for a reading
 * time. A new line, or `stop()`, cuts off the one playing.
 *
 * Every line is gated by voice stage first (Decision 32): an Egg and a Baby
 * in its first day say babble only, so the caption is the gated line. When
 * the server answers with its own gated caption (`x-mon-caption`), that one
 * replaces the local caption: the server clock decides.
 *
 * The speech engine is a `MonVoicePort` from the platform adapters
 * (mon-voice-port.native.ts, mon-voice-port.web.ts); this file never touches
 * audio itself.
 */

/** The Mon a line is spoken by: what the server needs to find it, and its voice. */
export interface MonVoiceSubject {
  readonly monInstanceId: string;
  readonly voiceLineageId: string | null;
  readonly stage: LifecycleStage;
  /** `MonInstance.hatchedAt`; sets the Baby's first-day babble. Null or absent for an Egg. */
  readonly hatchedAt?: number | null;
  readonly mood?: MonMood;
}

export interface MonLine {
  readonly text: string;
  readonly mon: MonVoiceSubject;
  /** Who started the line (a screen's hook). `stop(owner)` from anyone else leaves it playing. */
  readonly owner?: object;
}

/**
 * A platform port. `dispose` frees a clip that was prepared but never played
 * (a blob URL); `captionOf` reads the caption the server gated the line to.
 */
export type SpeakerPort<C> = MonVoicePort<C> & { dispose?(clip: C): void; captionOf?(clip: C): string | undefined };

export interface MonSpeakerDeps<C> {
  /** The platform port for this Mon; `lingo` is the table the line was planned with. */
  readonly portFor: (mon: MonVoiceSubject, lingo: MonLingo) => SpeakerPort<C>;
  /** The lingo Payload serves (`GET /v1/mon-lingo`, mon-lingo-source.ts); the bundled fallback when absent. */
  readonly lingo?: () => MonLingo;
  /** The Caller's Sound switch (Settings, M19). */
  readonly soundEnabled: () => boolean;
  /** Keeps a caption up for `ms`, then calls `done`; returns a cancel. Tests drive it by hand. */
  readonly hold?: (ms: number, done: () => void) => () => void;
  /** The clock the voice stage is read at. Defaults to `Date.now`. */
  readonly now?: () => number;
}

export interface MonSpeaker {
  say(line: MonLine): Promise<void>;
  /** Stops the line playing; with `owner`, only if that owner started it. */
  stop(owner?: object): void;
  caption(): string | null;
  /** True from `say` until its caption clears: a line is being voiced or read. */
  speaking(): boolean;
  subscribe(listener: () => void): () => void;
}

/** How long a caption without sound stays up: a short floor plus reading time. */
export function captionHoldMs(caption: string): number {
  return Math.min(6_000, 1_800 + caption.length * 60);
}

/** After the voice ends, the caption lingers this long so it doesn't blink off mid-glance. */
const TAIL_MS = 700;

/** The Mon's voice ref at `now`, with the subject's mood. Undefined for a Mon from before voice lineages. */
export function subjectRef(mon: MonVoiceSubject, now: number): MonVoiceRef | undefined {
  const ref = monVoiceRef(mon, now);
  if (ref === null) return undefined;
  return mon.mood === undefined ? ref : { ...ref, mood: mon.mood };
}

/**
 * A scripted babble line for a babbling Mon (an Egg, or a Baby in its first
 * day): the gate's seeded babble from its own Bloodline's sounds. Undefined
 * when the Mon may say more than babble at `now`, or has no voice lineage.
 */
export function babbleLine(mon: MonVoiceSubject, now: number, seed: string, lingo: MonLingo = FALLBACK_MON_LINGO): string | undefined {
  const ref = subjectRef(mon, now);
  if (ref?.voiceStage !== 'baby-talk') return undefined;
  return gateMonLine('', ref, lingo, { seed }).text;
}

function serverCaption(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null || !('caption' in err)) return undefined;
  const { caption } = err as { caption?: unknown };
  return typeof caption === 'string' && caption !== '' ? caption : undefined;
}

const defaultHold = (ms: number, done: () => void) => {
  const t = setTimeout(done, ms);
  return () => clearTimeout(t);
};

export function createMonSpeaker<C>(deps: MonSpeakerDeps<C>): MonSpeaker {
  const hold = deps.hold ?? defaultHold;
  const now = deps.now ?? Date.now;
  const listeners = new Set<() => void>();
  let current: string | null = null;
  let active: { controller: AbortController; cancelHold: () => void; owner: object | undefined } | null = null;

  const setCaption = (next: string | null) => {
    if (next === current) return;
    current = next;
    for (const l of [...listeners]) l();
  };

  const stop = (owner?: object) => {
    if (owner !== undefined && active !== null && active.owner !== owner) return;
    if (active !== null) {
      active.controller.abort();
      active.cancelHold();
      active = null;
    }
    setCaption(null);
  };

  return {
    stop,
    caption: () => current,
    speaking: () => active !== null,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async say({ text, mon, owner }) {
      stop();
      const lingo = deps.lingo?.() ?? FALLBACK_MON_LINGO;
      // The planner's default seed (lineage + text) is the one the server and the web fallback use too.
      const plan = planMonUtterance(text, subjectRef(mon, now()), lingo);
      if (plan.caption === '') return;

      const controller = new AbortController();
      const turn = { controller, cancelHold: () => {}, owner };
      active = turn;
      setCaption(plan.caption);
      const isCurrent = () => active === turn && !controller.signal.aborted;
      const clearAfter = (ms: number) => {
        turn.cancelHold = hold(ms, () => {
          if (active === turn) {
            active = null;
            setCaption(null);
          }
        });
      };

      if (plan.voice.kind === 'silent' || !deps.soundEnabled()) {
        clearAfter(captionHoldMs(plan.caption));
        return;
      }
      const port = deps.portFor(mon, lingo);
      let clip: C;
      try {
        // The raw line: the server gates it again by its own clock and says what it captioned.
        clip = await port.prepare(text, controller.signal);
      } catch (err) {
        // No clip (no key, offline, an Egg the server has no record for): the caption carries the line.
        if (!isCurrent()) return;
        const fromServer = serverCaption(err);
        if (fromServer !== undefined) setCaption(fromServer);
        clearAfter(captionHoldMs(fromServer ?? plan.caption));
        return;
      }
      if (!isCurrent()) {
        port.dispose?.(clip);
        return;
      }
      const fromServer = port.captionOf?.(clip);
      if (fromServer !== undefined && fromServer !== '') setCaption(fromServer);
      try {
        await port.play(clip, controller.signal);
      } catch {
        // A playback failure is the same as no clip.
      }
      if (isCurrent()) clearAfter(TAIL_MS);
    },
  };
}
