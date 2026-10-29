import { pageMotion } from '@acme/theme';

/**
 * The H-Lynk Core's proportions, placement and intro, shared by the scene
 * (device-scene.ts) and its node tests. Pure: no three.js, no platform
 * modules. Units are body widths.
 */

/** Resting three-quarter turn so the side keys and depth read. */
export const REST_YAW = -0.38;
/** Pointer tilt cap, from the page motion tokens (8 degrees). */
export const MAX_TILT = (pageMotion.tilt.stage * Math.PI) / 180;
/** Placement of the model in the scene: drop, scale, camera. Shared with the beam test. */
export const STAGE = { baseY: -0.1, scale: 1.25, camera: { y: 0.12, z: 5.4, lookY: 0.05, fov: 30 } } as const;

/**
 * The authored frame: the stage aspect whose camera distance is exactly
 * `STAGE.camera.z`. At or above it the frame is height-bound and the device
 * fills the stage's height; below it the frame is width-bound and the camera
 * backs off so the unit stays whole across the pane's width.
 */
export const FRAME_ASPECT = 0.75;

/**
 * Camera distance for a stage of `width / height` = `aspect`: the device fills
 * the pane it is given on the binding axis, whatever the pane's shape (a
 * phone column, a tablet's top band, one half of an open foldable). Same
 * values as before for every aspect a phone stage reaches; the old floor at
 * aspect 0.45 is gone, so a narrow split-screen pane no longer crops the sides.
 */
export function stageCameraZ(aspect: number): number {
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : FRAME_ASPECT;
  return a >= FRAME_ASPECT ? STAGE.camera.z : STAGE.camera.z * (FRAME_ASPECT / a);
}

/** Body size, body widths. */
export const BODY = { W: 1, H: 1.78, D: 0.21 } as const;
/** The two red emitters in the head, x centres and radius. The fan rises from between them. */
export const EMITTERS = { x: [0.14, 0.32], r: 0.028 } as const;
/** Head depth: the fan's crossed plane stays inside it so it never hangs in front of the face. */
export const HEAD_DEPTH = BODY.D + 0.06;

/**
 * The screen glass: centre height, size, and its distance in front of the
 * body's centre plane. The drawn screen maps onto it edge to edge.
 */
export const SCREEN_GLASS = { y: 0.17, width: 0.8, height: 1.0, z: BODY.D / 2 + 0.029 } as const;

/**
 * Canvas px on a screen of `size` to the glass's local position (x right,
 * y up, both in body widths, the glass centre at SCREEN_GLASS.y).
 */
export function screenPxToLocal(px: number, py: number, size: { width: number; height: number }): { x: number; y: number } {
  return {
    x: (px / size.width - 0.5) * SCREEN_GLASS.width,
    y: SCREEN_GLASS.y + (0.5 - py / size.height) * SCREEN_GLASS.height,
  };
}

/**
 * The scanner fan (PS-037 fix). Centred on the emitters, opening upward from
 * their span, and never wider than the body: the widest layer's tip spans
 * x 0.01..0.45 of the body's -0.5..0.5. The crossed plane that gives the fan
 * volume is narrower than the head is deep, so no sheet of light hangs in
 * front of the head's left side at the three-quarter turn.
 */
export const FAN = {
  x: (EMITTERS.x[0] + EMITTERS.x[1]) / 2,
  length: 0.42,
  /** lean back, radians: reads as projection, and the tip fades before the stage's top edge */
  lean: -0.08,
  /** [half-width at the mouth, half-width at the tip, peak opacity] per layer: wash, beam, core */
  layers: [
    [0.115, 0.22, 0.55],
    [0.09, 0.16, 0.8],
    [0.035, 0.07, 0.95],
  ],
  /** the crossed plane's half-depth as a share of the face half-width */
  depth: 0.45,
} as const;

/** Every corner of the fan's planes in the model's local space, for bounds checks. */
export function fanCorners(): [number, number, number][] {
  const points: [number, number, number][] = [];
  const cos = Math.cos(FAN.lean);
  const sin = Math.sin(FAN.lean);
  for (const [base, tip] of FAN.layers) {
    for (const [half, y] of [[base, 0], [tip, FAN.length]] as const) {
      for (const sx of [-1, 1]) {
        // The face plane spans x; the crossed plane spans z at FAN.depth of the width.
        for (const [px, pz] of [[sx * half, 0], [0, sx * half * FAN.depth]] as const) {
          // rotation.x by FAN.lean: y' = y cos - z sin, z' = y sin + z cos
          points.push([FAN.x + px, BODY.H / 2 + y * cos - pz * sin, y * sin + pz * cos]);
        }
      }
    }
  }
  return points;
}

/**
 * The intro, in seconds of scene time from the first frame after the
 * pipelines compile. One pass, then the object rests (PS-018):
 * it settles into frame, turns slowly to its three-quarter rest, the scanner
 * catches the light once, and the screen comes up readable.
 */
export const INTRO = {
  settle: { from: 0, to: 1.0, drop: 0.14 },
  yaw: { from: 0, to: 1.8, turn: 0.42 },
  scanner: { from: 1.0, to: 1.9 },
  screen: { from: 1.5, to: 2.4 },
  end: 2.4,
} as const;
