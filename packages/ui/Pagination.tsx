'use client';
import { tv } from 'tailwind-variants';
import { Nav } from './primitives';
import { View, Text } from './tw';
import { Button } from './Button';
import { Select } from './Select';
import { useSizeClass } from './use-size-class';
import type { ControlTone, District } from './district';

/**
 * Server paging for the ops console (04-components.md G3): "Showing 51–100 of
 * 1,204", 44 px Previous / Next buttons and a page-size select. At the
 * `compact` window class it collapses to Previous / Next plus "Page 2 of 25"
 * — page size stays reachable on the server, just not on the phone chrome.
 */
const pagination = tv({
  slots: {
    root: 'w-full flex-row flex-wrap items-center justify-between gap-3 py-2',
    status: 'text-sm text-text-muted',
    controls: 'flex-row items-center gap-2',
    pageSize: 'w-36',
  },
});

export interface PaginationProps {
  /** Current page, 1-based. */
  page: number;
  pageCount: number;
  totalCount: number;
  pageSize: number;
  pageSizeOptions?: readonly number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  /** Colour family for the buttons. Overrides `district`. */
  tone?: ControlTone;
  /** Theme by neighbourhood. Default midtown (orange). */
  district?: District;
  className?: string;
}

export function Pagination({
  page, pageCount, totalCount, pageSize, pageSizeOptions,
  onPageChange, onPageSizeChange, tone, district, className,
}: PaginationProps) {
  const sizeClass = useSizeClass();
  const s = pagination();
  const compact = sizeClass === 'compact';
  const safeCount = Math.max(1, pageCount);
  const current = Math.min(Math.max(1, page), safeCount);
  const first = totalCount === 0 ? 0 : (current - 1) * pageSize + 1;
  const last = Math.min(totalCount, current * pageSize);

  return (
    <Nav aria-label="Pagination" className={s.root({ className })}>
      {compact ? (
        <Text className={s.status()}>{`Page ${current} of ${safeCount}`}</Text>
      ) : (
        <Text className={s.status()}>
          {`Showing ${first.toLocaleString()}\u2013${last.toLocaleString()} of ${totalCount.toLocaleString()}`}
        </Text>
      )}
      <View className={s.controls()}>
        <Button
          title="Previous"
          variant="outline"
          size="sm"
          tone={tone}
          district={district}
          disabled={current <= 1}
          onPress={() => onPageChange(current - 1)}
        />
        <Button
          title="Next"
          variant="outline"
          size="sm"
          tone={tone}
          district={district}
          disabled={current >= safeCount}
          onPress={() => onPageChange(current + 1)}
        />
      </View>
      {!compact && pageSizeOptions && onPageSizeChange ? (
        <View className={s.pageSize()}>
          <Select
            label="Rows per page"
            value={String(pageSize)}
            onValueChange={(text) => onPageSizeChange(Number(text))}
            options={pageSizeOptions.map((n) => ({ value: String(n), label: String(n) }))}
            tone={tone}
            district={district}
          />
        </View>
      ) : null}
    </Nav>
  );
}
