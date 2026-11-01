// Types for r2-publish.mjs — the publish tool stays dependency-free .mjs; this file gives its testable API
// a shape under tsc (the cell-source lane's node --test suite drives it with a fake fetch and fake fs).

export interface R2CellPin {
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly bundled: boolean;
}

export interface ParsedCellsManifest {
  readonly version: number;
  readonly cells: Record<string, R2CellPin>;
}

export interface PlanCell {
  readonly key: string;
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly bundled: boolean;
  readonly file: string;
}

export interface R2Io {
  fetch(url: string, init: {
    method: string;
    headers: Record<string, string>;
    body: Uint8Array | null;
    signal?: AbortSignal;
  }): Promise<{
    status: number;
    headers: { get(name: string): string | null };
    arrayBuffer(): Promise<ArrayBuffer>;
  }>;
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, data: Uint8Array | string): Promise<void>;
  mkdir(path: string, opts?: { recursive?: boolean }): Promise<void>;
  now(): Date;
  log(msg: string): void;
}

export interface SignedRequest {
  readonly headers: Record<string, string>;
  readonly amzDate: string;
  readonly canonicalRequest: string;
  readonly stringToSign: string;
  readonly signature: string;
  readonly signedHeaders: string;
}

export function parseCellsManifest(text: string): ParsedCellsManifest;
export function cellDiskPath(root: string, key: string, cellPath: string): string;
export function manifestSha(cells: Record<string, R2CellPin>): string;
export function defaultReleaseId(cells: Record<string, R2CellPin>, now?: Date): string;
export function uriEncode(str: string, keepSlash?: boolean): string;
export function signRequest(opts: {
  method: string;
  host: string;
  canonicalUri: string;
  canonicalQuery?: string;
  headers?: Record<string, string>;
  payloadHash: string;
  region?: string;
  service?: string;
  accessKeyId: string;
  secretAccessKey: string;
  date?: Date;
  /** S3 wants x-amz-content-sha256 signed; other services (the AWS docs IAM vector) omit it. Default true. */
  includePayloadHeader?: boolean;
}): SignedRequest;

export interface R2Client {
  head(key: string): Promise<{ status: number; headers: { get(name: string): string | null }; arrayBuffer(): Promise<ArrayBuffer> }>;
  get(key: string): Promise<{ status: number; headers: { get(name: string): string | null }; arrayBuffer(): Promise<ArrayBuffer> }>;
  put(
    key: string,
    body: Uint8Array,
    headers?: Record<string, string>,
  ): Promise<{ status: number; headers: { get(name: string): string | null }; arrayBuffer(): Promise<ArrayBuffer> }>;
  objectUrl(key: string): string;
}

export function r2Client(opts: {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  fetchImpl?: R2Io['fetch'];
}): R2Client;

export function buildPlan(manifest: ParsedCellsManifest, root: string, io: Pick<R2Io, 'readFile'>): Promise<PlanCell[]>;

export interface R2Ctx {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface PublishResult {
  release: string;
  cells: number;
  resumed: number;
  skipped: number;
  uploaded: number;
  failed: number;
  activated: boolean;
}

export function runPublish(
  o: R2Ctx & {
    release: string;
    plan: readonly PlanCell[];
    concurrency?: number;
    stateFile?: string | null;
    activate?: boolean;
    manifestVersion?: number;
  },
  io: R2Io,
): Promise<PublishResult>;

export interface VerifyResult {
  ok: boolean;
  checked: number;
  failures: string[];
}

export function runVerify(
  o: R2Ctx & { release: string; plan: readonly PlanCell[]; concurrency?: number },
  io: R2Io,
): Promise<VerifyResult>;

export function runRollback(o: R2Ctx & { target: string }, io: R2Io): Promise<{ release: string }>;

export function main(argv?: string[], env?: Record<string, string | undefined>, io?: R2Io): Promise<void>;
