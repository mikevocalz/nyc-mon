// SPIKE (blocker X3), to be replaced by the real OverviewView
// (docs/design/admin/08-handoff.md §2 step 1 and §3). It exists to prove that
// @acme/ui renders inside a Payload root view in apps/admin-vite: a kit Card,
// a kit DataTable over fixture rows, and an @acme/ui/html heading, on the
// scoped console stylesheet (apps/admin-vite/src/console.css). It reads no
// Payload data. Delete it, its client half and its `views.overview` entry in
// ../components.ts when OverviewView lands.
//
// A root custom view renders with no Payload template, so the console root
// (`.nycmon-console`) is the whole page.
import type { AdminViewServerProps } from 'payload';

import { OverviewSpikeClient, type SpikeRow } from './OverviewSpikeClient';

/** Fixture rows. No real or realistic Caller data, by design. */
const FIXTURE_ROWS: readonly SpikeRow[] = [
  { id: 'fixture-0001', status: 'Pending', joined: '2026-10-01' },
  { id: 'fixture-0002', status: 'Approved', joined: '2026-09-28' },
  { id: 'fixture-0003', status: 'Denied', joined: '2026-09-21' },
];

export function OverviewSpike({ initPageResult }: AdminViewServerProps) {
  const { req } = initPageResult;
  // Payload does not gate custom root views on a session; each view does.
  // The real views also check the staff role (08-handoff.md §3, P7).
  if (!req.user) {
    if (req.server) req.server.redirect(`${req.payload.config.routes.admin}/login`);
    return null;
  }
  return <OverviewSpikeClient rows={FIXTURE_ROWS} />;
}
