import type { AdminViewServerProps } from 'payload';
import type { ReactNode } from 'react';
import { hasStaffRole, STAFF_ROLES } from '../../../collections/access/roles.ts';
import { ConsoleNotStaff } from '../Chrome';
import { allSpecies, bloodlineLabel, eggs, starterBloodlines } from '@acme/content';
import { ModelsViewClient, type ModelDoc } from './ModelsClient';
import type { StillDoc } from './StillArtPanel';
import { callerIdentity, CALLER_IDENTITY_SELECT } from '../caller-identity';
import { AuditViewClient, CallersViewClient, ConsentViewClient, ContentViewClient, MonsViewClient, OverviewViewClient, SettingsViewClient } from './ViewsClient';

type Req = AdminViewServerProps['initPageResult']['req'];
type Read<T> = { ok: true; data: T } | { ok: false };

/**
 * One Local API read. A failed read (a missing table, a dropped connection)
 * becomes `{ ok: false }` so the view renders that block's error state with
 * a retry button, instead of throwing to the route's error boundary and
 * taking the whole console down with it. The cause goes to the server log,
 * never to the client.
 */
async function read<T>(req: Req, label: string, run: () => Promise<T>): Promise<Read<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    req.payload.logger.error({ err: error, msg: `[console] ${label} read failed` });
    return { ok: false };
  }
}

/**
 * Every console view, staff only. A signed-in account with no staff role
 * (a Caller who found the URL) gets the not-staff screen instead of a shell
 * full of failed reads. The plugin's `requiredRole` guards the login view
 * only; it does not stop a session that already exists.
 */
function staffOnly(view: (props: AdminViewServerProps) => Promise<ReactNode>) {
  return async function StaffOnlyView(props: AdminViewServerProps): Promise<ReactNode> {
    const { req } = props.initPageResult;
    if (req.user && !hasStaffRole(req, STAFF_ROLES)) return <ConsoleNotStaff />;
    return view(props);
  };
}

function requireUser({ initPageResult }: AdminViewServerProps): NonNullable<AdminViewServerProps['initPageResult']['req']['user']> | null {
  const { req } = initPageResult;
  if (!req.user) { req.server?.redirect(`${req.payload.config.routes.admin}/login`); return null; }
  return req.user;
}

async function overviewView(props: AdminViewServerProps) {
  const user = requireUser(props); if (!user) return null;
  const { req } = props.initPageResult;
  // Content editors have no caller/consent access; take them straight to their editing workspace.
  if (user.role === 'content' && req.payload.collections['site-pages']) {
    req.server?.redirect(`${req.payload.config.routes.admin}/collections/site-pages`);
    return null;
  }
  const [consents, eggs, mons, runs, events] = await Promise.all([
    read(req, 'pending consents', () => req.payload.count({ collection: 'guardian-consents', where: { status: { equals: 'pending' } }, user, overrideAccess: false, req })),
    read(req, 'eggs', () => req.payload.count({ collection: 'eggs', user, overrideAccess: false, req })),
    read(req, 'mons', () => req.payload.count({ collection: 'mon-instances', user, overrideAccess: false, req })),
    read(req, 'integrity runs', () => req.payload.find({ collection: 'integrity-runs', sort: '-at', limit: 1, depth: 0, select: { at: true, sharedEgg: true, idMismatch: true, orphans: true, staleReady: true }, user, overrideAccess: false, req })),
    read(req, 'recent audit events', () => req.payload.find({ collection: 'audit-events', sort: '-at', limit: 8, depth: 0, select: { at: true, action: true, targetType: true, targetId: true }, user, overrideAccess: false, req })),
  ]);
  return (
    <OverviewViewClient
      counts={{ consents: consents.ok ? consents.data.totalDocs : null, eggs: eggs.ok ? eggs.data.totalDocs : null, mons: mons.ok ? mons.data.totalDocs : null }}
      run={runs.ok ? (runs.data.docs[0] ?? null) : null}
      runFailed={!runs.ok}
      events={events.ok ? events.data.docs.map((event) => ({ id: String(event.id), at: event.at, action: event.action, target: `${event.targetType} ${event.targetId}` })) : null}
    />
  );
}

