'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { monLine, type MonLineOccasion } from '@acme/content/lines';
import { deriveVoiceLineageId, type MonMood } from '@acme/core';
import type { EggRecord, MonInstance } from '@acme/core/types';
import { getKitPreferences, subscribeKitPreferences } from '@acme/ui';
import { useAudioStore } from '../editor/audio.store.ts';
import { lobbyStore } from '../game/lobby/lobby.store.ts';
import { AUTH_BASE_URL } from '../onboarding/auth';
import { startAmbientBabble } from './ambient-babble';
import { createMonLingoSource } from './mon-lingo-source';
import { babbleLine, createMonSpeaker, type MonVoiceSubject } from './mon-speaker';
import { createMonVoicePort, MON_VOICE_HEADERS } from './mon-voice-port';
import { useScreenFocus } from './use-screen-focus';

/**
 * The app's one Mon voice. Every screen that lets the Mon talk goes through
 * `useMonVoice`; nothing else plays speech (packages/content/test/voice-boundary.test.ts).
 *
 * - Sound off in Settings (M19): captions only, and a line already playing stops.
 * - Leaving the screen (blur or unmount) stops the voice and clears the caption.
 * - The city starting (the Game tab leaves its lobby) stops it too.
 * - An Egg, and a Baby in its first 24 hours, babble only (Decision 32): on a
 *   tap or care, and now and then on their own (`useAmbientBabble`).
 *
 * Lines, pronunciations and voices come from Payload (`GET /v1/mon-lingo`),
 * revalidated by ETag each time a screen with a Mon voice gains focus; the
 * bundled fallback answers until then and while offline.
 */
export const monLingo = createMonLingoSource({
  baseUrl: AUTH_BASE_URL,
  headers: MON_VOICE_HEADERS,
  fetch: (url, init) => fetch(url, init),
});

/** The clock the voice stage is read at; the server re-reads it by its own clock and its caption wins. */
const clock = (): number => Date.now();

export const monSpeaker = createMonSpeaker({
  portFor: (mon, lingo) => createMonVoicePort(mon, lingo),
  soundEnabled: () => getKitPreferences().sound,
  lingo: monLingo.current,
  now: clock,
});

subscribeKitPreferences(() => {
  if (!getKitPreferences().sound) monSpeaker.stop();
});
lobbyStore.subscribe((state: { phase: string }) => {
  if (state.phase !== 'lobby') monSpeaker.stop();
});

/** Stops the Mon mid-line and clears the caption (sign-out, a modal taking over). */
export function stopMonVoice(): void {
  monSpeaker.stop();
}

/** The caption on screen right now, or null. */
export function useMonCaption(): string | null {
  return useSyncExternalStore(monSpeaker.subscribe, monSpeaker.caption, monSpeaker.caption);
}

function subjectOf(mon: MonInstance, mood: MonMood | undefined): MonVoiceSubject {
  return {
    monInstanceId: mon.monInstanceId,
    voiceLineageId: mon.voiceLineageId,
    stage: mon.stage,
    hatchedAt: mon.hatchedAt,
    ...(mood === undefined ? {} : { mood }),
  };
}

/**
 * An incubating egg as a voice: the `monInstanceId` it reserves, the lineage
 * the hatch will give the Baby (one voice for life), stage Egg. The server
 * has no Mon record until the hatch, so `/v1/mon-voice` answers 404 and the
 * port's fallback and the caption carry the babble.
 */
export function eggVoiceSubject(egg: Pick<EggRecord, 'eggId' | 'speciesId' | 'monInstanceId'>): MonVoiceSubject {
  return { monInstanceId: egg.monInstanceId, voiceLineageId: deriveVoiceLineageId(egg), stage: 'Egg', hatchedAt: null };
}

/** True when nothing else holds the Mon's voice or the mic: Sound on, no line playing, the voice-note recorder closed. */
function voiceFree(): boolean {
  return getKitPreferences().sound && !monSpeaker.speaking() && !useAudioStore.getState().open;
}

/**
 * Says one seeded babble line for `subject` if it babbles at all right now.
 * `ifFree` skips it while another line is playing (a tap never cuts the Mon off).
 */
function sayBabble(subject: MonVoiceSubject, seed: string, owner: object, ifFree: boolean): boolean {
  if (ifFree && monSpeaker.speaking()) return false;
  const line = babbleLine(subject, clock(), seed, monLingo.current());
  if (line === undefined) return false;
  void monSpeaker.say({ text: line, mon: subject, owner });
  return true;
}

