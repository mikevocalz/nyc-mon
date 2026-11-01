// Staged upload endpoints for Mon model files over the 4.5 MB function body
// limit (storage/stagedUpload.ts explains the flow). Same roles as the
// collection's create/update access; the commit goes through the Local API with
// overrideAccess: false, so the collection's own access and hooks decide the rest.
import type { PayloadRequest } from 'payload';
import { checkGlbHeader, checkMonModelFile, MON_MODEL_CHUNK_BYTES, MON_MODEL_FILE_MESSAGES, chunkCount } from '../../../collections/monModelFile.ts';
import { bunnyStorageConfigured, deleteStorageObject, getStorageObject, putStorageObject } from '../../../storage/bunnyMedia.ts';
import { assembleChunks, chunkKey, chunkProblem, issueUploadToken, readUploadToken, stagingFolder, type StagedUpload } from '../../../storage/stagedUpload.ts';
import { ConsoleError } from './errors.ts';
import { readBody, requireStaff } from './helpers.ts';

const EDITORS = ['ops', 'content'] as const;

const json = (body: unknown, status = 200) => Response.json(body, { status });

function requireEditor(req: PayloadRequest): string | number {
  requireStaff(req, EDITORS);
  if (!bunnyStorageConfigured()) throw new ConsoleError('INVALID_RECORD', 503, 'Model storage is not set up on this server.');
  return req.user!.id;
}

function requireUpload(req: PayloadRequest): StagedUpload {
  const user = requireEditor(req);
  const upload = readUploadToken(req.routeParams?.token, { user, now: Date.now(), secret: req.payload.secret });
  if (!upload) throw new ConsoleError('NOT_FOUND', 404, 'This upload has expired. Choose the file again.');
  return upload;
}

/** POST /console/models/uploads { name, size } → { token, chunkBytes, chunks } */
export async function startModelUpload(req: PayloadRequest): Promise<Response> {
  const user = requireEditor(req);
  const data = await readBody(req);
  const name = typeof data?.name === 'string' ? data.name : '';
  const size = typeof data?.size === 'number' ? data.size : Number.NaN;
  if (!Number.isSafeInteger(size)) throw new ConsoleError('INVALID_RECORD', 400, MON_MODEL_FILE_MESSAGES.empty);
  const check = checkMonModelFile({ name, size });
  if (!check.ok) throw new ConsoleError('INVALID_RECORD', 400, MON_MODEL_FILE_MESSAGES[check.problem]);
  const { token } = issueUploadToken({ user, size, now: Date.now(), secret: req.payload.secret });
  return json({ token, chunkBytes: MON_MODEL_CHUNK_BYTES, chunks: chunkCount(size) }, 201);
}

/** PUT /console/models/uploads/:token/:index with the chunk's raw bytes. */
export async function putModelChunk(req: PayloadRequest): Promise<Response> {
  const upload = requireUpload(req);
  const index = Number(req.routeParams?.index);
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MON_MODEL_CHUNK_BYTES) throw new ConsoleError('INVALID_RECORD', 413, 'This part of the file is too large.');
  const bytes = new Uint8Array(await (req as unknown as Request).arrayBuffer());
  const problem = chunkProblem(upload, index, bytes.byteLength);
  if (problem) throw new ConsoleError('INVALID_RECORD', 400, problem === 'index' ? 'This part of the file is out of order.' : 'This part of the file arrived incomplete. Save again.');
  // The first chunk carries the 12-byte header: refuse a non-GLB before storing the rest.
  if (index === 0) {
    const head = checkGlbHeader(bytes.subarray(0, 12), upload.size);
    if (!head.ok) throw new ConsoleError('INVALID_RECORD', 400, MON_MODEL_FILE_MESSAGES[head.problem]);
  }
  await putStorageObject(chunkKey(upload, index), bytes);
  return json({ received: index });
}

/**
 * POST /console/models/uploads/:token/complete { id } to replace a model, or
 * { speciesId } to add one. Joins the chunks and saves through the Local API.
 */
export async function completeModelUpload(req: PayloadRequest): Promise<Response> {
  const upload = requireUpload(req);
  const data = await readBody(req);
  const id = typeof data?.id === 'string' || typeof data?.id === 'number' ? data.id : undefined;
  const speciesId = typeof data?.speciesId === 'string' ? data.speciesId : undefined;
  if (id === undefined && speciesId === undefined) throw new ConsoleError('INVALID_RECORD', 400, 'Pick a Mon form from the roster.');
  try {
    let bytes: Buffer;
    try {
      bytes = await assembleChunks(upload, getStorageObject);
    } catch {
      throw new ConsoleError('INVALID_RECORD', 400, 'Part of the file never arrived. Save again.');
    }
    const file = { data: bytes, mimetype: 'model/gltf-binary', name: `${speciesId ?? id}.glb`, size: bytes.byteLength };
    const doc = id === undefined
      ? await req.payload.create({ collection: 'mon-models', data: { speciesId } as never, file, user: req.user, overrideAccess: false, depth: 0 })
      : await req.payload.update({ collection: 'mon-models', id, data: {}, file, user: req.user, overrideAccess: false, depth: 0 });
    return json({ id: doc.id }, id === undefined ? 201 : 200);
  } finally {
    // The joined file now lives under its real key, or the save failed and the parts are useless.
    await deleteStorageObject(stagingFolder(upload)).catch((error: unknown) => {
      req.payload.logger.warn({ err: error, folder: stagingFolder(upload) }, 'Staged model upload cleanup failed');
    });
  }
}

/** DELETE /console/models/uploads/:token: the browser gave up; drop what it sent. */
export async function abortModelUpload(req: PayloadRequest): Promise<Response> {
  const upload = requireUpload(req);
  await deleteStorageObject(stagingFolder(upload));
  return json({ deleted: true });
}
