import type { ReactNode } from 'react';
import { brand } from '@acme/theme';
import { Text, View } from '../tw';
import type { CircuitTone } from './CircuitButton';

export interface GridCardProps {
  /** Short sentence-case label above the title. Leave it out unless it adds information. */
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  tone?: CircuitTone;
  className?: string;
}

// Eyebrow colours hold AA on the night card (orange 7.8:1, carolina 7.9:1);
// royal is too dark for text there, so a royal card labels in carolina.
const accents: Record<CircuitTone, { line: string; label: string }> = {
  orange: { line: brand.orange, label: brand.orange },
  carolina: { line: brand.carolina, label: brand.carolina },
  royal: { line: brand.royal, label: brand.carolina },
};

export function GridCard({ eyebrow, title, children, tone = 'royal', className }: GridCardProps) {
  const { line, label } = accents[tone];
  return (
    <View
      className={`relative overflow-hidden border p-5 shadow-card ${className ?? ''}`}
      style={{ borderColor: `${line}66`, backgroundColor: `${brand.night}D9` }}
    >
      <View className="absolute left-0 top-0 h-px w-20" style={{ backgroundColor: line }} />
      <View className="absolute right-0 top-0 h-7 w-px" style={{ backgroundColor: line }} />
      {eyebrow ? (
        <Text className="mb-1.5 text-sm font-semibold" style={{ color: label }}>
          {eyebrow}
        </Text>
      ) : null}
      <Text className="font-display text-lg" style={{ color: brand.white }}>{title}</Text>
      {children ? <View className="mt-3 gap-2">{children}</View> : null}
    </View>
  );
}
