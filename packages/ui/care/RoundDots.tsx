'use client';
import { View } from '../tw';
import { hiddenA11y } from '../hlynk/a11y';
import { roundDots } from './round-dots-model';

export interface RoundDotsProps {
  /** 6 in Peek. */
  total: number;
  /** 1-based. */
  current: number;
  /** Spoken, e.g. "Round 3 of 6". */
  accessibilityLabel: string;
  reducedMotion: boolean;
  testID?: string;
}

/**
 * Discrete rounds for M16's Peek: played rounds filled, the current one
 * larger, the rest open. Square marks, all one colour: they count rounds and
 * must not read as a score, so there is no right/wrong colouring. Not the
 * kit `ProgressBar`. The current mark grows with `motion-step` (120 ms
 * colour-only under reduced motion). One text element to assistive tech.
 */
export function RoundDots({ total, current, accessibilityLabel, reducedMotion, testID }: RoundDotsProps) {
  const dots = roundDots(total, current);
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      role="img"
      accessibilityLabel={accessibilityLabel}
      aria-label={accessibilityLabel}
      className="flex-row items-center gap-2"
    >
      {dots.map((d, i) => (
        <View
          key={i}
          {...(hiddenA11y(true) as object)}
          className={`border-2 border-text ${d === 'ahead' ? 'bg-transparent' : 'bg-text'} ${reducedMotion ? '' : 'transition-transform duration-fast'}`}
          style={{ width: 10, height: 10, transform: [{ scale: d === 'current' && !reducedMotion ? 1.4 : 1 }] }}
        />
      ))}
    </View>
  );
}
