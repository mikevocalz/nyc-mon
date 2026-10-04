import type { ControlTone, District } from './district';
import type { AvatarGradient, AvatarSize, AvatarVariant } from './avatar-look';

export interface AvatarProps {
  name: string;
  imageUri?: string;
  /** Default md (44px). */
  size?: AvatarSize;
  className?: string;
  /**
   * Default `cornerCut` (alias `neon`): NeonBlade's data-table user tile, a
   * gradient square with the bottom-right corner cut. `bracket` is the night
   * tile with cornice brackets in the district tone.
   */
  variant?: AvatarVariant;
  /**
   * cornerCut only. A preset (`skyline` default, `harbor`, `sunset`,
   * `neonblade`) or two or more stops, top-left to bottom-right.
   */
  gradient?: AvatarGradient;
  /** bracket only: bracket and initials colour by neighbourhood. Default midtown (orange). */
  district?: District;
  /** bracket only: bracket and initials colour; overrides the district. */
  tone?: ControlTone;
  /** Opt-in rounded corners (rounded-soft), which also drops the corner cut. Default false. */
  rounded?: boolean;
}
