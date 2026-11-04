'use client';
import { tv } from 'tailwind-variants';
import { DescriptionDetails, DescriptionList, DescriptionTerm } from './primitives';
import { View } from './tw';
import { Badge } from './Badge';
import { useLayoutSize } from './use-layout-size';
import { keyValueListColumns, keyValuePairClassName } from './key-value-list-layout';
import type { ReactNode } from 'react';

/**
 * Record key/value pairs for the console detail pane (04-components.md G5): a
 * semantic <dl>, two columns from 600 px of pane width and one below, a pair
 * never splitting across a column or a fold segment (CSS break-inside).
 * A null value renders the `TODO(canon)` badge — the record is on file but
 * the field is not (05-copy.md).
 */
const kv = tv({
  slots: {
    root: 'w-full flex-col',
    grid: 'w-full gap-y-4',
    pair: 'box-border min-w-0 flex-col gap-0.5',
    term: 'text-sm text-text-muted',
    details: 'flex-row items-center gap-2 text-base text-text',
    action: 'shrink-0',
  },
  variants: {
    columns: {
      1: { grid: 'flex-col' },
      // The measured pane owns the breakpoint, independently of the viewport.
      2: { grid: 'flex-row flex-wrap' },
    },
    surface: {
      page: {},
      night: { term: 'text-silver-400', details: 'text-silver-100' },
    },
  },
  defaultVariants: { columns: 1, surface: 'page' },
});

export interface KeyValueItem {
  key: string;
  label: string;
  /** The rendered value; null draws the TODO(canon) badge. */
  value: ReactNode;
  /** A control beside the value (CopyButton, MaskedValue's Show). */
  action?: ReactNode;
}

export interface KeyValueListProps {
  items: readonly KeyValueItem[];
  /** Two columns from 600 px pane width; the prop caps it at one. Default 2. */
  columns?: 1 | 2;
  /** 'page' (default) follows the scheme; 'night' is the night facade. */
  surface?: 'page' | 'night';
  className?: string;
}

export function KeyValueList({ items, columns = 2, surface = 'page', className }: KeyValueListProps) {
  // Start with one column for SSR and until this instance is measured.
  const { size, onLayout } = useLayoutSize({ width: 0, height: 0 });
  const resolvedColumns = keyValueListColumns(size.width, columns);
  const s = kv({ columns: resolvedColumns, surface });
  return (
    <View className={s.root({ className })}>
      {/* Measure usable content, excluding padding supplied on the root. */}
      <View onLayout={onLayout} className="w-full">
        <DescriptionList className={s.grid()}>
          {items.map((item, index) => (
            <View
              key={item.key}
              className={s.pair({ className: keyValuePairClassName(resolvedColumns, index) })}
              // CSS break-inside keeps a pair whole across columns and fold segments.
              style={{ breakInside: 'avoid' } as object}
            >
              <DescriptionTerm className={s.term()}>{item.label}</DescriptionTerm>
              <DescriptionDetails className={s.details()}>
                {item.value === null || item.value === undefined ? (
                  <Badge label="TODO(canon)" tone="neutral" />
                ) : (
                  item.value
                )}
                {item.action ? <View className={s.action()}>{item.action}</View> : null}
              </DescriptionDetails>
            </View>
          ))}
        </DescriptionList>
      </View>
    </View>
  );
}
