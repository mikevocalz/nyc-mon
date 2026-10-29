/**
 * The 3D stage's ready signal as a Suspense resource: a promise that settles
 * once, when the stage's first frame with its models is up (DeviceStage
 * `onReady`) or when it can't run (`onBackendChange(null)`). Create one per
 * screen instance (keep it in the screen's store) and settle it from both
 * callbacks; `StageReadyGate` suspends on it.
 */
export interface StageReadyResource {
  readonly promise: Promise<void>;
  /** Idempotent. */
  settle(): void;
  isSettled(): boolean;
}

export function createStageReady(): StageReadyResource {
  let settled = false;
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return {
    promise,
    settle: () => {
      if (settled) return;
      settled = true;
      resolve();
    },
    isSettled: () => settled,
  };
}
