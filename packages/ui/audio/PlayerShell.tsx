'use client';
import type { ReactNode } from 'react';
import { tv } from 'tailwind-variants';
import { Pressable, Text, View } from '../tw';
import { CornerCutFrame } from '../neon/CornerCutFrame';
import { Pause, Play, AudioLines } from '../icons';
import { Slider } from '../Slider';
import { TONE_CLASSES, resolveControlTone, toneInput, toneVariants, type ControlTone, type District } from '../district';
import { Waveform } from './Waveform.tsx';

/**
 * The NYC-MON voice-note player, shared by the web and native forks; each
 * fork owns its audio engine and hands this the state.
 *
 * A night panel under a tone keyline, the waveform as a skyline of solid
 * bars, and a corner-cut play tile in the tone face on its depth plate. The
 * panel sets every text colour itself, so it reads the same on a light page.
 */
const shell = tv({
  slots: {
    root: 'my-2 w-full border-2 border-ink-800 bg-ink-900',
    keyline: 'h-1 w-full',
    body: 'gap-3 p-3 md:p-4',
    header: 'flex-row items-center gap-2',
    label: 'flex-1 font-display text-sm text-ink-50 md:text-base',
    row: 'flex-row items-center gap-3 md:gap-4',
    tile:
      'shrink-0 self-center rounded-none transition-transform duration-fast motion-reduce:transition-none ' +
      'active:translate-x-[2px] active:translate-y-[2px] ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900',
    track: 'min-w-0 flex-1 gap-1.5',
    times: 'flex-row justify-between',
    time: 'text-xs text-silver-300 md:text-sm',
    error: 'text-sm text-apple-400',
  },
  variants: {
    tone: toneVariants((c) => ({ keyline: c.face })),
  },
});

const clock = (seconds: number) => {
  const s = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

export interface CutTileProps {
  label: string;
  onPress: () => void;
  tone: ControlTone;
  /** Tile side in dp. */
  size?: number;
  disabled?: boolean;
  children: ReactNode;
}

/** A corner-cut action tile in the tone face, for play, record and stop. */
export function CutTile({ label, onPress, tone, size = 48, disabled, children }: CutTileProps) {
  const s = shell();
  return (
    <Pressable
      role="button"
      aria-label={label}
      aria-disabled={disabled}
      onPress={disabled ? undefined : onPress}
      className={s.tile()}
    >
      {/* Unavailable drops the face and the depth plate (the press affordance): a night tile behind an ink keyline. */}
      <CornerCutFrame
        tone={disabled ? 'ink' : toneInput(tone)}
        variant={disabled ? 'outline' : 'solid'}
        cut={Math.round(size / 4)}
        depth={disabled ? 0 : 4}
        className="items-center justify-center"
      >
        {/* Computed: the tile side comes from the size prop. */}
        <View className="items-center justify-center" style={{ width: size - 4, height: size - 4 }}>
          {children}
        </View>
      </CornerCutFrame>
    </Pressable>
  );
}

export interface PlayerShellProps {
  label?: string;
  playing: boolean;
  /** Seconds played. */
  elapsed: number;
  /** Length in seconds; 0 until known. */
  total: number;
  /** Waveform levels, 0-1. */
  bars: readonly number[];
  error: string | null;
  onToggle: () => void;
  onSeek: (seconds: number) => void;
  tone?: ControlTone;
  district?: District;
  className?: string;
}

export function PlayerShell({
  label, playing, elapsed, total, bars, error, onToggle, onSeek, tone: toneProp, district, className,
}: PlayerShellProps) {
  const tone = resolveControlTone(toneProp, district);
  const c = TONE_CLASSES[tone];
  const s = shell({ tone });
  const progress = total > 0 ? Math.min(1, elapsed / total) : 0;
  const Icon = playing ? Pause : Play;

  return (
    <View className={s.root({ className })}>
      <View aria-hidden className={s.keyline()} />
      <View className={s.body()}>
        {label ? (
          <View className={s.header()}>
            <AudioLines size={16} className={c.text} />
            <Text numberOfLines={1} className={s.label()}>{label}</Text>
          </View>
        ) : null}

        <View className={s.row()}>
          <CutTile label={playing ? 'Pause' : 'Play'} onPress={onToggle} tone={tone} disabled={!!error}>
            <Icon size={20} className={error ? 'text-ink-400' : c.onFace} />
          </CutTile>

          <View className={s.track()}>
            <Waveform levels={bars} progress={progress} height={36} tone={tone} />

            {/* The waveform SHOWS position; the slider is what moves it. Bars
                are a few dp wide and carry no accessibility semantics, while
                the kit's Slider brings a keyboard path, screen-reader value
                announcements and the right touch slop. */}
            <Slider
              value={Math.min(elapsed, Math.max(total, 0.1))}
              min={0}
              max={Math.max(total, 0.1)}
              onValueChange={onSeek}
              tone={tone}
              label="Seek"
            />

            <View className={s.times()}>
              <Text className={s.time()}>{clock(elapsed)}</Text>
              <Text className={s.time()}>{clock(total)}</Text>
            </View>
          </View>
        </View>

        {error ? <Text role="alert" className={s.error()}>{error}</Text> : null}
      </View>
    </View>
  );
}
