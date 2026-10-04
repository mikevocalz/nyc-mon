'use client';

import { useMemo } from 'react';
import { tv } from 'tailwind-variants';
import { hash2 } from '../charts/chart-model';
import type { ChartTone, District } from '../district';
import { View } from '../tw';
import { skylineProfile } from './skyline-profile';

export interface SkylineBandProps {
  district?: District;
  /** Building colour family. Default royal: the wordmark's outline blue. */
  tone?: ChartTone;
  /** Number of buildings. Default 36. */
  count?: number;
  /** Lit windows in the warm light. Default true. */
  windows?: boolean;
  /** Height and placement classes. Default h-10. */
  className?: string;
}

// Three solid shade steps per tone, so neighbours read as separate buildings.
const band = tv({
  slots: { root: 'h-10 w-full flex-row items-end overflow-hidden', s0: '', s1: '', s2: '', crown: '', lit: 'bg-orange-300' },
  variants: {
    tone: {
      orange: { s0: 'bg-orange-700', s1: 'bg-orange-800', s2: 'bg-orange-900', crown: 'bg-orange-600' },
      royal: { s0: 'bg-royal-700', s1: 'bg-royal-800', s2: 'bg-royal-900', crown: 'bg-royal-600' },
      carolina: { s0: 'bg-carolina-700', s1: 'bg-carolina-800', s2: 'bg-carolina-900', crown: 'bg-carolina-600' },
      leaf: { s0: 'bg-leaf-700', s1: 'bg-leaf-800', s2: 'bg-leaf-900', crown: 'bg-leaf-600' },
      apple: { s0: 'bg-apple-700', s1: 'bg-apple-800', s2: 'bg-apple-900', crown: 'bg-apple-600' },
    },
  },
});

/**
 * A solid district skyline, edge to edge: the nav's bottom edge and the
 * footer's city line. Built from plain views (no canvas), so it costs
 * nothing on any platform and renders on the server. Decorative.
 */
export function SkylineBand({ district = 'midtown', tone = 'royal', count = 36, windows = true, className }: SkylineBandProps) {
  const buildings = useMemo(() => skylineProfile(district, count), [district, count]);
  const s = band({ tone });
  const shade = [s.s0(), s.s1(), s.s2()];
  return (
    <View aria-hidden className={s.root({ className })}>
      {buildings.map((b, i) => (
        // Computed geometry: each building's share of the width and its height.
        <View key={i} className="h-full justify-end" style={{ flexGrow: b.width, flexBasis: 0 }}>
          {b.crown === 'spire' ? <View className={`mx-auto h-[18%] w-0.5 ${s.crown()}`} /> : null}
          {b.crown === 'deco' ? <View className={`mx-auto h-[10%] w-1/3 ${s.crown()}`} /> : null}
          {b.crown === 'tank' ? <View className={`ml-[20%] h-[9%] w-1/4 rounded-t-sm ${s.crown()}`} /> : null}
          {b.crown === 'cornice' ? <View className={`-mx-px h-[5%] ${s.crown()}`} /> : null}
          <View className={`relative ${shade[b.shade]}`} style={{ height: `${Math.round(b.height * 82)}%` }}>
            {b.crown === 'bridge' && i < buildings.length - 1 ? (
              <View className={`absolute -right-2 top-[30%] h-1 w-2 ${s.crown()}`} />
            ) : null}
            {windows && hash2(i, 3) < 0.55 ? (
              <View className={`absolute h-1 w-1 ${s.lit()}`} style={{ top: `${20 + Math.round(hash2(i, 7) * 50)}%`, left: `${20 + Math.round(hash2(i, 9) * 50)}%` }} />
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}