async function callersView(props: AdminViewServerProps) {
  const user = requireUser(props); if (!user) return null; const { req } = props.initPageResult;
  // Named view params (:callerId) are matched for routing but never extracted;
  // the adapter only supplies `params.segments`, so the id is segments[1].
  const route = await props.params; const selectedId = typeof route?.segments?.[1] === 'string' ? route.segments[1] : null;
  const search = await props.searchParams;
  const pageParam = Number(Array.isArray(search?.page) ? search.page[0] : search?.page);
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const found = await read(req, 'callers', () => req.payload.find({ collection: 'users', where: { role: { equals: 'user' } }, sort: '-createdAt', limit: 50, page, depth: 0, select: { ...CALLER_IDENTITY_SELECT, email: true, name: true, birthYear: true, consentStatus: true, deletionScheduledFor: true, updatedAt: true, createdAt: true }, user, overrideAccess: false, req }));
  if (!found.ok) return <CallersViewClient callers={[]} failed selectedId={selectedId} page={1} pageCount={1} totalCount={0} />;
  const result = found.data;
  const callers = result.docs.map((doc) => ({ ...callerIdentity(doc), email: doc.email.replace(/(^.).*(@.).*(\..+$)/, '$1•••$2•••$3'), name: doc.name ? 'Hidden' : 'Not given', age: doc.birthYear ? (new Date().getUTCFullYear() - doc.birthYear < 13 ? 'Under 13' : new Date().getUTCFullYear() - doc.birthYear < 18 ? '13 to 17' : '18 and over') : 'Not given', consent: doc.consentStatus ?? 'not-required', joined: doc.createdAt, updatedAt: doc.updatedAt, deletionScheduledFor: doc.deletionScheduledFor ?? null }));
  return <CallersViewClient callers={callers} selectedId={selectedId} page={result.page ?? 1} pageCount={result.totalPages} totalCount={result.totalDocs} />;
}

async function consentView(props: AdminViewServerProps) {
  const user = requireUser(props); if (!user) return null; const { req } = props.initPageResult; const route = await props.params;
  const found = await read(req, 'consents', () => req.payload.find({ collection: 'guardian-consents', sort: '-createdAt', limit: 50, depth: 0, select: { parentEmail: true, birthYear: true, status: true, expiresAt: true, emailsSent: true, parentRequest: true, updatedAt: true, createdAt: true }, user, overrideAccess: false, req }));
  const result = found.ok ? found.data : { docs: [] };
  return <ConsentViewClient failed={!found.ok} selectedId={typeof route?.segments?.[1] === 'string' ? route.segments[1] : null} consents={result.docs.map((doc) => ({ id: String(doc.id), parentEmail: doc.parentEmail.replace(/(^.).*(@.).*(\..+$)/, '$1•••$2•••$3'), age: new Date().getUTCFullYear() - doc.birthYear < 13 ? 'Under 13' : '13 to 17', status: doc.status, expiresAt: doc.expiresAt, emailsSent: doc.emailsSent, updatedAt: doc.updatedAt }))} />;
}

async function monsView(props: AdminViewServerProps) {
  const user = requireUser(props); if (!user) return null; const { req } = props.initPageResult;
  const [mons, eggs, runs] = await Promise.all([
    read(req, 'mon instances', () => req.payload.find({ collection: 'mon-instances', sort: '-createdAt', limit: 50, depth: 0, select: { monInstanceId: true, eggId: true, speciesId: true, callerId: true, stage: true, bond: true, serverConfirmedAt: true }, user, overrideAccess: false, req })),
    read(req, 'eggs', () => req.payload.find({ collection: 'eggs', sort: '-createdAt', limit: 50, depth: 0, select: { eggId: true, speciesId: true, callerId: true, incubationEndsAt: true, hatched: true }, user, overrideAccess: false, req })),
    read(req, 'integrity runs', () => req.payload.find({ collection: 'integrity-runs', sort: '-at', limit: 1, depth: 0, select: { at: true, sharedEgg: true, idMismatch: true, orphans: true, staleReady: true }, user, overrideAccess: false, req })),
  ]);
  return (
    <MonsViewClient
      mons={mons.ok ? mons.data.docs.map((doc) => ({ id: doc.monInstanceId, eggId: doc.eggId, species: doc.speciesId, caller: doc.callerId, stage: doc.stage, bond: doc.bond, confirmed: Boolean(doc.serverConfirmedAt) })) : null}
      eggs={eggs.ok ? eggs.data.docs.map((doc) => ({ id: doc.eggId, species: doc.speciesId, caller: doc.callerId, ends: doc.incubationEndsAt, hatched: doc.hatched })) : null}
      run={runs.ok ? (runs.data.docs[0] ?? null) : null}
      runFailed={!runs.ok}
    />
  );
}

async function contentView(props: AdminViewServerProps) {
  if (!requireUser(props)) return null;
  // Authored content ships in code (packages/content); the roster's unsettled
  // TODO(canon) fields stay null here and render as — in the table.
  const nameBySpeciesId = new Map(allSpecies.map((species) => [species.speciesId, species.formName ?? species.speciesId]));
  const labelByBloodlineId = new Map(starterBloodlines.map(({ bloodline }) => [bloodline.bloodlineId, bloodlineLabel(bloodline)]));
  return <ContentViewClient speciesCount={allSpecies.length} bloodlines={starterBloodlines.map(({ bloodline, forms }) => ({ id: bloodline.bloodlineId, name: bloodlineLabel(bloodline), forms: forms.map((form) => ({ id: form.speciesId, dex: form.dexId, name: form.formName, stage: form.stage, culture: form.cultureNote, scale: form.scaleMeters, affinity: form.affinityId, clazz: form.classId, rig: form.rigDefinitionId, food: form.foodClassIds })) }))} eggs={eggs.map((egg) => ({ id: egg.speciesId, name: egg.eggName, hatches: nameBySpeciesId.get(egg.hatchesIntoSpeciesId) ?? egg.hatchesIntoSpeciesId, bloodline: labelByBloodlineId.get(egg.bloodlineId) ?? egg.bloodlineId }))} />;
}

