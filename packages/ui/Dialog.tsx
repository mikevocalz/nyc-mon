'use client';
import { tv } from 'tailwind-variants';
import { Modal } from 'react-native';
import { View, Text, Pressable } from './tw';
import { ScaleIn, SlideUp } from './motion';
import { X } from './icons';
import { Heading } from './html';
import { TONE_CLASSES, resolveAccent, resolveTone, type District, type Tone } from './district';
import type { NeonColorInput } from './neon/colors';

const dialog = tv({
  slots: {
    // Modal content is portal-rendered; the wrapper centers the surface.
    wrapper: 'flex-1 items-center justify-center p-6',
    scrim: 'absolute inset-0 bg-ink-950/60 backdrop-blur-[2px]',
    card: 'w-full max-w-content-form rounded-sheet border-2 border-border bg-surface-raised p-6 shadow-overlay',
    title: 'font-display text-xl font-semibold text-text',
    description: 'mt-2 text-base text-text-muted',
    body: 'mt-4',
    actions: 'mt-6 flex-row items-center justify-end gap-3',
  },
});

/**
 * The neon variant: a building facade. A cornice with dentils caps it, the
 * title hangs on a storefront sign band, a row of windows sits under the
 * cornice, and the actions stand on the stoop. Ported from NeonBlade UI's
 * NeonModal (MIT, see THIRD-PARTY-NOTICES.md), keeping its size, corner-free
 * glow and footer-align props.
 */
const facade = tv({
  slots: {
    card: 'w-full self-center',
    cornice: 'h-3 border-2 border-b-0 border-ink-950 -mx-2',
    dentils: 'flex-row justify-between px-3',
    dentil: 'h-1.5 w-2',
    face: 'border-x-4 border-b-4 bg-ink-900',
    windows: 'flex-row gap-1.5 px-4 pt-3',
    window: 'h-3 flex-1 border border-ink-950',
    sign: 'mx-4 mt-3 flex-row items-center gap-2 border-2 border-ink-950 px-3 py-2',
    title: 'my-0 flex-1 font-display text-xl leading-tight',
    close: 'h-9 w-9 items-center justify-center rounded-xs border-2 border-ink-950 bg-ink-950/20',
    description: 'px-5 pt-3 text-base leading-snug text-silver-300',
    body: 'px-5 pt-4',
    stoop: 'mt-5 flex-row flex-wrap items-center gap-3 border-t-4 bg-ink-950 px-5 py-4',
  },
  variants: {
    size: {
      xs: { card: 'max-w-[380px]' },
      sm: { card: 'max-w-[480px]' },
      md: { card: 'max-w-[560px]' },
      lg: { card: 'max-w-[680px]' },
      xl: { card: 'max-w-[820px]' },
      full: { card: 'max-w-none' },
    },
    footerAlign: {
      left: { stoop: 'justify-start' },
      center: { stoop: 'justify-center' },
      right: { stoop: 'justify-end' },
      between: { stoop: 'justify-between' },
    },
  },
});

// Which windows are lit: a fixed pattern so the facade doesn't change between renders.
const WINDOWS = [true, false, true, true, false, true, false, true];

export interface DialogCardProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  /** default: the kit dialog. neon: the NYC-MON building facade. */
  variant?: 'default' | 'neon';
  /** neon: colour by neighbourhood. Default midtown. */
  district?: District;
  /** neon: brand token or NeonBlade preset; overrides the district. */
  color?: NeonColorInput | Tone;
  /** neon: max width, 380 to 820 px or full. Default md. */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** neon: entrance. Default scale. */
  animation?: 'scale' | 'slide' | 'none';
  /** neon: accent glow around the facade. Default true. */
  glow?: boolean;
  /** neon: action alignment on the stoop. Default right. */
  footerAlign?: 'left' | 'center' | 'right' | 'between';
  /** neon: shows a close control on the sign when set. */
  onClose?: () => void;
}

/**
 * The presentational dialog surface — exported separately so it can render
 * inline (e.g. in Storybook) without the RN Modal portal.
 */
export function DialogCard(props: DialogCardProps) {
  if (props.variant === 'neon') return <FacadeCard {...props} />;
  const { title, description, children, actions, className } = props;
  const s = dialog();
  return (
    <ScaleIn role="dialog" aria-modal aria-label={title} className={s.card({ className })}>
      <Text className={s.title()}>{title}</Text>
      {description ? <Text className={s.description()}>{description}</Text> : null}
      {children ? <View className={s.body()}>{children}</View> : null}
      {actions ? <View className={s.actions()}>{actions}</View> : null}
    </ScaleIn>
  );
}

function FacadeCard({
  title, description, children, actions, className,
  district = 'midtown', color, size = 'md', animation = 'scale', glow = true, footerAlign = 'right', onClose,
}: DialogCardProps) {
  const toneName = resolveTone(district, color);
  const t = TONE_CLASSES[toneName];
  const a = TONE_CLASSES[resolveAccent(district, toneName)];
  const s = facade({ size, footerAlign });
  const Shell = animation === 'slide' ? SlideUp : animation === 'scale' ? ScaleIn : View;

  return (
    <Shell role="dialog" aria-modal aria-label={title} className={s.card({ className: `${glow ? t.glow : ''} ${className ?? ''}` })}>
      <View aria-hidden className={s.cornice({ className: t.side })} />
      <View aria-hidden className={s.dentils()}>
        {Array.from({ length: 12 }, (_, i) => (
          <View key={i} className={s.dentil({ className: t.deep })} />
        ))}
      </View>
      <View className={s.face({ className: t.border })}>
        <View aria-hidden className={s.windows()}>
          {WINDOWS.map((lit, i) => (
            <View key={i} className={s.window({ className: lit ? t.light : 'bg-ink-800' })} />
          ))}
        </View>
        <View className={s.sign({ className: a.face })}>
          <Heading level={2} className={s.title({ className: a.on })}>{title}</Heading>
          {onClose ? (
            <Pressable role="button" aria-label="Close" onPress={onClose} className={s.close()}>
              <X size={18} className={a.on} />
            </Pressable>
          ) : null}
        </View>
        {description ? <Text className={s.description()}>{description}</Text> : null}
        {children ? <View className={s.body()}>{children}</View> : null}
        {actions ? <View className={s.stoop({ className: t.border })}>{actions}</View> : <View className="h-5" />}
      </View>
    </Shell>
  );
}

export interface DialogProps extends DialogCardProps {
  open: boolean;
  onClose: () => void;
  /** neon: show the close control on the sign. Default true. */
  showCloseButton?: boolean;
  /** Close when the scrim is pressed. Default true. */
  closeOnBackdrop?: boolean;
}

export function Dialog({ open, onClose, showCloseButton = true, closeOnBackdrop = true, ...cardProps }: DialogProps) {
  const s = dialog();
  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={onClose}>
      <View className={s.wrapper()}>
        <Pressable
          aria-label="Close dialog"
          onPress={closeOnBackdrop ? onClose : undefined}
          className={s.scrim()}
        />
        <DialogCard {...cardProps} onClose={cardProps.variant === 'neon' && showCloseButton ? onClose : undefined} />
      </View>
    </Modal>
  );
}
