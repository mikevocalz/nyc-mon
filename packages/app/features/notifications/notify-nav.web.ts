/**
 * PLATFORM FORK (web): notifications are local on the phone (ADR 0001) — the
 * M06 sheet and OS Settings do not exist here, so the status line renders
 * without actions.
 */
export function useNotifyActions(): { ask?: () => void; openSettings?: () => void } {
  return {};
}
