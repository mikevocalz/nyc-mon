'use client';
// SPIKE (blocker X3): the client half of OverviewSpike.tsx. Delete with it.
//
// Kit components are client components (react-native-web, Zustand stores), so
// the console's views render them from a 'use client' module and pass plain
// serialisable props across the RSC boundary. The file name avoids
// `*.client.tsx`: TanStack Start's import protection mocks host `.client.*`
// files during SSR (withPayload's payloadTanstackStartOptions).
import { Card, DataTable, type ColumnDef } from '@acme/ui/admin';
import { Heading, Main, Page, Paragraph } from '@acme/ui/html';

/** One fixture row of the spike table. */
export interface SpikeRow {
  id: string;
  status: 'Pending' | 'Approved' | 'Denied';
  joined: string;
}

const COLUMNS: ColumnDef<SpikeRow, unknown>[] = [
  { accessorKey: 'id', header: 'Record' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'joined', header: 'Joined' },
];

export function OverviewSpikeClient({ rows }: { rows: readonly SpikeRow[] }) {
  return (
    <Page className="nycmon-console min-h-dvh bg-bg font-sans text-text" testID="console-root">
      <Main className="mx-auto w-full max-w-5xl gap-6 p-4 md:p-8">
        <Heading level={1} className="my-0 font-display text-3xl text-text">
          Overview
        </Heading>
        <Paragraph className="my-0 text-sm text-text-muted">
          Platform spike: @acme/ui inside the Payload admin. Fixture rows, no live data.
        </Paragraph>
        <Card title="Kit card" description="A corner-cut Card from @acme/ui/admin." />
        <DataTable title="Fixture rows" data={[...rows]} columns={COLUMNS} />
      </Main>
    </Page>
  );
}