async function modelsView(props: AdminViewServerProps) {
  const user = requireUser(props); if (!user) return null; const { req } = props.initPageResult;
  const route = await props.params; const selectedId = typeof route?.segments?.[1] === 'string' ? route.segments[1] : null;
  // ponytail: one page of 200 covers the roster (allSpecies is ~100 forms); paginate if it grows past that.
  const found = await read(req, 'mon models', () => req.payload.find({ collection: 'mon-models', limit: 200, depth: 0, user, overrideAccess: false, req }));
  const foundStills = await read(req, 'mon stills', () => req.payload.find({ collection: 'mon-art', limit: 200, depth: 0, user, overrideAccess: false, req }));
  const result = found.ok ? found.data : { docs: [] };
  const labelByBloodlineId = new Map(starterBloodlines.map(({ bloodline }) => [bloodline.bloodlineId, bloodlineLabel(bloodline)]));
  const forms = allSpecies.map((species) => ({ id: species.speciesId, dex: species.dexId, name: species.formName ?? species.bloodlineName, stage: species.stage, bloodline: labelByBloodlineId.get(species.bloodlineId) ?? species.bloodlineName }));
  const models: ModelDoc[] = result.docs.map((doc) => ({
    id: String(doc.id), speciesId: doc.speciesId, status: doc.status, url: doc.url ?? null, filename: doc.filename ?? null, filesize: doc.filesize ?? null, updatedAt: doc.updatedAt,
    scale: doc.scale, position: [doc.position.x, doc.position.y, doc.position.z], rotation: [doc.rotation.x, doc.rotation.y, doc.rotation.z],
    animations: (doc.animations ?? []).map((row) => ({ role: row.role, clip: row.clip, loop: row.loop ?? true })),
    animationClips: (doc.animationClips ?? []).flatMap((row) => (row.name ? [row.name] : [])),
    morphTargets: (doc.morphTargets ?? []).flatMap((row) => (row.name ? [row.name] : [])),
    heightMeters: doc.heightMeters ?? null,
    credit: { author: doc.credit?.author ?? '', license: doc.credit?.license ?? 'owned', sourceUrl: doc.credit?.sourceUrl ?? '' },
    notes: doc.notes ?? '',
  }));
  const stills: StillDoc[] = (foundStills.ok ? foundStills.data.docs : []).map((doc) => ({
    id: String(doc.id), speciesId: doc.speciesId, status: doc.status, url: doc.url ?? null, alt: doc.alt, filename: doc.filename ?? null,
    filesize: doc.filesize ?? null, width: doc.width ?? null, height: doc.height ?? null, updatedAt: doc.updatedAt,
  }));
  return <ModelsViewClient failed={!found.ok || !foundStills.ok} forms={forms} models={models} stills={stills} selectedId={selectedId} canEdit={user.role === 'ops' || user.role === 'content'} />;
}

async function auditView(props: AdminViewServerProps) {
  const user = requireUser(props); if (!user) return null; const { req } = props.initPageResult; const route = await props.params;
  const found = await read(req, 'audit events', () => req.payload.find({ collection: 'audit-events', sort: '-at', limit: 50, depth: 0, select: { at: true, actorRole: true, action: true, targetType: true, targetId: true, reasonCode: true }, user, overrideAccess: false, req }));
  const result = found.ok ? found.data : { docs: [] };
  return <AuditViewClient failed={!found.ok} selectedId={typeof route?.segments?.[1] === 'string' ? route.segments[1] : null} events={result.docs.map((event) => ({ id: String(event.id), at: event.at, actor: event.actorRole, action: event.action, target: `${event.targetType} ${event.targetId}`, reason: event.reasonCode ?? '—' }))} />;
}

async function settingsView(props: AdminViewServerProps) {
  const user = requireUser(props); if (!user) return null; const { req } = props.initPageResult;
  const found = await read(req, 'staff', () => req.payload.find({ collection: 'users', where: { role: { in: ['ops', 'support', 'consent', 'content'] } }, sort: 'email', limit: 100, depth: 0, select: { email: true, role: true }, user, overrideAccess: false, req }));
  const result = found.ok ? found.data : { docs: [] };
  return <SettingsViewClient failed={!found.ok} staff={result.docs.map((doc) => ({ id: String(doc.id), email: doc.email, role: doc.role ?? 'support' }))} isOps={user.role === 'ops'} />;
}

export const OverviewView = staffOnly(overviewView);
export const CallersView = staffOnly(callersView);
export const ConsentView = staffOnly(consentView);
export const MonsView = staffOnly(monsView);
export const ContentView = staffOnly(contentView);
export const ModelsView = staffOnly(modelsView);
export const AuditView = staffOnly(auditView);
export const SettingsView = staffOnly(settingsView);
