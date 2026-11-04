/** Shared screen-error/distance rule for cell streaming and source START admission. */
export function cellWanted(options: { distance: number; errorM: number; k: number; reachM?: number | null; screenErrorPx: number; hysteresis: number; rise: boolean }): boolean {
  const { distance, errorM, k, reachM, screenErrorPx, hysteresis, rise } = options;
  if (reachM != null) return distance <= (rise ? reachM : reachM / hysteresis);
  return errorM * k / Math.max(1, distance) >= screenErrorPx * (rise ? 1 : hysteresis);
}

/** START additionally limits ordinary wanted cells to its initial radius; pinned cells always qualify. */
export function cellInStartSet(options: { wanted: boolean; pinned: boolean; distance: number; startRadius: number }): boolean {
  return options.pinned || (options.wanted && options.distance <= options.startRadius);
}
