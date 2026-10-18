// Living City PR07 — the one authoritative game clock (spec §10: "one
// authoritative game clock feeds sky appearance, sun/ambient lighting,
// building window lights, streetlamp on/off state, vehicle headlights,
// brake illumination, storefront/nightlife lighting and weather
// overlays"). Pure TS, no three.js, no React, no timers — it advances with
// the fixed sim tick inside LivingCityHost, so the world clock is a pure
// function of accumulated sim seconds plus options: pause/fold/resume and
// time scaling never re-seed it, and two runs with the same step stream
// land on byte-identical env sections (tested).
//
// One clock, two readers:
//
//  - The dynamic layers read it through the packed env section appended
//    to the actor snapshot (CSNAP below): streetlamp glows and light
//    pools (lamp-viz.ts), vehicle headlight bits (vehicle-sim reads the
//    same env through `setEnvironment` before it steps), ped-signal
//    flashes (signal-viz.ts reads simTime for the blink parity).
//  - The static world reads the SAME clock once at scene mount: the sky
//    rig is a named-preset pick today (world/sky-rig.ts — morning/dusk/
//    night, no continuous interpolation), so `cityClockSkyName` maps the
//    clock's start hour onto the preset and `dayFactor` feeds the
//    glass/windows `timeOfDay` lit-share. The pick is made once, at
//    mount; a sky that tracks the running clock is sky-rig follow-up
//    work (docs/living-city/pr07-viz.md, Pending).
//
// The day/night model is deliberately simple and deterministic — a
// piecewise-smooth daylight curve, not astronomy: `dayFactor` is 1 in
// daylight, 0 at night, with smooth ~2 h dawn/dusk ramps centred on
// 06:30 and 19:30. Lamp level and the headlight rule derive from an
// effective day factor that rain darkens (storm gloom → earlier lamps,
// wipers-on headlights-on).

import type { SkyName } from '../world/sky-rig.ts';

// --- Tunables ------------------------------------------------------------------

/** Clock options: where the world clock starts and how fast it runs. */
export interface CityClockOptions {
  /**
   * Hour the clock starts at, 0–24. Default 16.5 — late afternoon, so
   * the default flag-on scene reads the same dusk preset the unflagged
   * city already picks.
   */
  readonly startHour?: number;
  /**
   * Game hours per sim second: 1/3600 = real time. The bundled host
   * runs 1/60 (one game-hour per sim-minute) so dusk actually arrives
   * during a session (scenario B). Tests pin exact values.
   */
  readonly hoursPerSimSecond?: number;
  /** Rain intensity 0–1 (weather overlay slot — materials/overlays are a later lane). */
  readonly rain?: number;
}

/** Dawn/dusk ramp centres (local hours) — the daylight model's two control points. */
export const CLOCK_SUNRISE_HOUR = 6.5;
export const CLOCK_SUNSET_HOUR = 19.5;
/** Half-width of each daylight ramp, hours. */
const RAMP_HALF_HOURS = 1.25;
/** Lamp level reaches full below this effective day factor, fully off above the upper band. */
const LAMP_OFF_DAY = 0.55;
const LAMP_FULL_DAY = 0.15;
/** Headlights required below this effective day factor (dusk driving + rain rule). */
const HEADLIGHT_DAY = 0.7;
/** How much rain darkens the effective day factor (storm gloom), 0–1 share. */
const RAIN_GLOOM = 0.45;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// --- Clock state ----------------------------------------------------------------

/** What the snapshot env section and the static world pick read. */
export interface CityClockState {
  /** Local hour of day, 0–24. */
  readonly hour: number;
  /** 1 = full daylight … 0 = night, smooth through dawn/dusk. */
  readonly dayFactor: number;
  /** Day factor after rain gloom — what lamps/headlights actually read. */
  readonly effectiveDayFactor: number;
  /** 0 = lamps off … 1 = fully lit, smooth through the dusk band. */
  readonly lampLevel: number;
  /** 1 when vehicles must show headlights (low sun or weather), else 0. */
  readonly headlights: 0 | 1;
  /** Rain intensity 0–1, verbatim from options/setRain. */
  readonly rain: number;
}

/**
 * The authoritative world clock. `step(dt)` is called once per sim tick
 * by the host; `state()` is a pure function of accumulated time.
 */
export class CityClock {
  private elapsedSeconds = 0;
  private baseHour: number;
  private readonly rate: number;
  private rain: number;

  constructor(options: CityClockOptions = {}) {
    this.baseHour = ((options.startHour ?? 16.5) % 24 + 24) % 24;
    this.rate = options.hoursPerSimSecond ?? 1 / 3600;
    this.rain = clamp01(options.rain ?? 0);
  }

  /** Advance the world clock by `dt` sim seconds. */
  step(dt: number): void {
    this.elapsedSeconds += Math.max(0, dt);
  }

  /** Jump to a local hour (dev inspector / scenario set-up) — deterministic given the same call stream. */
  setTimeOfDay(hour: number): void {
    this.baseHour = ((hour % 24) + 24) % 24;
  }

