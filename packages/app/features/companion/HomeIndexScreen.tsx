'use client';

import { Redirect } from 'expo-router';
import { selectActiveMon, selectPendingEgg, useMonStore } from '../mon/mon.store';
import { MON_HOME_PATH } from '../egg/egg-model';
import { resolveBootPath } from '../onboarding/boot';
import { needsNicknamePrompt } from '../onboarding/onboarding.store';
import { IncubatingScreen } from '../hatch/IncubatingScreen';
import { HomeScreen } from './HomeScreen';
import { recoveryHref } from '../system/recovery-model';
import { useMinuteClock } from './minute-clock';


/**
 * `/(home)`: M13 when a Mon has hatched (the optional M09 nickname question
 * first, once), M11 while an egg incubates (M11 "Route and intent"), otherwise the
 * boot route (egg choice; an unreadable save goes to M22).
 */
export function HomeIndexScreen() {
  const mon = useMonStore(selectActiveMon);
  const pending = useMonStore(selectPendingEgg);
  const nowMs = useMinuteClock((s) => s.nowMs);
  if (mon !== undefined) {
    // The nickname question shows once after the hatch; a Mon with no nickname is a whole Mon.
    if (needsNicknamePrompt(mon)) return <Redirect href="/(home)/name" />;
    return <HomeScreen mon={mon} />;
  }
  if (pending !== undefined) return <IncubatingScreen pending={pending} />;
  // Neither an egg nor a Mon: hand over to the boot route. When boot also
  // answers `(home)` (a store that disagrees with the save) a redirect would
  // loop back here, so M22 takes it ("mon-missing") and nothing is written.
  const { path } = resolveBootPath(nowMs);
  if (path === MON_HOME_PATH) return <Redirect href={recoveryHref('mon-missing')} />;
  return <Redirect href={path} />;
}
