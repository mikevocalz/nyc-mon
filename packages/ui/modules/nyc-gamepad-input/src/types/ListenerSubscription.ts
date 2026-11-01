/**
 * Cleanup handle every `addOn…Listener` method returns. Structurally the
 * same shape as `ListenerSubscription` in `packages/ui/game-controls/contract.ts`,
 * repeated here because Nitro generates a native struct from it.
 */
export interface ListenerSubscription {
  /**
   * Stops future emissions to this listener. Idempotent: a second call is a
   * no-op. An event already being delivered when `remove` runs may still
   * reach the listener once.
   */
  readonly remove: () => void;
}
