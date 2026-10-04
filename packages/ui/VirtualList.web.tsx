'use client';
/**
 * PLATFORM FORK — virtualized list on web via @tanstack/react-virtual.
 * The scroll container is an overflow View (behavioral, like ScrollView);
 * give it a height via className (e.g. "h-96"). Every host is a kit View: on
 * web its ref is the DOM node, which is all the virtualizer needs.
 */
import { useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { View } from './tw';

export interface VirtualListProps<T> {
  data: T[];
  renderItem: (info: { item: T; index: number }) => React.ReactNode;
  keyExtractor?: (item: T, index: number) => string;
  /** Estimated row height in px (rows self-measure after mount). */
  estimatedItemSize?: number;
  /** Scroll container classes — must size the container (e.g. "h-96"). */
  className?: string;
  onEndReached?: () => void;
}

export function VirtualList<T>({
  data,
  renderItem,
  keyExtractor,
  estimatedItemSize = 56,
  className,
  onEndReached,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLElement>(null);
  const endFiredAt = useRef(-1);
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedItemSize,
    overscan: 8,
  });
  const items = virtualizer.getVirtualItems();

  const lastVisible = items[items.length - 1]?.index ?? -1;
  useEffect(() => {
    if (!onEndReached) return;
    if (lastVisible >= data.length - 1 && endFiredAt.current !== data.length) {
      endFiredAt.current = data.length;
      onEndReached();
    }
  }, [lastVisible, data.length, onEndReached]);

  return (
    <View ref={parentRef as never} className={`overflow-y-auto ${className ?? ''}`}>
      <View
        className="relative w-full"
        // Computed geometry: the total height comes from the virtualizer.
        style={{ height: virtualizer.getTotalSize() }}
      >
        {items.map((vi) => {
          const item = data[vi.index] as T;
          return (
            <View
              key={keyExtractor?.(item, vi.index) ?? vi.key}
              // RNW writes dataSet as data-* attributes; measureElement reads
              // data-index. The prop is RNW-only, so it is not in View's types.
              {...({ dataSet: { index: vi.index } } as object)}
              ref={virtualizer.measureElement as never}
              className="absolute left-0 top-0 w-full"
              // Computed geometry: each row's offset comes from the virtualizer.
              style={{ transform: [{ translateY: vi.start }] }}
            >
              {renderItem({ item, index: vi.index })}
            </View>
          );
        })}
      </View>
    </View>
  );
}
