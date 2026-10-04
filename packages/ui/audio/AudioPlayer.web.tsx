'use client';
import { useEffect, useRef } from 'react';
import { useInstanceStore, useStore } from '../use-instance-store';
import { PlayerShell } from './PlayerShell';
import { summarise } from './waveform.ts';
import type { AudioPlayerProps } from './AudioPlayer.types.ts';

interface PlayerState {
  playing: boolean;
  elapsed: number;
  total: number;
  bars: number[];
  error: string | null;
}

const OPEN_ERROR = 'This recording could not be opened.';

/**
 * Web: an HTMLMediaElement drives playback (created in a ref, never rendered,
 * so the page carries no unstyled <audio> chrome), and the shared
 * PlayerShell draws the NYC-MON player. Keyboard and screen-reader access
 * come from the kit pieces: the play tile is a real button and the seek
 * control is the kit Slider, a real range input.
 *
 * The waveform is the recording's own shape when the caller passes the
 * captured levels; otherwise the file is decoded once with Web Audio.
 */
export function AudioPlayer({ uri, duration, levels, label, tone, district, className }: AudioPlayerProps) {
  const store = useInstanceStore<PlayerState>(() => ({
    playing: false,
    elapsed: 0,
    total: duration ?? 0,
    bars: levels?.length ? summarise(levels) : [],
    error: null,
  }));
  const playing = useStore(store, (st) => st.playing);
  const elapsed = useStore(store, (st) => st.elapsed);
  const total = useStore(store, (st) => st.total);
  const bars = useStore(store, (st) => st.bars);
  const error = useStore(store, (st) => st.error);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const el = new Audio();
    el.preload = 'metadata';
    audio.current = el;
    store.setState({ playing: false, elapsed: 0, error: null, total: duration ?? 0 });

    const onMeta = () => {
      if (duration === undefined && Number.isFinite(el.duration)) store.setState({ total: el.duration });
    };
    const onTime = () => store.setState({ elapsed: el.currentTime });
    const onEnded = () => {
      el.currentTime = 0;
      store.setState({ playing: false, elapsed: 0 });
    };
    const onError = () => store.setState({ error: OPEN_ERROR, playing: false });
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnded);
    el.addEventListener('error', onError);
    el.src = uri;

    if (levels?.length) {
      store.setState({ bars: summarise(levels) });
    } else if (typeof window.AudioContext === 'function') {
      // Decode once for the shape; the context only lives for the decode.
      const ctx = new window.AudioContext();
      void fetch(uri)
        .then((res) => res.arrayBuffer())
        .then((buf) => ctx.decodeAudioData(buf))
        .then((decoded) => {
          if (!cancelled) store.setState({ bars: summarise(Array.from(decoded.getChannelData(0))) });
        })
        .catch(() => {
          // A shape we cannot decode leaves the flat street line; playback may still work.
        })
        .finally(() => void ctx.close());
    }

    return () => {
      cancelled = true;
      el.pause();
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('error', onError);
      el.removeAttribute('src');
      el.load();
      audio.current = null;
    };
  }, [uri, duration, levels, store]);

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (el.paused) {
      el.play().then(
        () => store.setState({ playing: true }),
        () => store.setState({ error: OPEN_ERROR, playing: false }),
      );
    } else {
      el.pause();
      store.setState({ playing: false });
    }
  };

  const seek = (seconds: number) => {
    const el = audio.current;
    if (!el) return;
    const next = Math.max(0, Math.min(seconds, total || seconds));
    el.currentTime = next;
    store.setState({ elapsed: next });
  };

  return (
    <PlayerShell
      label={label}
      playing={playing}
      elapsed={elapsed}
      total={total}
      bars={bars}
      error={error}
      onToggle={toggle}
      onSeek={seek}
      tone={tone}
      district={district}
      className={className}
    />
  );
}