/** Stops `owner`'s line on blur and unmount; refreshes the served lingo on focus. */
function useVoiceOwner(): object {
  // This screen's token: its blur or unmount stops only a line it started.
  const [owner] = useState(() => ({}));
  useScreenFocus(
    useCallback(() => {
      void monLingo.refresh();
      return () => monSpeaker.stop(owner);
    }, [owner]),
  );
  useEffect(() => () => monSpeaker.stop(owner), [owner]);
  return owner;
}

/**
 * Ambient babble for the Mon (or Egg) on screen: runs while the screen is
 * focused and the app is in the foreground, and only while `subject` babbles
 * (an Egg; a Baby until `hatchedAt + 24 h`, when it stops by itself). A turn
 * that comes due while Sound is off, a line is playing or the recorder is
 * open is skipped.
 */
export function useAmbientBabble(subject: MonVoiceSubject | undefined, owner: object): void {
  // The scheduler reads the subject on every turn, so a new record never restarts it.
  const latest = useRef(subject);
  useEffect(() => {
    latest.current = subject;
  }, [subject]);
  const seed = subject?.monInstanceId;
  useScreenFocus(
    useCallback(() => {
      if (seed === undefined) return undefined;
      let stop: (() => void) | null = null;
      const start = () => {
        stop ??= startAmbientBabble({
          subject: () => latest.current,
          now: clock,
          setTimer: (ms, fire) => {
            const t = setTimeout(fire, ms);
            return () => clearTimeout(t);
          },
          canSpeak: voiceFree,
          babble: (turnSeed) => {
            const mon = latest.current;
            if (mon !== undefined) sayBabble(mon, turnSeed, owner, true);
          },
          seed,
        });
      };
      const halt = () => {
        stop?.();
        stop = null;
      };
      if (AppState.currentState === 'active') start();
      const sub = AppState.addEventListener('change', (state) => (state === 'active' ? start() : halt()));
      return () => {
        sub.remove();
        halt();
      };
    }, [seed, owner]),
  );
}

/**
 * Lets the screen's Mon talk. `say(text)` speaks any line (a reply shown on
 * the glass); `sayLine(occasion)` speaks the canon line for that moment from
 * the served lingo (`@acme/content/lines`). Where canon has none the Mon stays
 * quiet, unless it is a Baby in its first day: then it babbles. A babbling Mon
 * also babbles on its own while the screen is up (see `useAmbientBabble`).
 */
export function useMonVoice(mon: MonInstance | undefined, mood?: MonMood, options: { readonly ambient?: boolean } = {}) {
  const caption = useMonCaption();
  const owner = useVoiceOwner();
  const subject = useMemo(() => (mon === undefined ? undefined : subjectOf(mon, mood)), [mon, mood]);
  // `ambient: false` (an asleep Mon) keeps the Mon from babbling on its own.
  useAmbientBabble(options.ambient === false ? undefined : subject, owner);

  const say = useCallback(
    (text: string) => {
      if (mon === undefined) return;
      void monSpeaker.say({ text, mon: subjectOf(mon, mood), owner });
    },
    [mon, mood, owner],
  );
  const sayLine = useCallback(
    (occasion: MonLineOccasion): boolean => {
      if (mon === undefined) return false;
      const line = monLine(occasion, mon, monLingo.current());
      // No canon line for this form: a babbling Baby still answers in babble.
      if (line === undefined) return sayBabble(subjectOf(mon, mood), `${mon.monInstanceId}|${occasion}|${clock()}`, owner, false);
      void monSpeaker.say({ text: line, mon: subjectOf(mon, mood), owner });
      return true;
    },
    [mon, mood, owner],
  );
  return { caption, say, sayLine, stop: stopMonVoice };
}

/**
 * An incubating egg's voice (M11): `babble()` on a tap or "Keep it warm"
 * says one seeded babble line unless a line is already playing, and the egg
 * babbles on its own now and then while the screen is up.
 */
export function useEggVoice(egg: Pick<EggRecord, 'eggId' | 'speciesId' | 'monInstanceId'>) {
  const caption = useMonCaption();
  const owner = useVoiceOwner();
  const subject = useMemo(() => eggVoiceSubject(egg), [egg]);
  useAmbientBabble(subject, owner);
  const babble = useCallback(() => sayBabble(subject, `${subject.monInstanceId}|tap|${clock()}`, owner, true), [subject, owner]);
  return { caption, babble };
}
