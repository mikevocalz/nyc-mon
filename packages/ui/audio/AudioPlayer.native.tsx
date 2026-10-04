'use client';
import { useEffect, useRef } from 'react';
import { createStore, useStore } from 'zustand';
import { AudioContext, decodeAudioData } from 'react-native-audio-api';
import { haptics } from '../haptics';
import { PlayerShell } from './PlayerShell';
import { summarise } from './waveform.ts';
import type { AudioPlayerProps } from './AudioPlayer.types.ts';

const TICK_MS = 60;

function createPlayerStore() {
  return createStore<{
    playing: boolean;
    elapsed: number;
    total: number;
    bars: number[];
    error: string | null;
    set: (next: Partial<{ playing: boolean; elapsed: number; total: number; bars: number[]; error: string | null }>) => void;
  }>((set) => ({
    playing: false,
    elapsed: 0,
    total: 0,
    bars: [],
    error: null,
    set: (next) => set(next),
  }));
}

/**
 * Play a voice note.
 *
 * The waveform is the recording's own shape: the recorder hands its captured
 * levels along, and the player only decodes the file when it was not given any
 * — a note opened on another device, say. Decoding on every render would make
 * the same recording look different depending on where it was opened.
 *
 * `AudioBufferSourceNode` is one-shot by design in Web Audio: a stopped source
 * cannot restart, so each play builds a new one. The elapsed clock is derived
 * from the context's own time rather than a counter, so pausing and resuming
 * cannot drift away from the audio.
 */
export function AudioPlayer({ uri, duration, levels, label, tone, district, className }: AudioPlayerProps) {
  const store = useRef<ReturnType<typeof createPlayerStore> | null>(null);
  store.current ??= createPlayerStore();
  const playing = useStore(store.current, (state) => state.playing);
  const elapsed = useStore(store.current, (state) => state.elapsed);
  const total = useStore(store.current, (state) => state.total);
  const bars = useStore(store.current, (state) => state.bars);
  const error = useStore(store.current, (state) => state.error);

  const context = useRef<AudioContext | null>(null);
  const buffer = useRef<Awaited<ReturnType<typeof decodeAudioData>> | null>(null);
  const source = useRef<ReturnType<AudioContext['createBufferSource']> | null>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);
  const offset = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const decoded = await decodeAudioData(uri);
        if (cancelled) return;

        buffer.current = decoded;
        // Only decode a waveform when the recorder did not supply one.
        const shape =
          levels !== undefined && levels.length > 0
            ? summarise(levels)
            : summarise(Array.from(decoded.getChannelData(0)));

        store.current?.getState().set({ total: duration ?? decoded.duration, bars: shape });
      } catch {
        if (!cancelled) {
          store.current?.getState().set({ error: 'This recording could not be opened.' });
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (ticker.current !== null) clearInterval(ticker.current);
      source.current?.stop();
      void context.current?.close();
    };
  }, [uri, duration, levels]);

  const play = () => {
    const decoded = buffer.current;
    if (decoded === null) return;
    haptics.selection();

    const audioContext = context.current ?? new AudioContext();
    context.current = audioContext;

    const node = audioContext.createBufferSource();
    node.buffer = decoded;
    node.connect(audioContext.destination);
    node.onended = () => {
      if (ticker.current !== null) clearInterval(ticker.current);
      offset.current = 0;
      store.current?.getState().set({ playing: false, elapsed: 0 });
    };

    node.start(0, offset.current);
    source.current = node;
    startedAt.current = audioContext.currentTime;
    store.current?.getState().set({ playing: true });

    ticker.current = setInterval(() => {
      const played = offset.current + (audioContext.currentTime - startedAt.current);
      store.current?.getState().set({ elapsed: played });
    }, TICK_MS);
  };

  const pause = () => {
    haptics.selection();
    if (ticker.current !== null) clearInterval(ticker.current);
    const audioContext = context.current;
    if (audioContext !== null) {
      offset.current += audioContext.currentTime - startedAt.current;
    }
    source.current?.stop();
    source.current = null;
    store.current?.getState().set({ playing: false });
  };

  /**
   * Jump to a position.
   *
   * `AudioBufferSourceNode` is one-shot in Web Audio — a stopped source cannot
   * be restarted — so seeking tears the current source down and `play()` builds
   * a new one from the offset. Playback resumes only if it was already running,
   * so dragging the slider on a paused note scrubs without starting it.
   */
  const seek = (seconds: number) => {
    const wasPlaying = playing;
    if (ticker.current !== null) clearInterval(ticker.current);
    source.current?.stop();
    source.current = null;

    offset.current = Math.max(0, Math.min(seconds, total));
    store.current?.getState().set({ elapsed: offset.current, playing: false });
    if (wasPlaying) play();
  };

  return (
    <PlayerShell
      label={label}
      playing={playing}
      elapsed={elapsed}
      total={total}
      bars={bars}
      error={error}
      onToggle={() => (playing ? pause() : play())}
      onSeek={seek}
      tone={tone}
      district={district}
      className={className}
    />
  );
}
