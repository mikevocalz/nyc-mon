// Native drives the grid on the UI thread through Reanimated derived values,
// so there is no JS phase to report.
export function useWebPhase(_speed: number): number | null {
  return null;
}
