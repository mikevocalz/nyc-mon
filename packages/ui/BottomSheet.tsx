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
    content: 'h-full flex-1',
    cornice: 'h-3 items-center justify-center',
    handle: 'h-1 w-12',
    dentils: 'flex-row justify-between px-4',
    dentil: 'h-1.5 w-2',
    inner: 'flex-1 px-4 pb-6 pt-3',
    header: 'mb-3 min-h-11 flex-row items-center justify-between gap-3',
    title: 'my-0 flex-1 font-display text-xl leading-tight md:text-2xl',
    close:
      'h-11 w-11 items-center justify-center border-2 transition-colors duration-fast ' +
      'active:opacity-80 motion-reduce:transition-none',
    closeIcon: '',
  },
  variants: {
    // night: the facade in both schemes (scoped dark). system: the page's own
    // scheme, white raised face in daylight, night after dark.
    scheme: {
      night: {
        content: `${NIGHT_SCHEME} bg-ink-900`,
        title: 'text-ink-50',
        close: 'border-ink-700 bg-ink-950 hover:border-ink-400',
        closeIcon: 'text-ink-50',
      },
      system: {
        content: 'bg-surface-raised',
        title: 'text-text',
        close: 'border-border-strong bg-surface-raised hover:bg-surface-sunken',
        closeIcon: 'text-text',
      },
    },
  },
  defaultVariants: { scheme: 'night' },
});

/** `night`: the night facade whatever the OS says (default). `system`: follows the page's light/dark scheme. */
export type SheetScheme = 'night' | 'system';

/** Close is all or nothing: a handler always comes with its spoken label. */
type SheetClose =
  | {
      onClose: () => void;
      /** Accessible name of the close control. The caller supplies the copy (i18n). */
      closeLabel: string;
    }
  | { onClose?: undefined; closeLabel?: undefined };

export type SheetSurfaceProps = SheetClose & {
  title?: string;
  children: React.ReactNode;
  className?: string;
  /** Default `night`. */
  scheme?: SheetScheme;
  /** Cornice colour by neighbourhood. Default midtown (orange). */
  district?: District;
  /** Cornice colour; overrides the district. */
  tone?: ControlTone;
};

/**
 * The presentational sheet surface — exported separately so it can render
 * inline (e.g. in Storybook) without the sheet portal.
 */
export function SheetSurface({ title, children, className, onClose, closeLabel, scheme = 'night', district, tone }: SheetSurfaceProps) {
  const t = TONE_CLASSES[resolveControlTone(tone, district)];
  const s = sheet({ scheme });
  const face = (
    <View role="dialog" aria-modal={true} aria-label={title} className={s.content({ className })}>
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
              <Pressable onPress={onClose} accessibilityLabel={closeLabel} role="button" className={s.close({ className: t.focusBorder })}>
                <X size={18} className={s.closeIcon()} />
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
  );
  // Native needs the dark theme scoped for the night facade; `system` reads the page's scheme.
  return scheme === 'night' ? <NightScope>{face}</NightScope> : face;
}

export type BottomSheetProps = Omit<SheetSurfaceProps, 'onClose' | 'closeLabel'> & {
  open: boolean;
  onClose: () => void;
  /** Accessible name of the close control. The caller supplies the copy (i18n). */
  closeLabel: string;
};

export function BottomSheet({ open, onClose, closeLabel, ...surfaceProps }: BottomSheetProps) {
  return (
    <ExpoBottomSheet isPresented={open} onDismiss={onClose} snapPoints={SNAP_POINTS}>
      <SheetSurface {...surfaceProps} onClose={onClose} closeLabel={closeLabel} />
    </ExpoBottomSheet>
  );
}
