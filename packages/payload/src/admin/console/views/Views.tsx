import type { AdminViewServerProps } from 'payload';
import { allSpecies, bloodlineLabel, eggs, starterBloodlines } from '@acme/content';
import { AuditViewClient, CallersViewClient, ConsentViewClient, ContentViewClient, MonsViewClient, OverviewViewClient, SettingsViewClient } from './ViewsClient';

function requireUser({ initPageResult }: AdminViewServerProps): NonNullable<AdminViewServerProps['initPageResult']['req']['user']> | null {
  const { req } = initPageResult;
  if (!req.user) { req.server?.redirect(`${req.payload.config.routes.admin}/login`); return null; }
  return req.user;
}

export async function OverviewView(props: AdminViewServerProps) {
  const user = requireUser(props); if (!user) return null;
  const { req } = props.initPageResult;
  const [consents, eggs, mons, runs, events] = await Promise.all([
    req.payload.count({ collection: 'guardian-consents', where: { status: { equals: 'pending' } }, user, overrideAccess: false, req }),
    req.payload.count({ collection: 'eggs', user, overrideAccess: false, req }), req.payload.count({ collection: 'mon-instances', user, overrideAccess: false, req }),
    req.payload.find({ collection: 'integrity-runs', sort: '-at', limit: 1, depth: 0, select: { at: true, sharedEgg: true, idMismatch: true, orphans: true, staleReady: true }, user, overrideAccess: false, req }),
    req.payload.find({ collection: 'audit-events', sort: '-at', limit: 8, depth: 0, select: { at: true, action: true, targetType: true, targetId: true }, user, overrideAccess: false, req }),
  ]);
  return <OverviewViewClient counts={{ consents: consents.totalDocs, eggs: eggs.totalDocs, mons: mons.totalDocs }} run={runs.docs[0] ?? null} events={events.docs.map((event) => ({ id: String(event.id), at: event.at, action: event.action, target: `${event.targetType} ${event.targetId}` }))} />;
}

export async function CallersView(props: AdminViewServerProps) {
  const user = requireUser(props); if (!user) return null; const { req } = props.initPageResult;
  // Named view params (:callerId) are matched for routing but never extracted;
  // the adapter only supplies `params.segments`, so the id is segments[1].
  const route = await props.params; const selectedId = typeof route?.segments?.[1] === 'string' ? route.segments[1] : null;
  const result = await req.payload.find({ collection: 'users', where: { role: { equals: 'user' } }, sort: '-createdAt', limit: 50, depth: 0, select: { email: true, name: true, birthYear: true, consentStatus: true, deletionScheduledFor: true, updatedAt: true, createdAt: true }, user, overrideAccess: false, req });
  const callers = result.docs.map((doc) => ({ id: String(doc.id), email: doc.email.replace(/(^.).*(@.).*(\..+$)/, '$1•••$2•••$3'), name: doc.name ? 'Hidden' : 'Not given', age: doc.birthYear ? (new Date().getUTCFullYear() - doc.birthYear < 13 ? 'Under 13' : new Date().getUTCFullYear() - doc.birthYear < 18 ? '13 to 17' : '18 and over') : 'Not given', consent: doc.consentStatus ?? 'not-required', joined: doc.createdAt, updatedAt: doc.updatedAt, deletionScheduledFor: doc.deletionScheduledFor ?? null }));
  return <CallersViewClient callers={callers} selectedId={selectedId} page={result.page ?? 1} pageCount={result.totalPages} totalCount={result.totalDocs} />;
}

export async function ConsentView(props: AdminViewServerProps) {
  const user = requireUser(props); if (!user) return null; const { req } = props.initPageResult; const route = await props.params;
  const result = await req.payload.find({ collection: 'guardian-consents', sort: '-createdAt', limit: 50, depth: 0, select: { parentEmail: true, birthYear: true, status: true, expiresAt: true, emailsSent: true, parentRequest: true, updatedAt: true, createdAt: true }, user, overrideAccess: false, req });
  return <ConsentViewClient selectedId={typeof route?.segments?.[1] === 'string' ? route.segments[1] : null} consents={result.docs.map((doc) => ({ id: String(doc.id), parentEmail: doc.parentEmail.replace(/(^.).*(@.).*(\..+$)/, '$1•••$2•••$3'), age: new Date().getUTCFullYear() - doc.birthYear < 13 ? 'Under 13' : '13 to 17', status: doc.status, expiresAt: doc.expiresAt, emailsSent: doc.emailsSent, updatedAt: doc.updatedAt }))} />;
}

