'use client';
import { tv } from 'tailwind-variants';
import { View, Text } from './tw';
import { Button } from './Button';
import type { ControlTone, District } from './district';

/**
 * Masked PII with a reveal affordance (04-components.md G6). A discriminated
 * state — the component holds no business state (Law 4): the screen's store
 * owns which fields are revealed, the reveal goes through the reason dialog
 * and the `console/reveal` endpoint, and navigation away re-masks.
 */
const masked = tv({
  slots: {
    root: 'flex-row items-center gap-3',
    value: 'min-w-0 flex-1 text-base',
  },
  variants: {
    surface: {
      page: { value: 'text-text' },
      night: { value: 'text-silver-100' },
    },
  },
  defaultVariants: { surface: 'page' },
});

export type MaskedValueProps = { surface?: 'page' | 'night'; tone?: ControlTone; district?: District; className?: string } & (
  | {
      state: 'masked';
      /** The mask string the server sent, e.g. "d•••@g•••.com" or "Hidden". */
      mask: string;
      /** Open the reason dialog; the screen calls console/reveal on confirm. */
      onRevealRequest: () => void;
    }
  | {
      state: 'revealed';
      /** The revealed value, cleared when the route changes. */
      value: string;
      onHide: () => void;
    }
);

export function MaskedValue(props: MaskedValueProps) {
  const s = masked({ surface: props.surface ?? 'page' });
  return (
    <View className={s.root({ className: props.className })}>
      {props.state === 'masked' ? (
        <>
          <Text className={s.value()}>{props.mask}</Text>
          <Button
            title="Show"
            variant="ghost"
            size="sm"
            tone={props.tone}
            district={props.district}
            onPress={props.onRevealRequest}
            aria-label="Show value"
          />
        </>
      ) : (
        <>
          <Text className={s.value()}>{props.value}</Text>
          <Button
            title="Hide"
            variant="ghost"
            size="sm"
            tone={props.tone}
            district={props.district}
            onPress={props.onHide}
            aria-label="Hide value"
          />
        </>
      )}
    </View>
  );
}
