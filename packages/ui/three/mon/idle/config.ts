/**
 * Every number the Mon's idle engine reads, with the reason it has that value.
 * The engine (engine.ts) stays a pure `step(dt, inputs)`; the bounds tests
 * assert against these directly. Modelled on MoyoLearn's Natalie idle layer
 * (packages/avatar/src/idle/config.ts): no magic numbers at call sites.
 *
 * Units: seconds, radians, and model units (the GLB is authored in metres;
 * Lil' Ratti stands 1.70 tall).
 *
 * Measured from the GLBs in Chromium (scratch probe, 2026-10-23), chest line
 * from the shoulder bones and feet line from the foot bones:
 *  - Bind pose and every idle clip (up_idle, up_breathe, emote_*, beckon,
 *    quad_idle_sniff) face +Z, the camera: chest yaw within 0.05 rad.
 *  - up_turn_L / up_turn_R are in-place quarter turns: chest and feet go
 *    0 → +π/2 (L) or −π/2 (R) in 1.0 s and stay there. The root does not move.
 *  - up_walk is an in-place walk facing the model's +Z: one 1.0 s cycle is two
 *    steps, and the planted foot travels back at 0.60 units/s.
 *  - up_look_listen turns the head up to 0.46 rad and the chest 0.13 rad, then back.
 */

export interface Range {
  readonly min: number;
  readonly max: number;
}

export const idleConfig = {
  /** Default seed; the view seeds per Mon so two Mons on one screen do not move in step. */
  seed: 1,

  drift: {
    /**
     * Upper-body yaw wander (spine to head), never the root, so the feet stay
     * planted. Each wander's amplitude is drawn in this range, so the Mon
     * looks about without a fixed swing; the owner capped it at ±20° so the
     * face is always the thing you see.
     */
    yawRad: { min: (10 * Math.PI) / 180, max: (20 * Math.PI) / 180 },
    /**
     * Seconds per wander target. Natalie's head drift runs at 0.2 Hz; a Mon is
     * a smaller, busier animal, but anything under 3 s reads as twitching.
     */
    holdS: { min: 3, max: 7 },
    /** Critically damped ease toward each target (per second): ~1 s to settle. */
    rate: 2.2,
    /** While speaking the face stays on the viewer: drift scales to this (±1.5–2.5°). */
    speechGain: 0.1,
    /** Reduced motion keeps a trace of life, not a sway (doc 22 §7: remove the vestibular load). */
    reducedGain: 0.15,
    /**
     * Turned away, the upper body only glances back toward the viewer; the
     * switch between that and free drift is eased at this rate (per second)
     * so it never snaps.
     */
    settleRate: 5,
  },

  turn: {
    /** Clip length measured above; the engine times the root-heading hand-off with it when the GLB gives none. */
    clipS: 1.0,
    /** One clip turns this far. */
    angleRad: Math.PI / 2,
    /**
     * Seconds between deliberate look-aways (a quarter turn and back). The
     * owner wants the Mon facing the viewer as its resting state, and every
     * step already shows a profile, so a full look-away is rare.
     */
    intervalS: { min: 60, max: 120 },
    /** How long it stays turned before turning back: a glance, not a pose. */
    holdS: { min: 1, max: 2 },
  },

  steps: {
    /** The brief: every 8–20 s, seeded. */
    intervalS: { min: 8, max: 20 },
    /** 1–3 steps; up_walk takes two steps per cycle. */
    count: { min: 1, max: 3 },
    stepsPerCycle: 2,
    walkCycleS: 1.0,
    /** The planted foot's speed in up_walk, so the root travels exactly as far as the feet do. */
    strideSpeed: 0.6,
    /** A pause after arriving before turning back to the front. */
    settleS: 0.3,
  },

  speech: {
    /**
     * A turn back to the viewer starts when the Mon is turned further than
     * this from the front (the brief's 10°). Below it the upper body simply
     * eases back with the drift gain.
     */
    faceThresholdRad: (10 * Math.PI) / 180,
    /** No look-away or step starts within this long after the last sentence ends. */
    quietAfterS: 2.5,
  },

  gesture: {
    /** A gesture waits this long into its sentence, so it lands on the words, not before them. */
    delayS: 0.15,
    /** Gestures longer than their sentence by more than this are skipped: a wave that outlives the line looks like a goodbye. */
    overrunS: 0.8,
  },

  flavor: {
    /**
     * The mood's own clip (quad_idle_sniff when hungry, emote_tired when
     * tired) plays now and then, not as a permanent pose: a Mon crouched on
     * all fours for minutes reads as broken from the front.
     */
    intervalS: { min: 10, max: 18 },
  },

  squeaklet: {
    /** The rat hop (rat_run in place): occasional, short. */
    hopIntervalS: { min: 9, max: 18 },
    /** A gentle root sway for a Mon too small to step: ±6°. Its feet sit near the centre, so the slide is millimetres. */
    swayRad: (6 * Math.PI) / 180,
    swayHoldS: { min: 2.5, max: 5 },
  },

  /**
   * After any turn, step, sniff or hop the Mon stands facing front at least
   * this long before the next one: back-to-back plans read as pacing, and the
   * front is its resting state.
   */
  restS: 3,

  /** Base-clip crossfade, matching MonModel3D's mood crossfade. */
  crossfadeS: 0.4,
  /** One-shot (gesture, flavor) fade in/out. */
  actionFadeS: 0.25,
} as const;

export type IdleConfig = typeof idleConfig;