export async function MonsView(props: AdminViewServerProps) {
  const user = requireUser(props); if (!user) return null; const { req } = props.initPageResult;
  const [mons, eggs, runs] = await Promise.all([
    req.payload.find({ collection: 'mon-instances', sort: '-createdAt', limit: 50, depth: 0, select: { monInstanceId: true, eggId: true, speciesId: true, callerId: true, stage: true, bond: true, serverConfirmedAt: true }, user, overrideAccess: false, req }),
    req.payload.find({ collection: 'eggs', sort: '-createdAt', limit: 50, depth: 0, select: { eggId: true, speciesId: true, callerId: true, incubationEndsAt: true, hatched: true }, user, overrideAccess: false, req }),
    req.payload.find({ collection: 'integrity-runs', sort: '-at', limit: 1, depth: 0, select: { at: true, sharedEgg: true, idMismatch: true, orphans: true, staleReady: true }, user, overrideAccess: false, req }),
  ]);
  return <MonsViewClient mons={mons.docs.map((doc) => ({ id: doc.monInstanceId, eggId: doc.eggId, species: doc.speciesId, caller: doc.callerId, stage: doc.stage, bond: doc.bond, confirmed: Boolean(doc.serverConfirmedAt) }))} eggs={eggs.docs.map((doc) => ({ id: doc.eggId, species: doc.speciesId, caller: doc.callerId, ends: doc.incubationEndsAt, hatched: doc.hatched }))} run={runs.docs[0] ?? null} />;
}

export async function ContentView(props: AdminViewServerProps) {
  if (!requireUser(props)) return null;
  // Authored content ships in code (packages/content); the roster's unsettled
  // TODO(canon) fields stay null here and render as — in the table.
  const nameBySpeciesId = new Map(allSpecies.map((species) => [species.speciesId, species.formName ?? species.speciesId]));
  const labelByBloodlineId = new Map(starterBloodlines.map(({ bloodline }) => [bloodline.bloodlineId, bloodlineLabel(bloodline)]));
  return <ContentViewClient speciesCount={allSpecies.length} bloodlines={starterBloodlines.map(({ bloodline, forms }) => ({ id: bloodline.bloodlineId, name: bloodlineLabel(bloodline), forms: forms.map((form) => ({ id: form.speciesId, dex: form.dexId, name: form.formName, stage: form.stage, culture: form.cultureNote, scale: form.scaleMeters, affinity: form.affinityId, clazz: form.classId, rig: form.rigDefinitionId, food: form.foodClassIds })) }))} eggs={eggs.map((egg) => ({ id: egg.speciesId, name: egg.eggName, hatches: nameBySpeciesId.get(egg.hatchesIntoSpeciesId) ?? egg.hatchesIntoSpeciesId, bloodline: labelByBloodlineId.get(egg.bloodlineId) ?? egg.bloodlineId }))} />;
}

export async function AuditView(props: AdminViewServerProps) {
  const user = requireUser(props); if (!user) return null; const { req } = props.initPageResult; const route = await props.params;
  const result = await req.payload.find({ collection: 'audit-events', sort: '-at', limit: 50, depth: 0, select: { at: true, actorRole: true, action: true, targetType: true, targetId: true, reasonCode: true }, user, overrideAccess: false, req });
  return <AuditViewClient selectedId={typeof route?.segments?.[1] === 'string' ? route.segments[1] : null} events={result.docs.map((event) => ({ id: String(event.id), at: event.at, actor: event.actorRole, action: event.action, target: `${event.targetType} ${event.targetId}`, reason: event.reasonCode ?? '—' }))} />;
}

export async function SettingsView(props: AdminViewServerProps) {
  const user = requireUser(props); if (!user) return null; const { req } = props.initPageResult;
  const result = await req.payload.find({ collection: 'users', where: { role: { in: ['ops', 'support', 'consent', 'content'] } }, sort: 'email', limit: 100, depth: 0, select: { email: true, role: true }, user, overrideAccess: false, req });
  return <SettingsViewClient staff={result.docs.map((doc) => ({ id: String(doc.id), email: doc.email, role: doc.role ?? 'support' }))} isOps={user.role === 'ops'} />;
}
