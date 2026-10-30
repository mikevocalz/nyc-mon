'use client';
import { useRouter } from '@payloadcms/ui';
import { useState } from 'react';
import { Banner, Button, CallerAvatar, Card, CheckRow, Checklist, ConfirmDestructive, CopyButton, DataTable, ErrorMessage, KeyValueList, MaskedValue, Pagination, SegmentedControl, Select, SignageBand, TextField, Timestamp, type ColumnDef } from '@acme/ui/admin';
import { Heading, Link, Paragraph, Section, Text } from '@acme/ui/html';
import { cancelCallerDeletion, createStaff, deleteConsentRecord, removeStaff, resendConsentEmail, reveal, runIntegrityCheck, scheduleCallerDeletion } from '../api';
import { consoleCopy, reasonOptions } from '../copy';
import { useCallersStore, useConsentStore, useMonsStore, useOverviewStore, useSettingsStore, useShellStore } from '../stores';
import type { MonsTab } from '../stores/mons.ts';
import type { Appearance } from '../stores/types.ts';
import { STAFF_ROLES, type StaffRole } from '../../../collections/access/roles.ts';
import { ConsoleShell } from '../Shell';

const api = { baseUrl: '/payload-api' } as const;
const fail = () => new Error(consoleCopy.errors.action);
type Integrity = { at: string; sharedEgg: number; idMismatch: number; orphans: number; staleReady: number };
type EventRow = { id: string; at: string; action: string; target: string };
const eventColumns: ColumnDef<EventRow, unknown>[] = [{ accessorKey: 'at', header: 'When', cell: ({ row }) => <Timestamp at={new Date(row.original.at)} format="both" /> }, { accessorKey: 'action', header: 'Action' }, { accessorKey: 'target', header: 'Target' }];

/** console-title: section and pane headings (03-direction.md type scale). */
const h2 = 'my-0 font-sans text-lg font-bold leading-6';
/** List pane + detail pane side by side from 1200px up; stacked below. */
const splitPanes = 'grid gap-6 min-[1200px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]';
const detailPane = 'content-start gap-4';

export function OverviewViewClient({ counts, run, events }: { counts: { consents: number; eggs: number; mons: number }; run: Integrity | null; events: EventRow[] }) {
  const router = useRouter(); const dialog = useOverviewStore((s) => s.dialog); const open = useOverviewStore((s) => s.openDialog); const close = useOverviewStore((s) => s.closeDialog);
  const failures = run ? run.sharedEgg + run.idMismatch + run.orphans + run.staleReady : 0;
  return (
    <ConsoleShell section="overview" heading={consoleCopy.overview.heading}>
      <SignageBand tone={failures ? 'danger' : 'signage'} headline={failures ? `${failures} duplicated Mons` : consoleCopy.overview.healthy} detail={run ? `Checked ${new Date(run.at).toLocaleString()}` : undefined} action={<Button title={consoleCopy.overview.run} onPress={async () => { open('run'); const result = await runIntegrityCheck(api); close(); if (result.ok) router.refresh(); }} />} />
      <Section className="gap-3" aria-labelledby="overview-queues">
        <Heading level={2} id="overview-queues" className={h2}>{consoleCopy.overview.queues}</Heading>
        <Section className="grid gap-4 sm:grid-cols-3">
          <Card surface="page" title="Consents pending" description={String(counts.consents)} />
          <Card surface="page" title="Eggs incubating" description={String(counts.eggs)} />
          <Card surface="page" title="Mons" description={String(counts.mons)} />
        </Section>
      </Section>
      <Section className="gap-3" aria-labelledby="overview-recent">
        <Heading level={2} id="overview-recent" className={h2}>{consoleCopy.overview.recent}</Heading>
        <DataTable surface="page" caption={consoleCopy.overview.recent} data={events} columns={eventColumns} getRowId={(row) => row.id} />
        <Link href="/admin/audit" className="self-start text-sm font-medium text-accent underline">{consoleCopy.overview.openAudit}</Link>
      </Section>
      {dialog === 'run' ? <Paragraph>Checking…</Paragraph> : null}
    </ConsoleShell>
  );
}

