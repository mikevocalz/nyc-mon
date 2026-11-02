'use client';
// Where a primary tab press goes. One function for both shell hosts.
import { useRouter } from 'expo-router';
import { selectActiveMon, useMonStore } from '../mon/mon.store';
import { requestHomeMenu } from '../companion/home-stage.store';
import { shellHref, type ShellDestinationName } from './shell-destinations';
import { useShellDrawer } from './ShellNav';

/** H-LYNK opens the companion stage with the device's menu up; the rest navigate. */
export function useShellNavigate(): (name: ShellDestinationName) => void {
  const router = useRouter();
  const activeMonId = useMonStore((s) => selectActiveMon(s)?.monInstanceId);
  return (name) => {
    useShellDrawer.getState().setOpen(false);
    router.navigate(shellHref(name, activeMonId) as never);
    if (name === 'hlynk') requestHomeMenu();
  };
}
