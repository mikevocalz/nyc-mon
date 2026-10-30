'use client';
import { useRouter } from '@payloadcms/ui';
import { useEffect } from 'react';
import { Badge, Banner, Button, Card, ConfirmDestructive, DropZone, EmptyState, ErrorMessage, Image, KeyValueList, ProgressBar, TextField, Timestamp, type DropAsset } from '@acme/ui/admin';
import { Heading, Paragraph, Section } from '@acme/ui/html';
import { checkMonArtAlt, checkMonArtFile, MON_ART_FILE_MESSAGES, readImageFacts } from '../../../collections/monArtFile.ts';
import { consoleCopy } from '../copy';
import { useStillArtStore } from '../stores';

const copy = consoleCopy.stills;
const statusCopy = consoleCopy.models.stillStatus;
const API = '/payload-api/mon-art';

export type StillStatus = 'in-review' | 'approved';
export type StillDoc = {
  id: string; speciesId: string; status: StillStatus; url: string | null; alt: string;
  filename: string | null; filesize: number | null; width: number | null; height: number | null; updatedAt: string;
};

const tone = { missing: 'neutral', 'in-review': 'info', approved: 'success' } as const;
const fileSize = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);
const json = (method: string, data: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

const firstError = (text: string) => {
  try {
    return (JSON.parse(text) as { errors?: { message?: string; data?: { errors?: { message?: string }[] } }[] }).errors?.[0]?.message ?? consoleCopy.errors.action;
  } catch {
    return consoleCopy.errors.action;
  }
};

async function send(url: string, init: RequestInit): Promise<string | null> {
  try {
    const response = await fetch(url, { credentials: 'include', ...init });
    return response.ok ? null : firstError(await response.text());
  } catch {
    return consoleCopy.errors.action;
  }
}

/** Multipart upload with progress (XMLHttpRequest is the one browser API that reports it). */
function upload(url: string, method: 'POST' | 'PATCH', body: FormData, onProgress: (percent: number | null) => void): Promise<string | null> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => onProgress(event.lengthComputable ? Math.round((event.loaded / event.total) * 100) : null);
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300 ? null : xhr.status === 413 ? MON_ART_FILE_MESSAGES.size : firstError(xhr.responseText));
    xhr.onerror = () => resolve(consoleCopy.models.uploadNetwork);
    xhr.onabort = () => resolve(consoleCopy.models.uploadNetwork);
    xhr.send(body);
  });
}

/**
 * One form's still picture on the Models page: drop, preview, describe,
 * save, approve. Same flow as the 3D model above it; the server checks the
 * same rules again (collections/MonArt.ts).
 */