type Caller = { id: string; image: string | null; email: string; name: string; age: string; consent: string; joined: string; updatedAt: string; deletionScheduledFor: string | null };
const callerColumns: ColumnDef<Caller, unknown>[] = [
  {
    id: 'avatar',
    accessorKey: 'image',
    header: 'Avatar',
    enableSorting: false,
    meta: { priority: 1 },
    cell: ({ row }) => <CallerAvatar userId={row.original.id} imageUri={row.original.image} />,
  },
  {
    accessorKey: 'id',
    header: 'User ID',
    meta: { priority: 1 },
    cell: ({ row }) => <Text className="break-all font-mono text-sm">{row.original.id}</Text>,
  },
  { accessorKey: 'age', header: 'Age band' },
  { accessorKey: 'consent', header: 'Consent' },
  { accessorKey: 'joined', header: 'Joined', cell: ({ row }) => <Timestamp at={new Date(row.original.joined)} format="relative" /> },
];
export function CallersViewClient({ callers, selectedId, page, pageCount, totalCount }: { callers: Caller[]; selectedId: string | null; page: number; pageCount: number; totalCount: number }) {
 const router = useRouter(); const store = useCallersStore(); const selected = callers.find((row) => row.id === selectedId); const shown = store.revealed;
 const show = async (field: 'email' | 'name') => { if (!selected) return; const result = await reveal(api, { targetType: 'caller', targetId: selected.id, field, reasonCode: 'support_request' }); if (result.ok && typeof result.data.value === 'string') store.setRevealed(field, result.data.value); };
 return (
  <ConsoleShell section="callers" heading={consoleCopy.callers.heading}>
   <Banner tone="info" title={consoleCopy.callers.privacy} />
   <Section className={selected ? splitPanes : 'gap-6'}>
    <Section className="content-start gap-4">
     <DataTable surface="page" caption={consoleCopy.callers.heading} data={callers} columns={callerColumns} getRowId={(row) => row.id} getRowHref={(row) => `/admin/callers/${row.id}`} selectedRowId={selectedId ?? undefined} emptyState={<Paragraph>{consoleCopy.callers.empty}</Paragraph>} />
     <Pagination page={page} pageCount={pageCount} totalCount={totalCount} pageSize={50} onPageChange={(next) => router.push(`/admin/callers?page=${next}`)} />
    </Section>
   {selected ? <Section testID="caller-detail" className={detailPane}>
    <Heading level={2} className={h2}>{consoleCopy.callers.identity}</Heading>
    <KeyValueList items={[{ key: 'id', label: 'User ID', value: selected.id, action: <CopyButton value={selected.id} label="Copy user ID" /> }, { key: 'email', label: 'Email', value: shown.email ? <MaskedValue state="revealed" value={shown.email} onHide={store.clearRevealed} /> : <MaskedValue state="masked" mask={selected.email} onRevealRequest={() => void show('email')} /> }, { key: 'name', label: 'Name', value: shown.name ? <MaskedValue state="revealed" value={shown.name} onHide={store.clearRevealed} /> : <MaskedValue state="masked" mask={selected.name} onRevealRequest={() => void show('name')} /> }, { key: 'age', label: 'Age band', value: selected.age }]} />
    <Button title={selected.deletionScheduledFor ? consoleCopy.callers.cancel : consoleCopy.callers.schedule} variant="danger" onPress={() => store.openDialog(selected.deletionScheduledFor ? 'cancel' : 'delete')} />
    <ConfirmDestructive open={store.dialog === 'delete'} title="Schedule deletion for this Caller?" consequences={["Their personal data is deleted after 7 days. Their Mons move into Dr. Santoro's care."]} confirmText={selected.id.slice(-6)} confirmLabel={consoleCopy.callers.schedule} reasonOptions={reasonOptions} onClose={store.closeDialog} onConfirm={async ({ reasonCode }) => { if (!reasonCode) throw fail(); const result = await scheduleCallerDeletion(api, selected.id, { reasonCode, confirmText: selected.id.slice(-6), expectedUpdatedAt: selected.updatedAt }); if (!result.ok) throw fail(); router.refresh(); }} />
    <ConfirmDestructive open={store.dialog === 'cancel'} title="Cancel deletion?" consequences={['The Caller keeps their account.']} confirmText={selected.id.slice(-6)} confirmLabel={consoleCopy.callers.cancel} onClose={store.closeDialog} onConfirm={async () => { const result = await cancelCallerDeletion(api, selected.id, { expectedUpdatedAt: selected.updatedAt }); if (!result.ok) throw fail(); router.refresh(); }} />
   </Section> : null}
   </Section>
  </ConsoleShell>
 );
}

