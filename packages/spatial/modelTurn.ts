import { clampPitch } from './modelFraming.ts';

/** Where the preview looks from: yaw turns the model, pitch tilts the camera. Degrees. */
export type Turn = { yaw: number; pitch: number };

/** The angle buttons, in degrees of yaw. */
export const PRESET_YAWS = ['0', '90', '180', '270'] as const;
export type PresetYaw = (typeof PRESET_YAWS)[number];

/** A drag across the whole stage turns the model half way round. */
const DEGREES_PER_STAGE_WIDTH = 180;
/** A drag down the whole stage tilts the camera by this much. */
const DEGREES_PER_STAGE_HEIGHT = 60;
/** One arrow key press. */
export const KEY_YAW_STEP = 15;
export const KEY_PITCH_STEP = 5;

/** Yaw in [0, 360). */
export function normalizeYaw(yaw: number): number {
  if (!Number.isFinite(yaw)) return 0;
  const turned = yaw % 360;
  return turned < 0 ? turned + 360 : turned;
}

/** The turn after dragging `dx`, `dy` CSS pixels on a `width` x `height` stage. Right turns the front right; down looks from above. */
export function dragTurn(from: Turn, dx: number, dy: number, width: number, height: number): Turn {
  const w = width > 0 ? width : 1;
  const h = height > 0 ? height : 1;
  return {
    yaw: normalizeYaw(from.yaw + (dx / w) * DEGREES_PER_STAGE_WIDTH),
    pitch: clampPitch(from.pitch + (dy / h) * DEGREES_PER_STAGE_HEIGHT),
  };
}

/** The turn after an arrow key, or null for any other key. */
export function keyTurn(from: Turn, key: string): Turn | null {
  switch (key) {
    case 'ArrowRight': return { yaw: normalizeYaw(from.yaw + KEY_YAW_STEP), pitch: from.pitch };
    case 'ArrowLeft': return { yaw: normalizeYaw(from.yaw - KEY_YAW_STEP), pitch: from.pitch };
    case 'ArrowDown': return { yaw: from.yaw, pitch: clampPitch(from.pitch + KEY_PITCH_STEP) };
    case 'ArrowUp': return { yaw: from.yaw, pitch: clampPitch(from.pitch - KEY_PITCH_STEP) };
    default: return null;
  }
}

/** The angle button this turn sits on, or null between buttons or off level. */
export function presetFor(turn: Turn): PresetYaw | null {
  if (Math.abs(turn.pitch) > 0.5) return null;
  const yaw = normalizeYaw(turn.yaw);
  for (const preset of PRESET_YAWS) {
    const distance = Math.abs(((yaw - Number(preset) + 540) % 360) - 180);
    if (distance <= 0.5) return preset;
  }
  return null;
}
