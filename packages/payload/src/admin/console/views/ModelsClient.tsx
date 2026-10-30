'use client';
import { useRouter } from '@payloadcms/ui';
import { lazy, Suspense, useEffect, useSyncExternalStore } from 'react';
import { Badge, Banner, Button, Card, ConfirmDestructive, DataTable, DropZone, EmptyState, ErrorMessage, FieldGroup, KeyValueList, LoadingSkeleton, ProgressBar, SegmentedControl, Select, SignageBand, Textarea, TextField, Timestamp, type ColumnDef, type DropAsset } from '@acme/ui/admin';
import { Heading, Paragraph, Section } from '@acme/ui/html';
import { MON_ANIMATION_ROLES, MON_MODEL_LICENSES } from '../../../collections/monModelOptions.ts';
import { checkGlbHeader, checkMonModelFile, MON_MODEL_FILE_MESSAGES } from '../../../collections/monModelFile.ts';
import { consoleCopy } from '../copy';
import { useModelsStore, type ModelDraft, type ModelFilter, type ModelYaw } from '../stores';
import { ConsoleShell } from '../Shell';
import { needsChunkedUpload, uploadModelInChunks, type ChunkTransport, type SendResult } from './modelUpload.ts';

// The Viro web renderer is browser-only (WASM + WebGL), so it loads after hydration.
const MonModelViewer = lazy(() => import('@acme/spatial/model-viewer').then((module) => ({ default: module.MonModelViewer })));
const useHydrated = () => useSyncExternalStore(() => () => {}, () => true, () => false);

const copy = consoleCopy.models;
const API = '/payload-api/mon-models';

type Vec3 = [number, number, number];
type ModelStatus = 'in-review' | 'approved';
export type ModelDoc = {
  id: string; speciesId: string; status: ModelStatus; url: string | null; filename: string | null; filesize: number | null; updatedAt: string;
  scale: number; position: Vec3; rotation: Vec3;
  animations: { role: string; clip: string; loop: boolean }[];
  animationClips: string[]; morphTargets: string[]; heightMeters: number | null;
  credit: { author: string; license: string; sourceUrl: string }; notes: string;
};
type Form = { id: string; dex: number | null; name: string; stage: string; bloodline: string };
type Row = Form & { model: ModelDoc | null; state: 'missing' | ModelStatus };

const dexLabel = (dex: number | null) => (dex === null ? '—' : `#${String(dex).padStart(3, '0')}`);
const statusTone = { missing: 'neutral', 'in-review': 'info', approved: 'success' } as const;
const fileSize = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);
const columns: ColumnDef<Row, unknown>[] = [
  { accessorKey: 'dex', header: copy.colDex, cell: ({ row }) => dexLabel(row.original.dex) },
  { accessorKey: 'name', header: copy.colForm },
  { accessorKey: 'stage', header: copy.colStage },
  { accessorKey: 'state', header: copy.colModel, cell: ({ row }) => <Badge label={copy.status[row.original.state]} tone={statusTone[row.original.state]} size="sm" /> },
];

function draftFrom(model: ModelDoc | null): ModelDraft {
  const clips = Object.fromEntries(MON_ANIMATION_ROLES.map((role) => [role, model?.animations.find((row) => row.role === role)?.clip ?? '']));
  return {
    scale: String(model?.scale ?? 1),
    position: (model?.position ?? [0, 0, 0]).map(String) as ModelDraft['position'],
    rotation: (model?.rotation ?? [0, 0, 0]).map(String) as ModelDraft['rotation'],
    clips,
    author: model?.credit.author ?? '', license: model?.credit.license ?? 'owned', sourceUrl: model?.credit.sourceUrl ?? '', notes: model?.notes ?? '',
  };
}

const toVec = (values: readonly string[]): Vec3 | null => {
  const numbers = values.map(Number);
  return numbers.every(Number.isFinite) ? (numbers as Vec3) : null;
};

/** Payload REST: the first error message, or a generic one. */
async function send(url: string, init: RequestInit): Promise<string | null> {
  try {
    const response = await fetch(url, { credentials: 'include', ...init });
    if (response.ok) return null;
    if (response.status === 413) return copy.tooLarge;
    const body = (await response.json().catch(() => ({}))) as { errors?: { message?: string }[] };
    return body.errors?.[0]?.message ?? consoleCopy.errors.action;
  } catch {
    return consoleCopy.errors.action;
  }
}

