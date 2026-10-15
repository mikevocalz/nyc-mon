'use client';

import { Redirect } from 'expo-router';
import { selectActiveMon, selectPendingEgg, useMonStore } from '../mon/mon.store';
import { MON_HOME_PATH } from '../egg/egg-model';
import { resolveBootPath } from '../onboarding/boot';
import { IncubatingScreen } from '../hatch/IncubatingScreen';
import { HomeScreen } from './HomeScreen';
import { ErrorScreen } from '../error/screen';
import { useMinuteClock } from './minute-clock';


/**
 * `/(home)`: M13 when a Mon has hatched (M09 first while it has no name,
 * D-16f), M11 while an egg incubates (M11 "Route and intent"), otherwise the
 * boot route (egg choice; an unreadable save holds on the error screen).
 */
export function HomeIndexScreen() {
  const mon = useMonStore(selectActiveMon);
  const pending = useMonStore(selectPendingEgg);
  const nowMs = useMinuteClock((s) => s.nowMs);
  if (mon !== undefined) {
    if (mon.nickname === null) return <Redirect href="/(home)/name" />;
    return <HomeScreen mon={mon} />;
  }
  if (pending !== undefined) return <IncubatingScreen pending={pending} />;
  // Neither an egg nor a Mon: hand over to the boot route. When boot also
  // answers `(home)` (an unreadable save, whose M22 screen is unbuilt, or a
  // store that disagrees with boot) a redirect would loop back here, so the
  // generic error screen holds instead and nothing is written.
  const { path } = resolveBootPath(nowMs);
  if (path === MON_HOME_PATH) return <ErrorScreen kind="error" />;
  return <Redirect href={path} />;
}
