import type { MonCareSurfacesInput } from './publish-mon-care.ts';

/** The application owns one controller while signed in. Reading at flush time
 * coalesces writes and prevents an older queued tick from restoring a Mon
 * after a switch or sign-out. Native notification writes are serialized by
 * care-notifications.native; widget writes happen synchronously first.
 */
export function createCareSurfaceSync(deps: {
  read: () => MonCareSurfacesInput | null;
  publish: (input: MonCareSurfacesInput) => Promise<void>;
  clear: () => Promise<void>;
  report: (error: unknown) => void;
}) {
  let stopped = false;
  let queued = false;
  let previousMon: string | null = null;
  const refresh = () => {
    if (stopped || queued) return;
    queued = true;
    void Promise.resolve().then(async () => {
      queued = false;
      if (stopped) return;
      const input = deps.read();
      const nextMon = input?.monInstanceId ?? null;
      if (previousMon !== nextMon || input === null) {
        // Clear synchronously before publishing the new widget; the native
        // notification queue preserves this order across its awaits.
        const clearing = deps.clear();
        previousMon = nextMon;
        const [clearResult, publishResult] = await Promise.allSettled([
          clearing,
          Promise.resolve().then(() => input ? deps.publish(input) : undefined),
        ]);
        if (publishResult.status === 'rejected') {
          if (clearResult.status === 'rejected') deps.report(clearResult.reason);
          throw publishResult.reason;
        }
        if (clearResult.status === 'rejected') throw clearResult.reason;
      } else if (input) await deps.publish(input);
    }).catch(deps.report);
  };
  return {
    refresh,
    stop() {
      stopped = true;
      void deps.clear().catch(deps.report);
    },
  };
}