type Consent = { id: string; parentEmail: string; age: string; status: string; expiresAt: string; emailsSent: number; updatedAt: string };
const consentColumns: ColumnDef<Consent, unknown>[] = [{ accessorKey: 'id', header: 'Consent' }, { accessorKey: 'status', header: 'Status' }, { accessorKey: 'expiresAt', header: 'Expires' }, { accessorKey: 'emailsSent', header: 'Emails sent' }];
export function ConsentViewClient({ consents, selectedId }: { consents: Consent[]; selectedId: string | null }) {
 const router = useRouter(); const store = useConsentStore(); const selected = consents.find((row) => row.id === selectedId);
 return (
  <ConsoleShell section="consent" heading={consoleCopy.consent.heading}>
   <Banner tone="info" title={consoleCopy.consent.rule} />
   <Section className={splitPanes}>
    <Section className="content-start gap-4">
     <DataTable surface="page" caption={consoleCopy.consent.heading} data={consents} columns={consentColumns} getRowId={(row) => row.id} getRowHref={(row) => `/admin/consent/${row.id}`} selectedRowId={selectedId ?? undefined} />
    </Section>
   {selected ? <Section testID="consent-detail" className={detailPane}>
    <KeyValueList items={[{ key: 'email', label: "Parent's email", value: <MaskedValue state="masked" mask={selected.parentEmail} onRevealRequest={async () => { const result = await reveal(api, { targetType: 'consent', targetId: selected.id, field: 'parentEmail', reasonCode: 'parent_request' }); if (result.ok && typeof result.data.value === 'string') store.setRevealed('email', result.data.value); }} /> }, { key: 'status', label: 'Status', value: selected.status }, { key: 'age', label: "Child's age band", value: selected.age }]} />
    <Button title={consoleCopy.consent.resend} onPress={async () => { const result = await resendConsentEmail(api, selected.id); if (result.ok) router.refresh(); }} />
    <Button title={consoleCopy.consent.remove} variant="danger" onPress={() => store.openDialog('delete')} />
    <ConfirmDestructive open={store.dialog === 'delete'} title="Delete this consent record?" consequences={["The parent's email and the child's birth year are deleted now. A receipt stays."]} confirmText={selected.id.slice(-6)} confirmLabel="Delete record" reasonOptions={reasonOptions} onClose={store.closeDialog} onConfirm={async ({ reasonCode }) => { if (!reasonCode) throw fail(); const result = await deleteConsentRecord(api, selected.id, { reasonCode, confirmText: selected.id.slice(-6) }); if (!result.ok) throw fail(); router.push('/admin/consent'); router.refresh(); }} />
   </Section> : null}
   </Section>
  </ConsoleShell>
 );
}

type Mon = { id: string; eggId: string; species: string; caller: string; stage: string; bond: number; confirmed: boolean }; type Egg = { id: string; species: string; caller: string; ends: number; hatched: boolean };
const monColumns: ColumnDef<Mon, unknown>[] = [{ accessorKey: 'id', header: 'Mon' }, { accessorKey: 'species', header: 'Species' }, { accessorKey: 'caller', header: 'Caller' }, { accessorKey: 'stage', header: 'Stage' }]; const eggColumns: ColumnDef<Egg, unknown>[] = [{ accessorKey: 'id', header: 'Egg' }, { accessorKey: 'species', header: 'Species' }, { accessorKey: 'caller', header: 'Caller' }, { accessorKey: 'hatched', header: 'Hatched' }];
const monsTabOptions = (['mons', 'eggs', 'integrity'] as const).map((value) => ({ value, label: consoleCopy.mons.tabs[value] }));
export function MonsViewClient({ mons, eggs, run }: { mons: Mon[]; eggs: Egg[]; run: Integrity | null }) {
 const router = useRouter(); const store = useMonsStore();
 return (
  <ConsoleShell section="mons" heading={consoleCopy.mons.heading}>
   <Banner tone="neutral" title={consoleCopy.mons.readonly} />
   <SegmentedControl<MonsTab> aria-label="Mons and eggs" options={monsTabOptions} value={store.tab} onChange={store.setTab} />
   {store.tab === 'mons' ? <DataTable surface="page" caption="Mons" data={mons} columns={monColumns} getRowId={(row) => row.id} /> : null}
   {store.tab === 'eggs' ? <DataTable surface="page" caption="Eggs" data={eggs} columns={eggColumns} getRowId={(row) => row.id} /> : null}
   {store.tab === 'integrity' ? (
    <Section className="content-start gap-4" aria-labelledby="mons-integrity">
     <Heading level={2} id="mons-integrity" className={h2}>{consoleCopy.mons.integrity}</Heading>
     <Checklist>{([['shared_egg', 'Mons sharing one egg', run?.sharedEgg], ['id_mismatch', "Mon ids that don't match their egg", run?.idMismatch], ['orphans', 'Hatched eggs with no Mon, or Mons whose egg isn’t hatched', run?.orphans], ['stale_ready', 'Eggs ready for more than 7 days', run?.staleReady]] as const).map(([key, label, count]) => <CheckRow key={key} label={label} result={count === undefined ? { kind: 'unavailable', reason: 'No check has run' } : count === 0 ? { kind: 'pass', count: 0 } : { kind: 'fail', count }} />)}</Checklist>
     <Button title="Run check" onPress={async () => { const result = await runIntegrityCheck(api); if (result.ok) router.refresh(); }} />
    </Section>
   ) : null}
  </ConsoleShell>
 );
}

