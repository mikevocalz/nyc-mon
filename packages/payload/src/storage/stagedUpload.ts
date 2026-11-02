// Staged uploads for files over Vercel's 4.5 MB request-body limit.
//
// The browser sends a model in raw chunks, each under the limit; the server
// writes each chunk to Bunny Storage under _staging/, then reads them back,
// joins them and hands the whole file to the Payload Local API, so the
// collection hooks (readGlb, the Bunny upload, bunnyUrl) run exactly as they do
// for a small multipart upload. Bunny Storage has no presigned URLs, and its
// AccessKey must stay on the server, so no byte goes to Bunny from the browser.
//
// An upload is identified by a token the server signs with the Payload secret.
// It binds the upload to one staff user, one file size and an expiry, so a
// chunk or a commit from anyone else, or for a different size, is refused
// without any server-side session table.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { chunkCount, chunkLength } from '../collections/monModelFile.ts';

/** Long enough for 25 MB on a slow connection; short enough that a leaked token is soon useless. */
export const STAGED_UPLOAD_TTL_MS = 60 * 60 * 1000;

export const STAGING_ROOT = '_staging/mon-models';

export type StagedUpload = {
  /** Random folder name under STAGING_ROOT. */
  nonce: string;
  /** The staff user who started the upload. */
  user: string;
  size: number;
  /** Expiry, epoch ms. */
  expires: number;
};

const b64url = (data: Buffer | string) => Buffer.from(data).toString('base64url');

const sign = (body: string, secret: string) => createHmac('sha256', secret).update(body).digest();

export function issueUploadToken(input: { user: string | number; size: number; now: number; secret: string }): { token: string; upload: StagedUpload } {
  const upload: StagedUpload = {
    nonce: randomBytes(16).toString('hex'),
    user: String(input.user),
    size: input.size,
    expires: input.now + STAGED_UPLOAD_TTL_MS,
  };
  const body = b64url(JSON.stringify(upload));
  return { token: `${body}.${b64url(sign(body, input.secret))}`, upload };
}

/** The upload a token names, or null when it is forged, expired or someone else's. */
export function readUploadToken(token: unknown, input: { user: string | number; now: number; secret: string }): StagedUpload | null {
  if (typeof token !== 'string' || token.length > 512) return null;
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra !== undefined) return null;
  const expected = sign(body, input.secret);
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let upload: StagedUpload;
  try {
    upload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as StagedUpload;
  } catch {
    return null;
  }
  if (!/^[0-9a-f]{32}$/.test(upload.nonce) || !Number.isSafeInteger(upload.size) || upload.size <= 0) return null;
  if (upload.user !== String(input.user) || !(upload.expires > input.now)) return null;
  return upload;
}

export const stagingFolder = (upload: StagedUpload) => `${STAGING_ROOT}/${upload.nonce}/`;

export const chunkKey = (upload: StagedUpload, index: number) => `${stagingFolder(upload)}${index}`;

/** Why a chunk is refused, or null when its index and length fit the upload. */
export function chunkProblem(upload: StagedUpload, index: number, length: number): 'index' | 'length' | null {
  if (!Number.isInteger(index) || index < 0 || index >= chunkCount(upload.size)) return 'index';
  return length === chunkLength(upload.size, index) ? null : 'length';
}

/** Reads every chunk in order and joins them, checking the total against the signed size. */
export async function assembleChunks(upload: StagedUpload, read: (key: string) => Promise<Uint8Array>): Promise<Buffer> {
  const count = chunkCount(upload.size);
  const parts: Uint8Array[] = [];
  for (let index = 0; index < count; index++) {
    const part = await read(chunkKey(upload, index));
    if (part.byteLength !== chunkLength(upload.size, index)) throw new Error(`Chunk ${index} has ${part.byteLength} bytes.`);
    parts.push(part);
  }
  const file = Buffer.concat(parts);
  if (file.byteLength !== upload.size) throw new Error(`The joined file has ${file.byteLength} bytes, not ${upload.size}.`);
  return file;
}
