'use client';
import { type ComponentProps, type ComponentType, type CSSProperties, type HTMLAttributes, type MouseEvent } from 'react';
import { StyleSheet, type GestureResponderEvent } from 'react-native';
import { useInstanceStore, useStore } from '../use-instance-store';
import { Button } from '../html';
import { studioDirectionClass, studioDomStyle } from './style';
import type { StudioPressableProps } from './types';

// These are real DOM attributes forwarded by html/Button's web fork; the
// bridge supplies their state instead of replacing the button with another UI.
type WebButtonProps = Omit<ComponentProps<typeof Button>, 'style' | 'children' | 'onPress' | 'onKeyDown'>
  & Pick<HTMLAttributes<HTMLButtonElement>, 'onPointerDown' | 'onPointerUp' | 'onPointerCancel' | 'onPointerLeave' | 'onBlur' | 'onKeyDown' | 'onKeyUp'>
  & { style?: CSSProperties; children?: React.ReactNode; onPress?: (event: MouseEvent<HTMLButtonElement>) => void; 'data-testid'?: string; 'aria-pressed'?: boolean; 'aria-expanded'?: boolean };
const CanonicalButton = Button as ComponentType<WebButtonProps>;

/** Resolve RN pressed render callbacks while rendering the kit's actual HTML button. */
export function StudioPressable({ children, style, onPress, disabled, accessibilityLabel, accessibilityRole,
  accessibilityState, accessibilityHint, testID, className, onKeyDown, ...rest }: StudioPressableProps) {
  const store = useInstanceStore(() => ({ pressed: false }));
  const pressed = useStore(store, s => s.pressed);
  const unavailable = disabled ?? accessibilityState?.disabled ?? false;
  const state = { pressed: !unavailable && pressed };
  const resolved = typeof style === 'function' ? style(state) : style;
  const flat = StyleSheet.flatten(resolved) ?? {};
  const content = typeof children === 'function' ? children(state) : children;
  const release = () => store.setState({ pressed: false });
  return <CanonicalButton
    {...(rest as ComponentProps<typeof Button>)}
    className={[className, studioDirectionClass(flat.flexDirection)].filter(Boolean).join(' ')}
    role={accessibilityRole}
    disabled={unavailable}
    accessibilityLabel={accessibilityLabel}
    accessibilityHint={accessibilityHint}
    aria-pressed={accessibilityState?.selected}
    aria-expanded={accessibilityState?.expanded}
    data-testid={testID}
    style={studioDomStyle({ display: 'flex', ...flat }) as CSSProperties}
    onPress={event => { release(); if (!unavailable) onPress?.(event as unknown as GestureResponderEvent); }}
    onPointerDown={() => { if (!unavailable) store.setState({ pressed: true }); }}
    onPointerUp={release} onPointerCancel={release} onPointerLeave={release} onBlur={release}
    onKeyDown={event => { if (!unavailable && (event.key === ' ' || event.key === 'Enter')) store.setState({ pressed: true }); onKeyDown?.(event as unknown as Parameters<NonNullable<StudioPressableProps['onKeyDown']>>[0]); }}
    onKeyUp={release}
  >{content}</CanonicalButton>;
}