type ContentForm = { id: string; dex: number | null; name: string | null; stage: string; culture: string | null; scale: number | null; affinity: string | null; clazz: string | null; rig: string | null; food: readonly string[] | null };
type ContentBloodline = { id: string; name: string; forms: ContentForm[] };
type ContentEgg = { id: string; name: string; hatches: string; bloodline: string };
const pendingContent = () => consoleCopy.content.pending;
const formColumns: ColumnDef<ContentForm, unknown>[] = [
  { accessorKey: 'dex', header: consoleCopy.content.colDex, cell: ({ row }) => row.original.dex ?? pendingContent() },
  { accessorKey: 'name', header: consoleCopy.content.colForm, cell: ({ row }) => row.original.name ?? pendingContent() },
  { accessorKey: 'stage', header: consoleCopy.content.colStage },
  { accessorKey: 'culture', header: consoleCopy.content.colCulture, cell: ({ row }) => row.original.culture ?? pendingContent() },
  { accessorKey: 'scale', header: consoleCopy.content.colScale, cell: ({ row }) => row.original.scale ?? pendingContent() },
  { accessorKey: 'affinity', header: consoleCopy.content.colAffinity, cell: ({ row }) => row.original.affinity ?? pendingContent() },
  { accessorKey: 'clazz', header: consoleCopy.content.colClass, cell: ({ row }) => row.original.clazz ?? pendingContent() },
  { accessorKey: 'rig', header: consoleCopy.content.colRig, cell: ({ row }) => row.original.rig ?? pendingContent() },
  { accessorKey: 'food', header: consoleCopy.content.colFood, cell: ({ row }) => row.original.food?.join(', ') ?? pendingContent() },
];
const contentEggColumns: ColumnDef<ContentEgg, unknown>[] = [
  { accessorKey: 'name', header: consoleCopy.content.colEgg },
  { accessorKey: 'id', header: consoleCopy.content.colId },
  { accessorKey: 'hatches', header: consoleCopy.content.colHatches },
  { accessorKey: 'bloodline', header: consoleCopy.content.colBloodline },
];
export function ContentViewClient({ bloodlines, eggs, speciesCount }: { bloodlines: ContentBloodline[]; eggs: ContentEgg[]; speciesCount: number }) {
  return (
    <ConsoleShell section="content" heading={consoleCopy.content.heading}>
      <Banner tone="info" title={consoleCopy.content.banner} />
      <Banner tone="neutral" title={consoleCopy.content.canon} />
      <Section className="grid gap-4 sm:grid-cols-3">
        <Card surface="page" title={consoleCopy.content.bloodlines} description={String(bloodlines.length)} />
        <Card surface="page" title={consoleCopy.content.forms} description={String(speciesCount)} />
        <Card surface="page" title={consoleCopy.content.eggs} description={String(eggs.length)} />
      </Section>
      {bloodlines.map((bloodline) => <Section key={bloodline.id} className="gap-3"><Heading level={2} className={h2}>{bloodline.name}</Heading><DataTable surface="page" caption={bloodline.name} data={bloodline.forms} columns={formColumns} getRowId={(row) => row.id} /></Section>)}
      <Section className="gap-3"><Heading level={2} className={h2}>{consoleCopy.content.eggs}</Heading><DataTable surface="page" caption={consoleCopy.content.eggs} data={eggs} columns={contentEggColumns} getRowId={(row) => row.id} /></Section>
    </ConsoleShell>
  );
}

