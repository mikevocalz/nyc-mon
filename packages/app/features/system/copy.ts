/**
 * Every string on M21 (offline / sync) and M22 (error / recovery). All are
 * `voice: "ui"`; the index lives in docs/COPY_DECK.md. Plain words: what
 * happened, what is safe, what to do next.
 */
export const SYSTEM_COPY = {
  // ---- M22 save-recovered ----
  'm22.save.title': "Your save didn't open",
  'm22.save.body.restore': 'The save on this device is damaged. You can go back to the last copy that saved cleanly, from {when}.',
  'm22.save.body.none': "The save on this device is damaged, and there's no clean copy to go back to. You can start a new save.",
  'm22.save.body.newer': 'This save was made by a newer version of NYC-MON. Update the app to open it, or go back to an older copy.',
  'm22.save.kept': 'The damaged save stays on this device. Nothing is deleted.',
  // ---- M22 3D stage ----
  'm22.webgpu.title': "3D can't run on this device",
  'm22.webgpu.body': 'Your Mon is fine. The 2D view has everything the 3D one does.',
  'm22.lost.title': 'The 3D view stopped',
  'm22.lost.body': 'Your Mon is fine. Try the 3D view again, or keep going in 2D. If it stops again, close and reopen the app.',
  // ---- M22 missing Mon ----
  'm22.mon.title': "Your Mon didn't load",
  'm22.mon.body': 'The save opened, but your Mon is missing from this screen. Load the save again to bring them back.',
  'm22.dex.title': 'No Dex entry here',
  'm22.dex.body': "This link points to a Mon that isn't in your Dex.",
  // ---- M22 actions ----
  'm22.action.restore': 'Go back to the last good save',
  'm22.action.start_over': 'Start a new save',
  'm22.action.use_2d': 'Use the 2D view',
  'm22.action.retry_3d': 'Try 3D again',
  'm22.action.reload': 'Load the save again',
  'm22.action.home': 'Back to Home',
  'm22.action.back': 'Go back',
  'm22.start_over.confirm.title': 'Start a new save?',
  'm22.start_over.confirm.body': 'You start again from the first step. The damaged save stays on this device in case it can be fixed later.',
  'm22.start_over.confirm.action': 'Start a new save',
  'm22.start_over.cancel': 'Cancel',
  'm22.restore.failed': "That copy didn't open either. You can start a new save.",
  'm22.done.a11y': 'Save restored. Opening Home.',
  // ---- M21 banner and badge ----
  'm21.banner.offline': "You're offline",
  'm21.banner.offline.body': 'Care you give is saved here and syncs when you reconnect.',
  'm21.banner.pending': '{count} waiting to sync',
  'm21.banner.pending.one': '1 waiting to sync',
  'm21.banner.syncing': 'Syncing',
  'm21.banner.conflict': 'Sync finished with a change',
  'm21.banner.a11y.hint': 'Opens sync details',
  // ---- M21 sync screen ----
  'm21.title': 'Sync',
  'm21.status.online': 'Online',
  'm21.status.offline': 'Offline',
  'm21.status.reconciling': 'Syncing now',
  'm21.status.conflict': 'Synced, with a change',
  'm21.local_first': 'Everything saves on this device first, so you can play without a connection.',
  'm21.queue.title': 'Waiting to sync',
  'm21.queue.count': '{count} changes',
  'm21.queue.count.one': '1 change',
  'm21.queue.empty.title': 'All caught up',
  'm21.queue.empty.body': 'Nothing is waiting to sync.',
  'm21.queue.feed': 'Fed {name}',
  'm21.queue.rest': '{name} went to sleep',
  'm21.queue.wake': 'Woke {name}',
  'm21.queue.play': 'Played with {name}',
  'm21.queue.egg': 'New egg',
  'm21.log.title': 'Sync log',
  'm21.log.empty': 'No changes from the server yet.',
  'm21.log.server_kept': 'The server kept its version of {count} changes for {name}.',
  'm21.log.server_kept.one': 'The server kept its version of 1 change for {name}.',
  'm21.retry': 'Sync now',
  'm21.retry.a11y.hint': 'Sends the waiting changes',
  'm21.result.offline': "Still offline. Your changes are safe here and sync when you're back online.",
  'm21.result.no_server': "Saved on this device. Syncing with the server isn't switched on yet, so changes stay here for now.",
  'm21.result.synced': 'Synced.',
  'm21.result.failed': "Couldn't reach the server. Your changes are safe here. Try again in a minute.",
  'm21.back': 'Back',
} as const;

export type SystemCopyId = keyof typeof SYSTEM_COPY;

/** Looks up a string and fills `{token}` placeholders. */
export function systemCopy(id: SystemCopyId, tokens?: Record<string, string | number>): string {
  let text: string = SYSTEM_COPY[id];
  if (tokens) {
    for (const [key, value] of Object.entries(tokens)) text = text.replaceAll(`{${key}}`, String(value));
  }
  return text;
}
