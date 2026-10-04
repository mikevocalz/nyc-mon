'use client';
/**
 * PLATFORM FORK — justification (§7): these tags have no react-native-web
 * mapping (figcaption, address, details, summary, fieldset, legend, select)
 * or the RNW rendering is not the real element (pressable → div). The web
 * build emits the real DOM elements directly — native controls on web.
 *
 * react-native-css's web useCssElement moves className into a styleq-style
 * `style` array ({$$css:true, className} entries) that only RNW components
 * decode — toDom() decodes it back for raw DOM elements. Direct callers can
 * still pass a plain className string; both merge.
 */
import React from 'react';

type StyleqEntry = { $$css?: boolean; [key: string]: unknown } | React.CSSProperties;
type WebStyle = StyleqEntry | (StyleqEntry | null | undefined)[] | null | undefined;

// Decode a styleq `style` value into DOM className + inline style.
const toDom = (className?: string, style?: WebStyle) => {
  const classes: string[] = className ? [className] : [];
  const css: Record<string, unknown> = {};
  const visit = (s: WebStyle) => {
    if (!s) return;
    if (Array.isArray(s)) return s.forEach(visit);
    const entry = s as Record<string, unknown>;
    if (entry.$$css) {
      for (const [k, v] of Object.entries(entry)) {
        if (k !== '$$css' && typeof v === 'string') classes.push(v);
      }
    } else {
      Object.assign(css, entry);
    }
  };
  visit(style);
  return {
    className: classes.length ? classes.join(' ') : undefined,
    style: Object.keys(css).length ? (css as React.CSSProperties) : undefined,
  };
};

type P = { className?: string; style?: WebStyle; children?: React.ReactNode };

const dom = <T extends P>(Tag: string) => {
  const Component = ({ className, style, ...props }: T) =>
    React.createElement(Tag, { ...toDom(className, style), ...props });
  Component.displayName = `Dom(${Tag})`;
  return Component;
};

export const FigcaptionBase = dom('figcaption');
export const AddressBase = dom('address');
export const DetailsBase = dom<P & { open?: boolean }>('details');
export const SummaryBase = dom('summary');
export const FieldsetBase = dom<P & { disabled?: boolean }>('fieldset');
export const LegendBase = dom('legend');
export const SelectBase = (
  props: P & {
    value?: string;
    onValueChange?: (value: string) => void;
    disabled?: boolean;
    'aria-label'?: string;
  },
) => {
  const { onValueChange, className, style, ...rest } = props;
  return <select {...toDom(className, style)} {...rest} onChange={(e) => onValueChange?.(e.target.value)} />;
};

// ---- interactive controls — real DOM elements, RN-style prop surface -------

export interface PressBaseProps extends P {
  onPress?: () => void;
  /** Real <button> on web, so it can be driven from the keyboard. */
  onKeyDown?: (event: React.KeyboardEvent<HTMLElement>) => void;
  disabled?: boolean;
  role?: string;
  'aria-label'?: string;
  'aria-disabled'?: boolean;
  'aria-checked'?: boolean;
  'aria-hidden'?: boolean;
  accessibilityLabel?: string;
  accessibilityState?: { checked?: boolean; disabled?: boolean; selected?: boolean };
}

// RN views default to display:flex — raw DOM elements don't, so seed it
// (callers' flex-row / items-* classes expect a flex container).
export const ButtonBase = ({
  onPress, accessibilityLabel, accessibilityState, role, className, style, ...props
}: PressBaseProps) => (
  <button
    type="button"
    // Custom widget roles (radio, tab, switch…) must survive; 'button' is
    // implicit on the element, so only set the attribute when it differs.
    role={role && role !== 'button' ? role : undefined}
    onClick={onPress}
    disabled={props.disabled ?? accessibilityState?.disabled}
    aria-label={props['aria-label'] ?? accessibilityLabel}
    {...toDom(`inline-flex flex-col ${className ?? ''}`, style)}
    {...props}
  />
);

/** What a kit field exposes to its owner: focus, for a clear button that hands focus back. */
export interface InputHandle {
  focus: () => void;
}

export interface InputBaseProps extends P {
  /** Imperative handle (focus). */
  ref?: React.Ref<InputHandle>;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  onChangeText?: (text: string) => void;
  onSubmitEditing?: () => void;
  editable?: boolean;
  secureTextEntry?: boolean;
  returnKeyType?: string;
  placeholderTextColor?: string;
  numberOfLines?: number;
  autoFocus?: boolean;
  maxLength?: number;
  autoCorrect?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  /** RN keyboard hint; maps to `inputMode` on web. */
  keyboardType?: 'default' | 'email-address' | 'number-pad' | 'numeric' | 'decimal-pad' | 'phone-pad' | 'url' | 'web-search' | string;
  /** iOS autofill hint; maps to `autoComplete` on web. */
  textContentType?: string;
  onBlur?: () => void;
  onFocus?: () => void;
  role?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
}

const ENTER_KEY_HINT: Record<string, React.HTMLAttributes<HTMLElement>['enterKeyHint']> = {
  search: 'search', done: 'done', go: 'go', next: 'next', send: 'send',
};

