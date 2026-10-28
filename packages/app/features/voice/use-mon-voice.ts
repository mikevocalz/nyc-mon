'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useFocusEffect } from 'expo-router';
import { monLine, type MonLineOccasion } from '@acme/content/lines';
import type { MonMood } from '@acme/core';
import type { MonInstance } from '@acme/core/types';
import { getKitPreferences, subscribeKitPreferences } from '@acme/ui';
import { lobbyStore } from '../game/lobby/lobby.store.ts';
import { AUTH_BASE_URL } from '../onboarding/auth';
import { createMonLingoSource } from './mon-lingo-source';
import { createMonSpeaker, type MonVoiceSubject } from './mon-speaker';
import { createMonVoicePort, MON_VOICE_HEADERS } from './mon-voice-port';

/**
 * The app's one Mon voice. Every screen that lets the Mon talk goes through
 * `useMonVoice`; nothing else plays speech (packages/content/test/voice-boundary.test.ts).
 *
 * - Sound off in Settings (M19): captions only, and a line already playing stops.
 * - Leaving the screen (blur or unmount) stops the voice and clears the caption.
 * - The city starting (the Game tab leaves its lobby) stops it too.
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

export const monSpeaker = createMonSpeaker({
  portFor: createMonVoicePort,
  soundEnabled: () => getKitPreferences().sound,
  lingo: monLingo.current,
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
  return { monInstanceId: mon.monInstanceId, voiceLineageId: mon.voiceLineageId, stage: mon.stage, ...(mood === undefined ? {} : { mood }) };
}

/**
 * Lets the screen's Mon talk. `say(text)` speaks any line (a reply shown on
 * the glass); `sayLine(occasion)` speaks the canon line for that moment from
 * the served lingo, and does nothing where canon has none (`@acme/content/lines`).
 */
export function useMonVoice(mon: MonInstance | undefined, mood?: MonMood) {
  const caption = useMonCaption();
  // This screen's token: its blur or unmount stops only a line it started.
  const [owner] = useState(() => ({}));

  useFocusEffect(
    useCallback(() => {
      void monLingo.refresh();
      return () => monSpeaker.stop(owner);
    }, [owner]),
  );
  useEffect(() => () => monSpeaker.stop(owner), [owner]);

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
      if (line === undefined) return false;
      void monSpeaker.say({ text: line, mon: subjectOf(mon, mood), owner });
      return true;
    },
    [mon, mood, owner],
  );
  return { caption, say, sayLine, stop: stopMonVoice };
}
