/** Hermes/worklets need the ProgressEvent constructor used by pinned Three compileAsync. */
export class CompileProgressEvent {
  readonly type: string;
  readonly lengthComputable: boolean;
  readonly loaded: number;
  readonly total: number;
  constructor(type: string, init: { lengthComputable?: boolean; loaded?: number; total?: number } = {}) {
    this.type = type;
    this.lengthComputable = init.lengthComputable ?? false;
    this.loaded = init.loaded ?? 0;
    this.total = init.total ?? 0;
  }
}
interface CompileProgressLease { users: number; previous: PropertyDescriptor | undefined }
let compileProgressLease: CompileProgressLease | null = null;

/** Asset and main-scene compiles share one generation; release only after native work drains. */
export function withCompileProgressEvent(): () => void {
  const g = globalThis as { ProgressEvent?: unknown };
  if (typeof g.ProgressEvent === 'function' && g.ProgressEvent !== CompileProgressEvent) return () => {};
  if (!compileProgressLease || g.ProgressEvent !== CompileProgressEvent) {
    compileProgressLease = { users: 0, previous: Object.getOwnPropertyDescriptor(g, 'ProgressEvent') };
    g.ProgressEvent = CompileProgressEvent;
  }
  const lease = compileProgressLease; lease.users++;
  let released = false;
  return () => {
    if (released) return;
    released = true; lease.users--;
    if (lease.users !== 0 || compileProgressLease !== lease) return;
    compileProgressLease = null;
    if (g.ProgressEvent !== CompileProgressEvent) return;
    if (lease.previous) Object.defineProperty(g, 'ProgressEvent', lease.previous);
    else delete g.ProgressEvent;
  };
}
