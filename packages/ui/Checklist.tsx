'use client';
import { createContext, useContext, type ReactNode } from 'react';
import { tv } from 'tailwind-variants';
import { OrderedList } from './primitives';
import { View, Text } from './tw';
import { Link } from './html';
import { Check, TriangleAlert, Info, LoaderCircle, Minus } from './icons';

/**
 * Integrity checks on the Mons screen (04-components.md G12): an <ol> of
 * CheckRows, each carrying an icon AND a word — "Passing", "Failing",
 * "Checking", "Unavailable" — never colour alone. Failing rows link to the
 * records that failed.
 */
const check = tv({
  slots: {
    list: 'w-full flex-col',
    row: 'min-h-11 flex-row items-center gap-3 border-b border-border px-3 py-2 last:border-b-0',
    icon: 'h-8 w-8 items-center justify-center border-2',
    body: 'min-w-0 flex-1',
    label: 'text-base',
    detail: 'text-sm',
    result: 'font-display text-sm',
  },
  variants: {
    kind: {
      pass: { icon: 'border-leaf-700 bg-leaf-600 text-white', result: 'text-tone-leaf-text' },
      fail: { icon: 'border-apple-700 bg-apple-600 text-white', result: 'text-tone-apple-text' },
      info: { icon: 'border-carolina-700 bg-carolina-600 text-white', result: 'text-tone-carolina-text' },
      pending: { icon: 'border-border bg-surface-sunken text-text-muted', result: 'text-text-muted' },
      unavailable: { icon: 'border-border bg-surface-sunken text-text-muted', result: 'text-text-muted' },
    },
    surface: {
      page: { label: 'text-text', detail: 'text-text-muted' },
      night: { label: 'text-silver-100', detail: 'text-silver-400', row: 'border-ink-800' },
    },
  },
  defaultVariants: { surface: 'page' },
});

export type CheckResult =
  | { kind: 'pass'; count: 0 }
  | { kind: 'fail'; count: number }
  | { kind: 'info'; count: number }
  | { kind: 'pending' }
  | { kind: 'unavailable'; reason: string };

const RESULT_WORD: Record<CheckResult['kind'], string> = {
  pass: 'Passing', fail: 'Failing', info: 'Note', pending: 'Checking', unavailable: 'Unavailable',
};

function resultIcon(result: CheckResult): ReactNode {
  switch (result.kind) {
    case 'pass': return <Check size={16} />;
    case 'fail': return <TriangleAlert size={16} />;
    case 'info': return <Info size={16} />;
    case 'pending': return <LoaderCircle size={16} />;
    case 'unavailable': return <Minus size={16} />;
  }
}

function resultText(result: CheckResult): string {
  if (result.kind === 'unavailable') return `${RESULT_WORD.unavailable} — ${result.reason}`;
  if (result.kind === 'pending') return RESULT_WORD.pending;
  if (result.count === 0) return RESULT_WORD[result.kind];
  return `${RESULT_WORD[result.kind]} (${result.count})`;
}

// The list's surface reaches its rows without every CheckRow taking a prop.
const ChecklistSurface = createContext<'page' | 'night'>('page');

export interface CheckRowProps {
  label: string;
  result: CheckResult;
  detail?: string;
  /** Where the failing records live; renders the row as a link. */
  href?: string;
  /** 'page' (default, or the Checklist's); 'night' is the night facade. */
  surface?: 'page' | 'night';
  className?: string;
}

export function CheckRow({ label, result, detail, href, surface, className }: CheckRowProps) {
  const inherited = useContext(ChecklistSurface);
  const s = check({ kind: result.kind, surface: surface ?? inherited });
  const inner = (
    <>
      <View aria-hidden className={s.icon()}>{resultIcon(result)}</View>
      <View className={s.body()}>
        <Text className={s.label()}>{label}</Text>
        {detail ? <Text className={s.detail()}>{detail}</Text> : null}
      </View>
      <Text className={s.result()}>{resultText(result)}</Text>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={`${s.row()} no-underline ${className ?? ''}`}>
        {inner}
      </Link>
    );
  }
  return <View className={s.row({ className })}>{inner}</View>;
}

export interface ChecklistProps {
  children?: ReactNode;
  /** 'page' (default) follows the scheme; 'night' is the night facade. */
  surface?: 'page' | 'night';
  className?: string;
}

/** The ordered list of integrity checks; children are `CheckRow`s. */
export function Checklist({ children, surface = 'page', className }: ChecklistProps) {
  const s = check({ surface });
  return (
    <OrderedList className={s.list({ className })}>
      <ChecklistSurface.Provider value={surface}>{children}</ChecklistSurface.Provider>
    </OrderedList>
  );
}