export function StillArtPanel({ speciesId, formName, still, canEdit }: { speciesId: string; formName: string; still: StillDoc | null; canEdit: boolean }) {
  const router = useRouter();
  const store = useStillArtStore();
  const formKey = `${speciesId}@${still ? `${still.id}/${still.filename}` : 'new'}`;

  useEffect(() => {
    store.load(formKey, still?.alt ?? '');
    // Reload only when the form or its stored picture changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey]);

  const state = still?.status ?? 'missing';
  const shown = store.pending?.url ?? still?.url ?? null;
  const altChanged = Boolean(still) && store.alt.trim() !== still?.alt;

  const onDrop = async ({ assets }: { assets: DropAsset[] }) => {
    store.setDragging(false);
    const [asset, ...extra] = assets;
    extra.forEach((item) => item.release?.());
    if (!asset?.file || !asset.uri) { asset?.release?.(); store.setError(MON_ART_FILE_MESSAGES.type); return; }
    const check = checkMonArtFile(asset.file);
    if (!check.ok) { asset.release?.(); store.setError(MON_ART_FILE_MESSAGES[check.problem]); return; }
    let facts = null;
    try {
      facts = readImageFacts(new Uint8Array(await asset.file.slice(0, 64 * 1024).arrayBuffer()));
    } catch {
      facts = null;
    }
    if (!facts) { asset.release?.(); store.setError(MON_ART_FILE_MESSAGES.header); return; }
    store.setPending({ url: asset.uri, name: asset.file.name, file: asset.file, release: asset.release });
    if (extra.length) store.setNotice(copy.oneFile);
  };

  const save = async () => {
    if (!checkMonArtAlt(store.alt)) { store.setError(MON_ART_FILE_MESSAGES.alt); return; }
    const alt = store.alt.trim();
    if (store.pending) {
      store.setBusy('upload');
      store.setProgress(0);
      const body = new FormData();
      body.append('file', store.pending.file, store.pending.name);
      body.append('_payload', JSON.stringify(still ? { alt } : { speciesId, alt }));
      const error = await upload(still ? `${API}/${still.id}` : API, still ? 'PATCH' : 'POST', body, store.setProgress);
      store.setBusy(null);
      store.setProgress(null);
      if (useStillArtStore.getState().formKey !== formKey) { router.refresh(); return; }
      if (error) { store.setError(error); return; }
      store.setPending(null);
    } else if (still) {
      store.setBusy('save');
      const error = await send(`${API}/${still.id}`, json('PATCH', { alt }));
      store.setBusy(null);
      if (error) { store.setError(error); return; }
    }
    store.setNotice(copy.saved);
    router.refresh();
  };

  const setStatus = async (status: StillStatus) => {
    if (!still) return;
    store.setBusy('status');
    const error = await send(`${API}/${still.id}`, json('PATCH', { status }));
    store.setBusy(null);
    if (error) { store.setError(error); return; }
    router.refresh();
  };

  return (
    <Section className="gap-4" testID="still-art" aria-labelledby="still-art-heading">
      <Section className="flex-row flex-wrap items-center gap-3">
        <Heading level={3} id="still-art-heading">{copy.heading}</Heading>
        <Badge label={statusCopy[state]} tone={tone[state]} />
      </Section>
      <Paragraph>{copy.intro}</Paragraph>
      <Card elevation="raised" padded={false}>
        <Section className="relative h-80 md:h-[28rem]" aria-label={copy.preview}>
          {shown ? (
            <Image src={shown} alt={store.alt.trim() || formName} fill framed={false} unoptimized contentFit="contain" className="h-full w-full" />
          ) : (
            <EmptyState title={copy.preview} description={copy.empty} />
          )}
        </Section>
      </Card>
      {canEdit ? (
        <DropZone
          active={store.dragging}
          title={still ? copy.dropReplace : copy.dropAdd}
          description={copy.dropHint}
          browseLabel={copy.browse}
          accept=".webp,.png,.jpg,.jpeg,image/webp,image/png,image/jpeg"
          onEnter={() => store.setDragging(true)}
          onExit={() => store.setDragging(false)}
          onDrop={(event) => void onDrop(event)}
        />
      ) : null}
      {store.pending ? <Banner tone="info" title={copy.previewing(store.pending.name)} /> : null}
      {canEdit && (store.pending || still) ? (
        <Section className="gap-3">
          <TextField label={copy.alt} hint={copy.altHint} value={store.alt} onChangeText={store.setAlt} />
          <Section className="flex-row flex-wrap gap-2">
            {store.pending || altChanged ? (
              <Button
                title={store.pending ? (still ? copy.replace : copy.save) : copy.saveAlt}
                loading={store.busy === 'upload' || store.busy === 'save'}
                onPress={() => void save()}
              />
            ) : null}
            {store.pending ? <Button title={copy.discard} variant="ghost" onPress={() => store.setPending(null)} /> : null}
          </Section>
        </Section>
      ) : null}
      {store.busy === 'upload' ? (
        store.progress === null
          ? <ProgressBar indeterminate label={copy.uploading} showLabel accessibilityLabel={copy.uploading} />
          : <ProgressBar value={store.progress} label={copy.uploadingPercent(store.progress)} showLabel accessibilityLabel={copy.uploading} />
      ) : null}
      {store.error ? <ErrorMessage surface="page" message={store.error} /> : null}
      {store.notice ? <Banner tone="success" title={store.notice} live="status" /> : null}
      {still ? (
        <>
          <KeyValueList columns={2} items={[
            { key: 'file', label: copy.file, value: still.filename ?? copy.none },
            { key: 'size', label: copy.size, value: still.filesize ? fileSize(still.filesize) : copy.none },
            { key: 'pixels', label: copy.dimensions, value: still.width && still.height ? `${still.width} × ${still.height}` : copy.none },
            { key: 'updated', label: copy.updated, value: <Timestamp at={new Date(still.updatedAt)} format="both" /> },
          ]} />
          <Banner
            tone={still.status === 'approved' ? 'success' : 'neutral'}
            title={still.status === 'approved' ? copy.approved : copy.review}
            action={canEdit ? <Button title={still.status === 'approved' ? copy.unapprove : copy.approve} variant={still.status === 'approved' ? 'outline' : 'primary'} loading={store.busy === 'status'} onPress={() => void setStatus(still.status === 'approved' ? 'in-review' : 'approved')} /> : undefined}
          />
          {canEdit ? <Button title={copy.remove} variant="danger" onPress={() => store.openDialog('delete-still')} /> : null}
          <ConfirmDestructive
            open={store.dialog === 'delete-still'}
            title={copy.removeTitle}
            consequences={[copy.removeConsequence]}
            confirmText={speciesId}
            confirmLabel={copy.remove}
            onClose={store.closeDialog}
            onConfirm={async () => { const error = await send(`${API}/${still.id}`, { method: 'DELETE' }); if (error) throw new Error(error); store.closeDialog(); router.refresh(); }}
          />
        </>
      ) : null}
    </Section>
  );
}
