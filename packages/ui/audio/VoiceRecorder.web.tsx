'use client';
import { tv } from 'tailwind-variants';
import { View, Text } from '../tw';
import { Mic } from '../icons';
import { TONE_CLASSES, resolveControlTone, toneVariants } from '../district';
import type { VoiceRecorderProps } from './VoiceRecorder.types.ts';

const panel = tv({
  slots: {
    root: 'w-full border-2 border-ink-800 bg-ink-900',
    keyline: 'h-1 w-full',
    body: 'items-center gap-2 p-6',
    title: 'font-display text-base text-ink-50',
    note: 'text-center text-sm text-silver-300 md:text-base',
  },
  variants: { tone: toneVariants((c) => ({ keyline: c.face })) },
});

/**
 * Recording is native-only.
 *
 * `react-native-audio-api`'s recorder takes a microphone session through the
 * platform, not `MediaRecorder`, so there is nothing here to drive it. Rather
 * than ship controls that cannot record, this states the limit: a disabled
 * button with no explanation is worse than an absent feature.
 */
export function VoiceRecorder({ tone, district, className }: VoiceRecorderProps) {
  const t = resolveControlTone(tone, district);
  const s = panel({ tone: t });
  return (
    <View className={s.root({ className })}>
      <View aria-hidden className={s.keyline()} />
      <View className={s.body()}>
        <Mic size={24} className={TONE_CLASSES[t].text} />
        <Text className={s.title()}>Record in the app</Text>
        <Text className={s.note()}>Voice notes can be recorded in the mobile app.</Text>
      </View>
    </View>
  );
}
