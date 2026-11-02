/**
 * When the persistent stage's Rive loader comes down. Pure, so the rule is
 * tested without a renderer (stage-loading.test.ts).
 *
 * The loader is up from the first frame and stays up until the device has
 * drawn its first frame AND every model on the glass has really settled
 * (shown, or failed so its slot falls back to the label). The device scene
 * announces `ready` after at most 8 s even with the Baby still downloading;
 * that alone never lifts the loader, so a slow 26 MB Baby never leaves an
 * empty glass on black. A stage that cannot run (no GPU backend) lifts it at
 * once: the route goes to its 2D fallback.
 */
export interface StageLoading {
  /** DeviceStage `onReady`: the first frame with the device in it. */
  readonly deviceReady: boolean;
  /** DeviceStage `onModelsSettled`: every model shown, missing or failed. */
  readonly modelsSettled: boolean;
  /** `onBackendChange(null)`. */
  readonly failed: boolean;
}

export const STAGE_LOADING: StageLoading = { deviceReady: false, modelsSettled: false, failed: false };

export function stageLoaderUp(state: StageLoading): boolean {
  if (state.failed) return false;
  return !(state.deviceReady && state.modelsSettled);
}
