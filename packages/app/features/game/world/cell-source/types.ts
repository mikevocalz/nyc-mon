// The on-demand cell source's contracts: a trusted manifest pins every cell's sha256 and byte length, and the
// platform IO (fetch, sha256, a clock) and the persistent store are injected so the core is testable without device APIs.

/** One cell the host may serve. `bundled`: a bundled copy exists and is preferred (home cells, first-launch offline). */
export interface CellRef {
  /** Path under the configured base URL. */
  readonly path: string;
  /** Hex sha256 of the file, verified before a download is decoded or promoted to the cache. */
  readonly sha256: string;
  /** The file's exact byte length; anything else is rejected. */
  readonly bytes: number;
  readonly bundled?: boolean;
}

export interface CellManifest {
  readonly version: number;
  readonly cells: Readonly<Record<string, CellRef>>;
}

/** Platform IO. fetchBytes rejects on a non-2xx answer, a network error, or an abort. */
export interface CellIo {
  fetchBytes(url: string, signal?: AbortSignal): Promise<Uint8Array>;
  sha256Hex(bytes: Uint8Array): Promise<string>;
  now(): number;
}

/**
 * The byte store behind the cache. write is atomic (a crash never leaves a torn file under the final name);
 * list returns the names it holds, index file included.
 */
export interface CellStore {
  list(): Promise<string[]>;
  read(name: string): Promise<Uint8Array | null>;
  write(name: string, bytes: Uint8Array): Promise<void>;
  remove(name: string): Promise<void>;
}
