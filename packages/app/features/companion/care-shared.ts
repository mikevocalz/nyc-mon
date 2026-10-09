'use client';

import { useMemo } from 'react';
import { listUnmetNeeds } from '@acme/core/sim';
import type { CareState, MonInstance } from '@acme/core/types';
import { HLYNK_COPY, type HLynkStatus } from '@acme/ui';
import { selectActiveMon, selectCareNow, useMonStore } from '../mon/mon.store';
import { schemeForTime } from '../onboarding/time-scheme';
import { useMinuteClock } from './minute-clock';
import { monIdentity, type MonIdentity } from './mon-identity';

/** The active Mon, its care advanced to the minute clock, and its identity (M13–M16). */
export interface CareNow {
  readonly nowMs: number;
  readonly mon: MonInstance | undefined;
  readonly care: CareState | undefined;
  readonly identity: MonIdentity | undefined;
  readonly scheme: 'daylit' | 'night';
}

export function useCareNow(): CareNow {
  const nowMs = useMinuteClock((s) => s.nowMs);
  const mon = useMonStore(selectActiveMon);
  const care = useMonStore(useMemo(() => selectCareNow(nowMs), [nowMs]));
  const identity = useMemo(() => (mon === undefined ? undefined : monIdentity(mon)), [mon]);
  return { nowMs, mon, care, identity, scheme: schemeForTime(nowMs) };
}

/** LED for a care state: `needsYou` while any meter is under the line or a food request is open, else off. */
export function careLed(care: CareState | undefined): HLynkStatus {
  if (care === undefined) return { led: 'off' };
  return care.pendingRequest !== null || listUnmetNeeds(care).length > 0
    ? { led: 'needsYou', label: HLYNK_COPY['hlynk.led.needs_you'] }
    : { led: 'off' };
}
