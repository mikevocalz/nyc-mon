'use client';
import { tv } from 'tailwind-variants';
import { BottomSheet as ExpoBottomSheet } from '@expo/ui';
import { ScrollView, View, Pressable } from './tw';
import { Heading } from './html';
import { X } from './icons';
import { NIGHT_SCHEME, NightScope } from './NightScope';
import { TONE_CLASSES, resolveControlTone, type ControlTone, type District } from './district';

// Expo UI's universal sheet: vaul on web (real drag physics), SwiftUI /
// Material sheets on native. Two snap points — 55% and 85%, never full
// screen — driven by dragging the grabber.
const SNAP_POINTS = [{ fraction: 0.55 }, { fraction: 0.85 }];

/**
 * The NYC-MON sheet surface: a night facade rising from the bottom. A solid
 * tone cornice caps it with the grab handle set into it, a dentil row hangs
 * under the cornice, the title is in the display face and close is a square
 * night tile. The sheet chrome around it (drag, snap, scrim) stays the
 * platform's: vaul on web, SwiftUI / Material sheets on native.
 */
const sheet = tv({
  slots: {
    content: 'h-full flex-1 bg-ink-900',
    cornice: 'h-3 items-center justify-center',
    handle: 'h-1 w-12',
    dentils: 'flex-row justify-between px-4',
    dentil: 'h-1.5 w-2',
    inner: 'flex-1 px-4 pb-6 pt-3',
    header: 'mb-3 min-h-11 flex-row items-center justify-between gap-3',
    title: 'my-0 flex-1 font-display text-xl leading-tight text-ink-50 md:text-2xl',
    close:
      'h-11 w-11 items-center justify-center border-2 border-ink-700 bg-ink-950 transition-colors duration-fast ' +
      'hover:border-ink-400 active:opacity-80 motion-reduce:transition-none',
  },
});

export interface SheetSurfaceProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
  /** Cornice colour by neighbourhood. Default midtown (orange). */
  district?: District;
  /** Cornice colour; overrides the district. */
  tone?: ControlTone;
}

/**
 * The presentational sheet surface — exported separately so it can render
 * inline (e.g. in Storybook) without the sheet portal.
 */
export function SheetSurface({ title, children, className, onClose, district, tone }: SheetSurfaceProps) {
  const t = TONE_CLASSES[resolveControlTone(tone, district)];
  const s = sheet();
  return (
    <NightScope>
      <View role="dialog" aria-label={title} className={s.content({ className: `${NIGHT_SCHEME} ${className ?? ''}` })}>
        <View aria-hidden className={s.cornice({ className: t.face })}>
          <View className={s.handle({ className: t.side })} />
        </View>
        <View aria-hidden className={s.dentils()}>
          {Array.from({ length: 10 }, (_, i) => <View key={i} className={s.dentil({ className: t.side })} />)}
        </View>
        <View className={s.inner()}>
          <View className={s.header()}>
            {title ? <Heading level={2} className={s.title()}>{title}</Heading> : <View className="flex-1" />}
            {onClose ? (
              <Pressable onPress={onClose} accessibilityLabel="Close" role="button" className={s.close({ className: t.focusBorder })}>
                <X size={18} className="text-ink-50" />
              </Pressable>
            ) : null}
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="pb-2"
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </NightScope>
  );
}

export interface BottomSheetProps extends SheetSurfaceProps {
  open: boolean;
  onClose: () => void;
}

export function BottomSheet({ open, onClose, ...surfaceProps }: BottomSheetProps) {
  return (
    <ExpoBottomSheet isPresented={open} onDismiss={onClose} snapPoints={SNAP_POINTS}>
      <SheetSurface {...surfaceProps} onClose={onClose} />
    </ExpoBottomSheet>
  );
}
