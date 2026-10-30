'use client';
import { useRowLabel } from '@payloadcms/ui';
import { Text } from '@acme/ui/html';

export function SectionRowLabel() {
  const { data, rowNumber } = useRowLabel<{ label?: string; sectionKey?: string }>();
  return <Text>{data?.label || data?.sectionKey || `Section ${(rowNumber ?? 0) + 1}`}</Text>;
}
export function CopyRowLabel() {
  const { data, rowNumber } = useRowLabel<{ label?: string; key?: string }>();
  return <Text>{data?.label || data?.key || `Copy field ${(rowNumber ?? 0) + 1}`}</Text>;
}