/**
 * Multipart upload through XMLHttpRequest, the one browser API that reports
 * upload progress. Same result shape as `send`.
 */
function sendWithProgress(url: string, method: 'POST' | 'PATCH', body: FormData, onProgress: (percent: number | null) => void): Promise<string | null> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => onProgress(event.lengthComputable ? Math.round((event.loaded / event.total) * 100) : null);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { resolve(null); return; }
      if (xhr.status === 413) { resolve(copy.tooLarge); return; }
      try {
        const parsed = JSON.parse(xhr.responseText) as { errors?: { message?: string }[] };
        resolve(parsed.errors?.[0]?.message ?? consoleCopy.errors.action);
      } catch {
        resolve(consoleCopy.errors.action);
      }
    };
    xhr.onerror = () => resolve(copy.uploadNetwork);
    xhr.onabort = () => resolve(copy.uploadNetwork);
    xhr.send(body);
  });
}

const json = (method: string, data: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

const errorMessage = (text: string) => {
  try {
    return (JSON.parse(text) as { errors?: { message?: string }[] }).errors?.[0]?.message ?? consoleCopy.errors.action;
  } catch {
    return consoleCopy.errors.action;
  }
};

/** fetch for the JSON calls, XMLHttpRequest for chunk bytes (the one API with upload progress). */
const chunkTransport: ChunkTransport = {
  json: async <T,>(url: string, method: 'POST' | 'DELETE', body?: unknown): Promise<SendResult<T>> => {
    try {
      const response = await fetch(url, { credentials: 'include', ...(body === undefined ? { method } : json(method, body)) });
      const text = await response.text();
      return response.ok ? { ok: true, data: (text ? JSON.parse(text) : {}) as T } : { ok: false, message: errorMessage(text) };
    } catch {
      return { ok: false, message: copy.uploadNetwork };
    }
  },
  chunk: (url, body, onSent) => new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.upload.onprogress = (event) => onSent(event.loaded);
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300 ? { ok: true, data: null } : { ok: false, message: xhr.status === 413 ? copy.tooLarge : errorMessage(xhr.responseText) });
    xhr.onerror = () => resolve({ ok: false, message: copy.uploadNetwork });
    xhr.onabort = () => resolve({ ok: false, message: copy.uploadNetwork });
    xhr.send(body);
  }),
};

