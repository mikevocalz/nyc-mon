// Frame pacing for the game canvas (present-tail lane,
// docs/performance/present-tail-2026-10-18.md). Opt-in:
// EXPO_PUBLIC_GAME_FREERUN=1.
//
// Why this exists: the running loop paces itself on requestAnimationFrame,
// and on the Duo one cycle is rAF delivery + the draw, ~31 ms — the game is
// pinned near 30 fps no matter how cheap the draw gets. With the AHB-pool
// surface (EXPO_PUBLIC_GAME_SURFACE=ahb) the present is mailbox-semantics —
// frames that miss a vsync are superseded, never stalled — so the producer
// can free-run on a zero-delay timer and let SurfaceFlinger pick the newest
// buffer each vsync. On a fifo present path (the default TextureView) the
// present stall throttles the loop back to ~30 fps anyway, so this flag is
// only useful paired with the superseding surface.

/** Parse EXPO_PUBLIC_GAME_FREERUN: '1'/'true' opt in, everything else off. */
export function parseGameFreerunFlag(value: string | undefined | null): boolean {
  if (typeof value !== 'string') return false;
  const v = value.trim().toLowerCase();
  return v === '1' || v === 'true';
}

/** Opt-in free-run pacing — default off (rAF-paced loop). */
export const GAME_FREERUN = parseGameFreerunFlag(process.env.EXPO_PUBLIC_GAME_FREERUN);