const KEYBOARD_INPUT_MODE: Record<string, React.HTMLAttributes<HTMLInputElement>['inputMode']> = {
  'email-address': 'email',
  'number-pad': 'numeric',
  numeric: 'numeric',
  'decimal-pad': 'decimal',
  'phone-pad': 'tel',
  url: 'url',
  'web-search': 'search',
};

const TEXT_CONTENT_AUTO_COMPLETE: Record<string, string> = {
  emailAddress: 'email',
  username: 'username',
  nickname: 'nickname',
  password: 'current-password',
  newPassword: 'new-password',
  oneTimeCode: 'one-time-code',
  telephoneNumber: 'tel',
  none: 'off',
};

export const InputBase = ({
  ref, onChangeText, onSubmitEditing, editable, secureTextEntry, returnKeyType,
  keyboardType, textContentType, autoCorrect, autoCapitalize,
  placeholderTextColor: _ptc, numberOfLines: _n, role: _role, className, style, ...props
}: InputBaseProps) => {
  const el = React.useRef<HTMLInputElement>(null);
  React.useImperativeHandle(ref, () => ({ focus: () => el.current?.focus() }), []);
  return (
  <input
    ref={el}
    type={secureTextEntry ? 'password' : 'text'}
    readOnly={editable === false}
    enterKeyHint={returnKeyType ? ENTER_KEY_HINT[returnKeyType] : undefined}
    inputMode={keyboardType ? KEYBOARD_INPUT_MODE[keyboardType] : undefined}
    autoComplete={textContentType ? TEXT_CONTENT_AUTO_COMPLETE[textContentType] : undefined}
    autoCorrect={autoCorrect === undefined ? undefined : autoCorrect ? 'on' : 'off'}
    autoCapitalize={autoCapitalize}
    onChange={(e) => onChangeText?.(e.target.value)}
    onKeyDown={(e) => { if (e.key === 'Enter') onSubmitEditing?.(); }}
    {...toDom(className, style)}
    {...props}
  />
  );
};

export const TextareaBase = ({
  ref: _ref, onChangeText, onSubmitEditing: _s, editable, secureTextEntry: _p, returnKeyType: _r,
  keyboardType: _kt, textContentType: _tc, autoCorrect, autoCapitalize,
  placeholderTextColor: _ptc, numberOfLines, role: _role, className, style, ...props
}: InputBaseProps) => (
  <textarea
    readOnly={editable === false}
    rows={numberOfLines}
    autoCorrect={autoCorrect === undefined ? undefined : autoCorrect ? 'on' : 'off'}
    autoCapitalize={autoCapitalize}
    onChange={(e) => onChangeText?.(e.target.value)}
    {...toDom(className, style)}
    {...props}
  />
);

export const LabelBase = dom('label');
const FormPlain = dom('form');
export const FormBase = ({ className, ...props }: P) => (
  <FormPlain className={`flex flex-col ${className ?? ''}`} {...props} />
);


// ---- structure the RNW mapping lacks (04-components.md §4, H1-H6) ----------
// Real elements, seeded as flex columns like the RN views around them, so the
// kit's flex classes keep working on them.

const flexDom = <T extends P>(Tag: string, base: string) => {
  const Plain = dom<T>(Tag);
  const Component = ({ className, ...props }: T) =>
    React.createElement(Plain, { ...props, className: `${base} ${className ?? ''}` } as T);
  Component.displayName = `Dom(${Tag})`;
  return Component;
};

type Labelled = P & { 'aria-label'?: string; 'aria-labelledby'?: string; id?: string };

/** `<figure>`: REPO_MAP gap #12 (RNW has no figure mapping, it rendered a div). */
export const FigureBase = flexDom<Labelled>('figure', 'flex flex-col');
export const DescriptionListBase = flexDom<Labelled>('dl', 'flex flex-col');
export const DescriptionTermBase = dom<P & { id?: string }>('dt');
export const DescriptionDetailsBase = flexDom<P & { id?: string }>('dd', 'flex flex-col');
export const OrderedListBase = flexDom<Labelled & { start?: number; reversed?: boolean }>('ol', 'flex flex-col');
export const TableCaptionBase = dom<P & { id?: string }>('caption');
/** The `<search>` landmark (HTML living standard). */
export const SearchBase = flexDom<Labelled>('search', 'flex flex-col');
/**
 * `<output>`: the live result of a calculation or check. Browsers expose it
 * as a polite live region (role="status").
 */
export const OutputBase = dom<P & { id?: string; htmlFor?: string; 'aria-live'?: 'polite' | 'off' }>('output');

/**
 * Text read by assistive technology and invisible on screen: the clip pattern
 * (same declarations as Tailwind's `sr-only`, inline so it holds without the
 * stylesheet and inside any portal).
 */
const VISUALLY_HIDDEN: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', borderWidth: 0,
};
export const VisuallyHiddenBase = ({ children, id }: { children?: React.ReactNode; id?: string }) => (
  <span id={id} style={VISUALLY_HIDDEN}>{children}</span>
);

export type DropSurfaceProps =
  Omit<React.HTMLAttributes<HTMLDivElement>, 'className' | 'style'> &
  P;

/**
 * Browser drag/drop boundary. Raw DOM event types stay inside /ui/html so
 * feature code never imports or renders browser elements directly.
 */
export const DropSurface = ({
  className,
  style,
  ...props
}: DropSurfaceProps) => (
  <div {...toDom(className, style)} {...props} />
);
