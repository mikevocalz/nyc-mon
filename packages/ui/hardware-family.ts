// Stable device-family capability for the native navigation shell. Pure: no
// react-native import, so node --test covers it. The live hook gathers the
// evidence (use-adaptive-navigation-placement.ts).
// SOT: mikevocalz-foldable-layouts skill §2 · ./adaptive-panes/README.md (Navigation rail)
// SOT-KEYWORDS: hardware family foldable tablet headset phone unknown capability navigation shell

/**
 * `unknown` is a real state: missing hinge geometry does not prove an ordinary
 * phone (a foldable's cover screen reports no fold). Detection never emits
 * `phone`, because no source on main positively verifies one; the type keeps it
 * for callers and tests that know the answer.
 */
export type HardwareFamily = 'phone' | 'foldable' | 'tablet' | 'headset' | 'unknown';

/** What the running process can actually observe about its hardware. */
export interface HardwareEvidence {
  /** `Platform.OS`. Anything other than `ios`/`android` is not native hardware. */
  os: string;
  /** Quest/PICO, from `isHeadsetAndroid`. */
  headset: boolean;
  /** iOS `Platform.isPad`. */
  isPad: boolean;
  /**
   * Android only: the smaller side of the physical screen (not the window) in
   * dp. At 600 or more it is Android's own sw600dp tablet class.
   */
  smallestScreenDp: number | null;
  /** The ReservedRegions module has reported a hinge/fold division. */
  divisionSeen: boolean;
  /** iOS reserved a hardware edge column (dual-screen). */
  hardwareColumn: boolean;
}

/** Android's sw600dp tablet resource qualifier. */
export const ANDROID_TABLET_SMALLEST_SCREEN_DP = 600;

/** The family this evidence proves, or `unknown`. */
export function detectHardwareFamily(evidence: HardwareEvidence): HardwareFamily {
  const { os } = evidence;
  if (os !== 'ios' && os !== 'android') return 'unknown';
  if (evidence.headset) return 'headset';
  if (evidence.divisionSeen || evidence.hardwareColumn) return 'foldable';
  if (os === 'ios' && evidence.isPad) return 'tablet';
  if (
    os === 'android' &&
    evidence.smallestScreenDp !== null &&
    evidence.smallestScreenDp >= ANDROID_TABLET_SMALLEST_SCREEN_DP
  ) {
    return 'tablet';
  }
  return 'unknown';
}

const RANK: Record<HardwareFamily, number> = {
  unknown: 0,
  phone: 1,
  tablet: 2,
  foldable: 3,
  headset: 4,
};

/**
 * Merge a fresh reading into the family already known for this process.
 * Hardware does not change mid-process, so a family never regresses: folding
 * to the cover screen (no hinge event, smaller screen) keeps `foldable`. A
 * stronger reading wins, e.g. an inner screen first read as sw600 `tablet`
 * becomes `foldable` once the hinge reports.
 */
export function retainHardwareFamily(known: HardwareFamily, next: HardwareFamily): HardwareFamily {
  return RANK[next] > RANK[known] ? next : known;
}
