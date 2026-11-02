/** Drain the same preparation synchronously for render-runtime callers. */
export function finishPreparation<T>(steps: Generator<number, T, void>): T {
  let step = steps.next();
  while (!step.done) step = steps.next();
  return step.value;
}

/** Give the completed checkpoint a frame and task boundary before further CPU work. */
export function yieldPreparationFrame(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    let frame: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      if (timer !== undefined) clearTimeout(timer);
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    signal?.addEventListener('abort', finish, { once: true });
    if (signal?.aborted) { finish(); return; }
    if (typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(() => { frame = undefined; timer = setTimeout(finish, 0); });
    else timer = setTimeout(finish, 0);
  });
}

/** Preparation owns partial resources until it returns; return() runs its cleanup on abort/error. */
export async function runPreparation<T>(
  steps: Generator<number, T, void>, signal?: AbortSignal, yieldFrame = yieldPreparationFrame,
  options: { now?: () => number; budgetMs?: number } = {},
): Promise<T> {
  const now = options.now ?? (() => typeof performance !== 'undefined' ? performance.now() : Date.now());
  const budgetMs = options.budgetMs ?? 8;
  let sliceStarted = now();
  try {
    for (;;) {
      if (signal?.aborted) throw Object.assign(new Error('Scene preparation aborted'), { name: 'AbortError' });
      const step = steps.next();
      if (step.done) return step.value;
      if (signal?.aborted) throw Object.assign(new Error('Scene preparation aborted'), { name: 'AbortError' });
      // Fine-grained geometry checkpoints bound work, not frame count. Drain
      // cheap steps within this CPU slice; a costly atomic step yields next.
      if (now() - sliceStarted < budgetMs) continue;
      await new Promise<void>((resolve, reject) => {
        const aborted = () => reject(Object.assign(new Error('Scene preparation aborted'), { name: 'AbortError' }));
        signal?.addEventListener('abort', aborted, { once: true });
        Promise.resolve().then(() => yieldFrame(signal)).then(
          () => { signal?.removeEventListener('abort', aborted); resolve(); },
          (error: unknown) => { signal?.removeEventListener('abort', aborted); reject(error); },
        );
      });
      sliceStarted = now();
    }
  } finally {
    steps.return(undefined as never);
  }
}