export function ModelsViewClient({ forms, models, failed = false, selectedId, canEdit }: { forms: Form[]; models: ModelDoc[]; failed?: boolean; selectedId: string | null; canEdit: boolean }) {
  const router = useRouter();
  const store = useModelsStore();
  const hydrated = useHydrated();
  const bySpecies = new Map(models.map((model) => [model.speciesId, model]));
  const rows: Row[] = forms.map((form) => { const model = bySpecies.get(form.id) ?? null; return { ...form, model, state: model?.status ?? 'missing' }; });
  const shown = store.filter === 'all' ? rows : rows.filter((row) => row.state === store.filter);
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const model = selected?.model ?? null;
  // Keyed on the stored file, not updatedAt: approving or saving fields must not wipe a dropped file or unsaved edits.
  const draftKey = selected ? `${selected.id}@${model ? `${model.id}/${model.filename}` : 'new'}` : null;

  useEffect(() => {
    if (draftKey === null) return;
    store.setPending(null);
    store.loadDraft(draftKey, draftFrom(model));
    // Reload only when the form or its saved version changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  const waiting = rows.filter((row) => row.state === 'in-review').length;
  const draft = store.draftKey === draftKey ? store.draft : null;
  const viewerUrl = store.pending?.url ?? model?.url ?? null;
  const clips = store.pending ? [] : (model?.animationClips ?? []);

  const onDrop = async ({ assets }: { assets: DropAsset[] }) => {
    store.setDragging(false);
    const [asset, ...extra] = assets;
    extra.forEach((item) => item.release?.());
    if (!asset?.file || !asset.uri) { asset?.release?.(); store.setError(copy.wrongType); return; }
    // Name and size first, then the 12-byte GLB header, before the viewer or the server sees it.
    let check = checkMonModelFile(asset.file);
    if (check.ok) {
      try {
        check = checkGlbHeader(new Uint8Array(await asset.file.slice(0, 12).arrayBuffer()), asset.file.size);
      } catch {
        check = { ok: false, problem: 'header' };
      }
    }
    if (!check.ok) { asset.release?.(); store.setError(MON_MODEL_FILE_MESSAGES[check.problem]); return; }
    store.setPending({ url: asset.uri, name: asset.file.name, file: asset.file, release: asset.release });
    if (extra.length) store.setNotice(copy.oneFile);
  };

  const uploadPending = async () => {
    if (!selected || !store.pending) return;
    const { file, name } = store.pending;
    store.setBusy('upload');
    store.setProgress(0);
    let error: string | null;
    if (needsChunkedUpload(file.size)) {
      // Over the 4.5 MB function body limit: staged chunks, joined on the server.
      error = await uploadModelInChunks(file, name, model ? { id: model.id } : { speciesId: selected.id }, chunkTransport, store.setProgress);
    } else {
      const body = new FormData();
      body.append('file', file, name);
      // A new form's placement starts from defaults; a replacement keeps its saved placement and credit.
      body.append('_payload', JSON.stringify(model ? {} : { speciesId: selected.id }));
      error = await sendWithProgress(model ? `${API}/${model.id}` : API, model ? 'PATCH' : 'POST', body, store.setProgress);
    }
    store.setBusy(null);
    store.setProgress(null);
    // The editor may have opened another form while this uploaded.
    if (useModelsStore.getState().draftKey !== draftKey) { router.refresh(); return; }
    if (error) { store.setError(error); return; }
    store.setPending(null);
    store.setNotice(copy.saved);
    router.refresh();
  };

  const saveDraft = async () => {
    if (!model || !draft) return;
    const scale = Number(draft.scale); const position = toVec(draft.position); const rotation = toVec(draft.rotation);
    if (!Number.isFinite(scale) || scale <= 0 || !position || !rotation) { store.setError(copy.badNumber); return; }
    store.setBusy('save');
    const error = await send(`${API}/${model.id}`, json('PATCH', {
      scale,
      position: { x: position[0], y: position[1], z: position[2] },
      rotation: { x: rotation[0], y: rotation[1], z: rotation[2] },
      // Hatch and evolve play once; every other moment loops.
      animations: MON_ANIMATION_ROLES.filter((role) => draft.clips[role]).map((role) => ({ role, clip: draft.clips[role], loop: role !== 'hatch' && role !== 'evolve' })),
      credit: { author: draft.author, license: draft.license, sourceUrl: draft.sourceUrl },
      notes: draft.notes,
    }));
    store.setBusy(null);
    if (error) { store.setError(error); return; }
    store.setNotice(copy.saved);
    router.refresh();
  };

  const setStatus = async (status: ModelStatus) => {
    if (!model) return;
    store.setBusy('status');
    const error = await send(`${API}/${model.id}`, json('PATCH', { status }));
    store.setBusy(null);
    if (error) { store.setError(error); return; }
    router.refresh();
  };

  const placement = draft ? { scale: Number(draft.scale) || 1, position: toVec(draft.position) ?? [0, 0, 0], rotation: toVec(draft.rotation) ?? [0, 0, 0] } : { scale: 1, position: [0, 0, 0] as Vec3, rotation: [0, 0, 0] as Vec3 };
  const clipOptions = [{ value: '', label: copy.noClip }, ...(model?.animationClips ?? []).map((clip) => ({ value: clip }))];

  return (
    <ConsoleShell section="models" heading={copy.heading}>
      <SignageBand tone="signage" headline={copy.coverage(models.length, forms.length)} detail={waiting ? copy.waiting(waiting) : copy.allReviewed} />
      <SegmentedControl<ModelFilter>
        aria-label={copy.filterLabel}
        options={(['all', 'missing', 'in-review', 'approved'] as const).map((value) => ({ value, label: copy.filters[value] }))}
        value={store.filter}
        onChange={store.setFilter}
      />
      <Section className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Section>
          <DataTable testID="models-table" surface="page" pageSize={12} caption={copy.heading} data={shown} columns={columns} getRowId={(row) => row.id} getRowHref={(row) => `/admin/models/${row.id}`} selectedRowId={selectedId ?? undefined} filter={{ label: copy.search }} emptyState={<Paragraph>{copy.emptyFilter}</Paragraph>} error={failed ? { message: consoleCopy.errors.load, retryLabel: consoleCopy.errors.retry, onRetry: router.refresh } : undefined} />
        </Section>
        {selected ? (
          <Section className="gap-5" testID="model-detail">
            <Section className="flex-row flex-wrap items-center gap-3">
              <Heading level={2}>{`${dexLabel(selected.dex)} ${selected.name}`}</Heading>
              <Badge label={copy.status[selected.state]} tone={statusTone[selected.state]} />
            </Section>
            <Paragraph>{`${selected.stage}. ${selected.bloodline}.`}</Paragraph>

            <Card elevation="raised">
            <Section className="h-80 md:h-[28rem]" aria-label={copy.viewer}>
              {!viewerUrl ? (
                <EmptyState title={copy.viewer} description={copy.viewerEmpty} />
              ) : store.viewerError ? (
                <ErrorMessage surface="page" message={copy.viewerFailed} />
              ) : hydrated ? (
                <Suspense fallback={<LoadingSkeleton />}>
                  <MonModelViewer
                    url={viewerUrl}
                    scale={placement.scale}
                    position={placement.position}
                    rotation={placement.rotation}
                    yaw={Number(store.yaw)}
                    heightMeters={store.pending ? null : model?.heightMeters}
                    clip={store.clip || undefined}
                    onError={(error) => { console.error('[models] viewer failed', error); store.setViewerError(true); }}
                  />
                </Suspense>
              ) : <LoadingSkeleton />}
            </Section>
            </Card>
            {viewerUrl ? (
              <Section className="gap-4 md:flex-row md:items-end">
                <SegmentedControl<ModelYaw>
                  aria-label={copy.angle}
                  options={(['0', '90', '180', '270'] as const).map((value) => ({ value, label: copy.angles[value] }))}
                  value={store.yaw}
                  onChange={store.setYaw}
                />
                {clips.length ? <Select label={copy.play} value={store.clip} options={[{ value: '', label: copy.still }, ...clips.map((clip) => ({ value: clip }))]} onValueChange={store.setClip} /> : null}
              </Section>
            ) : null}

            {canEdit ? (
              <DropZone
                active={store.dragging}
                title={model ? copy.dropReplace : copy.dropAdd}
                description={copy.dropHint}
                browseLabel={copy.browse}
                accept=".glb,model/gltf-binary"
                onEnter={() => store.setDragging(true)}
                onExit={() => store.setDragging(false)}
                onDrop={(event) => void onDrop(event)}
              />
            ) : null}
            {store.pending ? (
              <Banner
                tone="info"
                title={copy.previewing(store.pending.name)}
                action={<Section className="flex-row gap-2"><Button title={model ? copy.replaceModel : copy.saveModel} loading={store.busy === 'upload'} onPress={() => void uploadPending()} /><Button title={copy.discard} variant="ghost" onPress={() => store.setPending(null)} /></Section>}
              />
            ) : null}
            {store.busy === 'upload' ? (
              store.progress === null
                ? <ProgressBar indeterminate label={copy.uploading} showLabel accessibilityLabel={copy.uploading} />
                : <ProgressBar value={store.progress} label={copy.uploadingPercent(store.progress)} showLabel accessibilityLabel={copy.uploading} />
            ) : null}
            {store.error ? <ErrorMessage surface="page" message={store.error} /> : null}
            {store.notice ? <Banner tone="success" title={store.notice} live="status" /> : null}

            {model ? (
              <>
                <KeyValueList columns={2} items={[
                  { key: 'file', label: copy.file, value: model.filename ?? copy.none },
                  { key: 'size', label: copy.size, value: model.filesize ? fileSize(model.filesize) : copy.none },
                  { key: 'height', label: copy.height, value: model.heightMeters === null ? copy.none : `${model.heightMeters} m` },
                  { key: 'clips', label: copy.clips, value: model.animationClips.join(', ') || copy.none },
                  { key: 'morphs', label: copy.morphs, value: model.morphTargets.join(', ') || copy.none },
                  { key: 'updated', label: copy.updated, value: <Timestamp at={new Date(model.updatedAt)} format="both" /> },
                ]} />
                <Banner
                  tone={model.status === 'approved' ? 'success' : 'neutral'}
                  title={model.status === 'approved' ? copy.approved : copy.review}
                  action={canEdit ? <Button title={model.status === 'approved' ? copy.unapprove : copy.approve} variant={model.status === 'approved' ? 'outline' : 'primary'} loading={store.busy === 'status'} onPress={() => void setStatus(model.status === 'approved' ? 'in-review' : 'approved')} /> : undefined}
                />
                {canEdit && draft ? (
                  <FieldGroup>
                    <FieldGroup.Section title={copy.placement}>
                      <TextField label={copy.scale} hint={copy.scaleHint} value={draft.scale} onChangeText={(scale) => store.editDraft({ scale })} keyboardType="decimal-pad" />
                      {(['position', 'rotation'] as const).map((key) => (
                        <Section key={key} className="grid grid-cols-3 gap-3" aria-label={copy[key]}>
                          {(['x', 'y', 'z'] as const).map((axis, index) => (
                            <TextField key={axis} label={`${copy[key]} ${axis.toUpperCase()}`} value={draft[key][index]} keyboardType="numbers-and-punctuation"
                              onChangeText={(text) => store.editDraft({ [key]: draft[key].map((value, i) => (i === index ? text : value)) as ModelDraft['position'] })} />
                          ))}
                        </Section>
                      ))}
                    </FieldGroup.Section>
                    <FieldGroup.Section title={copy.animations}>
                      <Paragraph>{model.animationClips.length ? copy.animationsHint : copy.noClips}</Paragraph>
                      {model.animationClips.length ? MON_ANIMATION_ROLES.map((role) => (
                        <Select key={role} label={copy.roles[role]} value={draft.clips[role] ?? ''} options={clipOptions} onValueChange={(clip) => store.editDraft({ clips: { ...draft.clips, [role]: clip } })} />
                      )) : null}
                    </FieldGroup.Section>
                    <FieldGroup.Section title={copy.credit}>
                      <TextField label={copy.author} value={draft.author} onChangeText={(author) => store.editDraft({ author })} />
                      <Select label={copy.license} value={draft.license} options={MON_MODEL_LICENSES.map((value) => ({ value, label: copy.licenses[value] }))} onValueChange={(license) => store.editDraft({ license })} />
                      <TextField label={copy.sourceUrl} value={draft.sourceUrl} onChangeText={(sourceUrl) => store.editDraft({ sourceUrl })} keyboardType="url" autoCapitalize="none" />
                      <Textarea label={copy.notes} value={draft.notes} onChangeText={(notes) => store.editDraft({ notes })} />
                      <FieldGroup.SectionFooter>
                        <Button title={store.busy === 'save' ? copy.saving : copy.saveChanges} loading={store.busy === 'save'} onPress={() => void saveDraft()} />
                      </FieldGroup.SectionFooter>
                    </FieldGroup.Section>
                  </FieldGroup>
                ) : null}
                {canEdit ? <Button title={copy.remove} variant="danger" onPress={() => store.openDialog('delete')} /> : null}
                <ConfirmDestructive
                  open={store.dialog === 'delete'}
                  title={copy.removeTitle}
                  consequences={[copy.removeConsequence]}
                  confirmText={selected.id}
                  confirmLabel={copy.remove}
                  onClose={store.closeDialog}
                  onConfirm={async () => { const error = await send(`${API}/${model.id}`, { method: 'DELETE' }); if (error) throw new Error(error); store.closeDialog(); router.refresh(); }}
                />
              </>
            ) : null}
          </Section>
        ) : (
          <EmptyState title={copy.pickTitle} description={copy.pickBody} />
        )}
      </Section>
    </ConsoleShell>
  );
}