  /** Weather overlay slot: rain intensity 0–1. */
  setRain(rain: number): void {
    this.rain = clamp01(rain);
  }

  /** Current clock state — pure. */
  state(): CityClockState {
    const hour = (this.baseHour + this.elapsedSeconds * this.rate) % 24;
    const dayFactor = dayFactorAt(hour);
    const rain = this.rain;
    const effectiveDayFactor = dayFactor * (1 - RAIN_GLOOM * rain);
    const lampLevel = 1 - smoothstep(LAMP_FULL_DAY, LAMP_OFF_DAY, effectiveDayFactor);
    const headlights = effectiveDayFactor < HEADLIGHT_DAY ? 1 : 0;
    return { hour, dayFactor, effectiveDayFactor, lampLevel, headlights, rain };
  }
}

/** The daylight curve at a local hour: smooth ramps at sunrise/sunset, 1 midday, 0 overnight. */
export function dayFactorAt(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  const rise = smoothstep(CLOCK_SUNRISE_HOUR - RAMP_HALF_HOURS, CLOCK_SUNRISE_HOUR + RAMP_HALF_HOURS, h);
  const set = 1 - smoothstep(CLOCK_SUNSET_HOUR - RAMP_HALF_HOURS, CLOCK_SUNSET_HOUR + RAMP_HALF_HOURS, h);
  return rise * set;
}

/**
 * The named sky preset nearest the clock's daylight state — the
 * one-time pick the static world makes at mount (the sky rig has three
 * presets and no continuous interpolation today; the clock follows it
 * in spirit: morning while the day is young, dusk through the
 * afternoon/evening, night when dayFactor bottoms out).
 */
export function cityClockSkyName(hour: number): SkyName {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 4.5 && h < 14) return 'morning';
  if (h >= 14 && h < 21.5) return 'dusk';
  return 'night';
}

// --- Env snapshot section (appended after the signal section) -------------------

/**
 * The env tail of the world snapshot — the flat channel every dynamic
 * clock-driven layer reads. Layout:
 *
 *   [scheme, fields, hour, dayFactor, lampLevel, headlights, rain, simTime]
 *
 * `fields` counts the numbers after the header (CSNAP_STRIDE); `scheme`
 * versions the field list itself. The section is a fixed size — readers
 * find it immediately after the signal section (signal-viz.ts owns the
 * offset chain).
 */
export const CSNAP_HEADER = 2;
export const CSNAP_STRIDE = 6;
export const CSNAP_SCHEME = 1;
export const CSNAP = {
  scheme: 0,
  fields: 1,
  /** After the header: */
  hour: 0,
  dayFactor: 1,
  lampLevel: 2,
  headlights: 3,
  rain: 4,
  simTime: 5,
} as const;

/** Default env when a snapshot predates the section (vehicle-only buffers): noon, dry, lamps off. */
export const DEFAULT_ENV_STATE: CityClockState & { simTime: number } = {
  hour: 12,
  dayFactor: 1,
  effectiveDayFactor: 1,
  lampLevel: 0,
  headlights: 0,
  rain: 0,
  simTime: 0,
};

/** Pack the clock into its flat section (fresh array). `simTime` is the sim's own seconds. */
export function packEnvSection(clock: CityClockState, simTime: number): number[] {
  return [
    CSNAP_SCHEME,
    CSNAP_STRIDE,
    clock.hour,
    clock.dayFactor,
    clock.lampLevel,
    clock.headlights,
    clock.rain,
    simTime,
  ];
}

/**
 * Read the env section at `offset` (signal-viz.envSectionOffset), or the
 * daytime default when the snapshot predates it. `simTime` falls back to
 * the vehicle header's simTime so blink/flashes still tick on old buffers.
 */
export function readEnvSection(
  snapshot: readonly number[] | null | undefined,
  offset: number,
  fallbackSimTime = 0,
): CityClockState & { simTime: number } {
  if (!snapshot || snapshot.length < offset + CSNAP_HEADER + CSNAP_STRIDE || snapshot[offset + CSNAP.scheme] !== CSNAP_SCHEME) {
    return { ...DEFAULT_ENV_STATE, simTime: fallbackSimTime };
  }
  const o = offset + CSNAP_HEADER;
  const dayFactor = snapshot[o + CSNAP.dayFactor] ?? 1;
  const rain = snapshot[o + CSNAP.rain] ?? 0;
  return {
    hour: snapshot[o + CSNAP.hour] ?? 12,
    dayFactor,
    // Not packed — derived on read exactly as the clock derives it.
    effectiveDayFactor: dayFactor * (1 - RAIN_GLOOM * rain),
    lampLevel: snapshot[o + CSNAP.lampLevel] ?? 0,
    headlights: (snapshot[o + CSNAP.headlights] ?? 0) >= 0.5 ? 1 : 0,
    rain,
    simTime: snapshot[o + CSNAP.simTime] ?? fallbackSimTime,
  };
}