type AuditRow = EventRow & { actor: string; reason: string }; const auditColumns: ColumnDef<AuditRow, unknown>[] = [{ accessorKey: 'at', header: 'When' }, { accessorKey: 'action', header: 'Action' }, { accessorKey: 'target', header: 'Target' }, { accessorKey: 'actor', header: 'Staff' }, { accessorKey: 'reason', header: 'Reason' }];
export function AuditViewClient({ events, selectedId }: { events: AuditRow[]; selectedId: string | null }) {
 const selected = events.find((row) => row.id === selectedId);
 return (
  <ConsoleShell section="audit" heading={consoleCopy.audit.heading}>
   <Banner tone="neutral" title={consoleCopy.audit.rule} action={<Link href="/payload-api/console/audit/export">{consoleCopy.audit.export}</Link>} />
   <Section className={splitPanes}>
    <Section className="content-start gap-4">
     <DataTable surface="page" caption={consoleCopy.audit.heading} data={events} columns={auditColumns} getRowId={(row) => row.id} getRowHref={(row) => `/admin/audit/${row.id}`} selectedRowId={selectedId ?? undefined} />
    </Section>
   {selected ? <Section testID="audit-detail" className={detailPane}><KeyValueList items={[{ key: 'when', label: 'When', value: selected.at }, { key: 'who', label: 'Who', value: selected.actor }, { key: 'what', label: 'What', value: selected.action }, { key: 'why', label: 'Why', value: selected.reason }]} /></Section> : null}
   </Section>
  </ConsoleShell>
 );
}

type Staff = { id: string; email: string; role: string }; const staffColumns: ColumnDef<Staff, unknown>[] = [{ accessorKey: 'email', header: 'Email' }, { accessorKey: 'role', header: 'Role' }];
const staffRoleOptions = STAFF_ROLES.map((role) => ({ value: role, label: consoleCopy.roles[role] }));
const appearanceOptions = (['system', 'daylit', 'night'] as const).map((value) => ({ value, label: consoleCopy.settings.appearanceOptions[value] }));
export function SettingsViewClient({ staff, isOps }: { staff: Staff[]; isOps: boolean }) {
  const router = useRouter(); const store = useSettingsStore(); const shell = useShellStore(); const selected = staff.find((row) => row.id === store.selectedId);
  const [addError, setAddError] = useState<string>(); const [addPending, setAddPending] = useState(false);
  const submitStaff = async () => {
    setAddPending(true); setAddError(undefined);
    try {
      const result = await createStaff(api, { email: store.addEmail.trim(), role: store.addRole });
      if (!result.ok) { setAddError(`${consoleCopy.errors.action} (${result.code})`); return; }
      store.resetAddStaff(); router.refresh();
    } finally { setAddPending(false); }
  };
  return (
    <ConsoleShell section="settings" heading={consoleCopy.settings.heading}>
      <Section className="content-start gap-3">
        <Heading level={2} className={h2}>{consoleCopy.settings.appearance}</Heading>
        <SegmentedControl<Appearance> aria-label={consoleCopy.settings.appearance} options={appearanceOptions} value={shell.appearance} onChange={shell.setAppearance} />
      </Section>
      <Section className="content-start gap-3">
        <Heading level={2} className={h2}>{consoleCopy.settings.staff}</Heading>
        <DataTable surface="page" caption={consoleCopy.settings.staff} data={staff} columns={staffColumns} getRowId={(row) => row.id} selection={isOps ? { selectedIds: store.selectedId ? [store.selectedId] : [], onSelectedIdsChange: (ids) => store.setSelectedId(ids[0] ?? null) } : undefined} />
        {selected && isOps ? <><Button title={consoleCopy.settings.remove} variant="danger" onPress={() => store.openDialog('remove')} /><ConfirmDestructive open={store.dialog === 'remove'} title="Remove staff access?" consequences={['This person can no longer use the console.']} confirmText={selected.id.slice(-6)} confirmLabel={consoleCopy.settings.remove} reasonOptions={reasonOptions} onClose={store.closeDialog} onConfirm={async ({ reasonCode }) => { if (!reasonCode) throw fail(); const result = await removeStaff(api, selected.id, { reasonCode }); if (!result.ok) throw fail(); store.setSelectedId(null); router.refresh(); }} /></> : null}
      </Section>
      {isOps ? <Section testID="add-staff" className="content-start gap-3"><Heading level={3} className={h2}>{consoleCopy.settings.addStaff}</Heading><TextField surface="daylit" label={consoleCopy.settings.addEmail} value={store.addEmail} onChangeText={store.setAddEmail} keyboardType="email-address" autoCapitalize="none" /><Select label={consoleCopy.settings.addRole} value={store.addRole} options={staffRoleOptions} onValueChange={(role) => store.setAddRole(role as StaffRole)} />{addError ? <ErrorMessage message={addError} /> : null}<Button title={consoleCopy.settings.addStaff} loading={addPending} onPress={() => void submitStaff()} /></Section> : null}
    </ConsoleShell>
  );
}
