'use client';
import { useEffect } from 'react';
import { Modal } from 'react-native';
import { SolitoImage } from 'solito/image';
import { useInstanceStore, useStore } from './use-instance-store';
import { tv } from 'tailwind-variants';
import { View, Text, Pressable } from './tw';
import { ChevronLeft, ChevronRight, X } from './icons';
import { TONE_CLASSES, resolveControlTone, type ControlTone, type District } from './district';

/**
 * NYC-MON lightbox chrome: square night tiles with a heavy keyline for close
 * and the arrows (the keyline brightens on hover and takes the tone on
 * keyboard focus), square
 * pips for the position, and a counter in the display face. The photo
 * itself is never tinted.
 */
const box = tv({
  slots: {
    scrim: 'flex-1 bg-ink-950/95',
    tile:
      'h-11 w-11 items-center justify-center border-2 border-ink-700 bg-ink-900 transition-colors duration-fast hover:border-ink-400 ' +
      'active:opacity-80 motion-reduce:transition-none',
    close: 'absolute right-4 top-4 z-10',
    side: 'absolute bottom-0 top-0 z-10 w-16 justify-center',
    disabled: 'opacity-30',
    footer: 'absolute inset-x-0 bottom-6 items-center gap-3',
    pips: 'flex-row justify-center gap-1.5',
    pip: 'h-2 w-2',
    counter: 'font-display text-sm text-ink-50',
  },
});

export interface LightboxProps {
  images: string[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
  /** Accent (hover/focus ring, active pip) by neighbourhood. Default midtown. */
  district?: District;
  /** Accent tone; overrides the district. */
  tone?: ControlTone;
}

export function Lightbox({ images, initialIndex = 0, open, onClose, district, tone }: LightboxProps) {
  const store = useInstanceStore<{ index: number }>(() => ({ index: initialIndex }));
  const index = useStore(store, (s) => s.index);
  const setIndex = (updater: (i: number) => number) =>
    store.setState((s) => ({ index: updater(s.index) }));

  // Re-sync when reopened on a different image — initialIndex is otherwise
  // only read at mount.
  useEffect(() => {
    if (open) store.setState({ index: initialIndex });
  }, [open, initialIndex, store]);

  const count = images.length;

  // Keyboard navigation (web): ← → move, Escape closes. Native uses the
  // on-screen arrows and the Modal back handler.
  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') store.setState((s) => ({ index: Math.max(0, s.index - 1) }));
      else if (e.key === 'ArrowRight') store.setState((s) => ({ index: Math.min(count - 1, s.index + 1) }));
      else if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, count, onClose, store]);

  if (!images.length) return null;
  const current = images[index] ?? '';
  const hasMultiple = images.length > 1;

  const t = TONE_CLASSES[resolveControlTone(tone, district)];
  const s = box();
  const tile = s.tile({ className: t.focusBorder });

  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={onClose}>
      <View className={s.scrim()}>
        <Pressable onPress={onClose} accessibilityLabel="Close image" role="button" className={`${s.close()} ${tile}`}>
          <X size={20} className="text-ink-50" />
        </Pressable>

        {hasMultiple ? (
          <View className={`${s.side()} left-0 pl-4`}>
            <Pressable
              onPress={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              accessibilityLabel="Previous image"
              role="button"
              className={`${tile} ${index === 0 ? s.disabled() : ''}`}
            >
              <ChevronLeft size={22} className="text-ink-50" />
            </Pressable>
          </View>
        ) : null}

        <SolitoImage src={current} alt="" fill unoptimized contentFit="contain" sizes="100vw" />

        {hasMultiple ? (
          <View className={`${s.side()} right-0 items-end pr-4`}>
            <Pressable
              onPress={() => setIndex((i) => Math.min(images.length - 1, i + 1))}
              disabled={index === images.length - 1}
              accessibilityLabel="Next image"
              role="button"
              className={`${tile} ${index === images.length - 1 ? s.disabled() : ''}`}
            >
              <ChevronRight size={22} className="text-ink-50" />
            </Pressable>
          </View>
        ) : null}

        {hasMultiple ? (
          <View className={s.footer()}>
            <View aria-hidden className={s.pips()}>
              {images.map((_, i) => (
                <View key={i} className={s.pip({ className: i === index ? t.face : 'bg-ink-600' })} />
              ))}
            </View>
            <Text className={s.counter()}>{`${index + 1} / ${count}`}</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
