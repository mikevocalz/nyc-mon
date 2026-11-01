// Zod 4 (installed 4.6.5: packages/core/node_modules/zod/v4/classic/
// schemas.d.ts declares `object`, `number().min/max`, `enum`, `boolean`,
// `safeParse`) for the one profile the settings screen edits (Master
// Directive v2 §13). Law 5: every storage read is schema-parsed.
//
// The ranges are the contract's: deadZone 0…0.5, sensitivity 0.5…2,
// clampRadiusDp 32…96, scale 0.8…1.4, opacity 0.3…1.
import { z } from 'zod';
import { DEFAULT_CONTROLLER_PROFILE, type ControllerProfile, type StickTuning } from './contract.ts';

/** Validates {@linkcode StickTuning}. */
export const stickTuningSchema = z.object({
  deadZone: z.number().min(0).max(0.5),
  sensitivity: z.number().min(0.5).max(2),
  clampRadiusDp: z.number().min(32).max(96),
}) satisfies z.ZodType<StickTuning>;

/**
 * Validates {@linkcode ControllerProfile}. Unknown keys are stripped, so a
 * profile saved by a newer build still loads on an older one; a value outside
 * its range fails the whole parse rather than being clamped, because a
 * clamped profile would silently differ from what the user set.
 *
 * @see {@linkcode parseControllerProfile}
 */
export const controllerProfileSchema = z.object({
  stickMode: z.enum(['analog', 'dpad']),
  stickPlacement: z.enum(['fixed', 'floating']),
  stick: stickTuningSchema,
  handedness: z.enum(['left', 'right']),
  scale: z.number().min(0.8).max(1.4),
  opacity: z.number().min(0.3).max(1),
  haptics: z.enum(['off', 'light', 'medium', 'strong']),
  showIcons: z.boolean(),
}) satisfies z.ZodType<ControllerProfile>;

/**
 * Parses an untrusted value (storage, a server payload) into a
 * {@linkcode ControllerProfile}. Returns `undefined` when the value is not a
 * valid profile; the caller decides whether that means defaults or an error.
 *
 * @see {@linkcode DEFAULT_CONTROLLER_PROFILE}
 */
export function parseControllerProfile(raw: unknown): ControllerProfile | undefined {
  const result = controllerProfileSchema.safeParse(raw);
  return result.success ? result.data : undefined;
}

/**
 * Applies a partial change to a profile and validates the result. Returns the
 * unchanged `current` when the patch would leave a field out of range, so a
 * settings slider cannot push the store into a state the schema rejects.
 */
export function patchControllerProfile(current: ControllerProfile, patch: Partial<ControllerProfile>): ControllerProfile {
  const next = { ...current, ...patch, stick: { ...current.stick, ...patch.stick } };
  return parseControllerProfile(next) ?? current;
}

/** The default profile, proven valid against the schema at module load. */
export const VALID_DEFAULT_CONTROLLER_PROFILE: ControllerProfile = controllerProfileSchema.parse(DEFAULT_CONTROLLER_PROFILE);
