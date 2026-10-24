/**
 * The Mon's idle motion: what it does when nobody is talking to it, and how
 * it carries itself while it talks. A pure `step(dt, inputs) → IdleFrame` with
 * no wall clock and no three.js, so a seed replays bit for bit and the tests
 * run headless. MonModel3D is the only writer: it turns a frame into mixer
 * actions, the root's heading and position, and an upper-body yaw.
 *
 * Modelled on MoyoLearn's Natalie (packages/avatar/src/idle/engine.ts), with
 * one change: every channel draws from its own seeded stream (see `stream`),
 * so adding a channel never shifts the numbers another one draws.
 *
 * What it never does: spin. The heading only changes by a turn clip
 * (up_turn_L / up_turn_R, a quarter turn with the feet stepping) and always
 * comes back to the front; the drift is the upper body's, bounded by
 * `idleConfig.drift.yawRad`.
 */
import { MON_GESTURES, type MonGesture } from '../lipsync/cue.ts';
import { idleConfig, type IdleConfig, type Range } from './config.ts';
import { GESTURE_CLIPS } from './gestures.ts';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One PRNG per channel, seeded from the engine seed and the channel's name (FNV-1a). */
export function stream(seed: number, channel: string): () => number {
  let h = 0x811c9dc5 ^ (seed >>> 0);
  for (let i = 0; i < channel.length; i++) {
    h ^= channel.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return mulberry32(h >>> 0);
}

const between = (r: () => number, range: Range) => range.min + (range.max - range.min) * r();
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** The clips this Mon has, resolved against its GLB (null = the file lacks it). */
export interface IdleClips {
  /** The upright loop for the mood (up_idle, emote_tired…). */
  readonly base: string | null;
  /** The mood's occasional clip (quad_idle_sniff when hungry); never a held pose. */
  readonly flavor: string | null;
  readonly listen: string | null;
  readonly turnL: string | null;
  readonly turnR: string | null;
  readonly walk: string | null;
  /** Squeaklet's in-place hop (rat_run). */
  readonly hop: string | null;
  readonly gestures: Readonly<Partial<Record<MonGesture, string>>>;
  /** Seconds per clip, from the GLB. */
  readonly durations: Readonly<Record<string, number>>;
  /** Asleep or worn out: the Mon stays put (no steps, turns or hops). */
  readonly restful: boolean;
}

/** Clips that loop well under everything else. The rest of a mood list plays now and then. */
const LOOPS: ReadonlySet<string> = new Set(['up_idle', 'up_breathe', 'emote_tired', 'tail_swish', 'egg_idle']);
const RESTFUL: ReadonlySet<string> = new Set(['emote_tired']);

/**
 * The clips for one Mon: `moodClips` is the view's list for the mood
 * (MON_CLIPS in the MCP server's contract), `durations` every clip in its GLB.
 * The list's first loop becomes the base and its first other clip the
 * occasional flavor, so hungry Lil' Ratti stands in up_idle and sniffs on all
 * fours now and then instead of crouching sideways for minutes.
 */
export function resolveIdleClips(moodClips: readonly string[], durations: Readonly<Record<string, number>>): IdleClips {
  const has = (n: string) => durations[n] !== undefined;
  const pick = (...names: string[]) => names.find(has) ?? null;
  const present = moodClips.filter(has);
  const gestures: Partial<Record<MonGesture, string>> = {};
  for (const g of MON_GESTURES) {
    const clip = GESTURE_CLIPS[g].find(has);
    if (clip) gestures[g] = clip;
  }
  return {
    base: present.find((n) => LOOPS.has(n)) ?? null,
    flavor: present.find((n) => !LOOPS.has(n)) ?? null,
    listen: pick('up_look_listen'),
    turnL: pick('up_turn_L'),
    turnR: pick('up_turn_R'),
    walk: pick('up_walk'),
    hop: pick('rat_run'),
    gestures,
    durations,
    restful: moodClips.length === 0 || RESTFUL.has(present[0] ?? ''),
  };
}

export interface IdleInputs {
  /** An utterance is playing (MonModel3D's utterance, including its face hold). */
  readonly speaking: boolean;
  /** The utterance's id; a new id is a new sentence. */
  readonly utteranceId: string | null;
  /** The host's gesture class for this sentence, if any. */
  readonly gesture: MonGesture | null;
  /** How long this sentence's audio runs, seconds. */
  readonly utteranceS: number;
  /** The host's microphone is open. */
  readonly listening: boolean;
  readonly reduced: boolean;
  /** How far the root may travel either side of centre, model units. 0 = no steps. */
  readonly boundX: number;
}

export interface IdleAction {
  /** New per action: the writer starts the clip when this changes. */
  readonly id: number;
  readonly clip: string;
  readonly loop: boolean;
  /** Fade in from whatever was playing, seconds. 0 is a cut (a turn's hand-off). */
  readonly fadeS: number;
  readonly kind: 'turn' | 'walk' | 'gesture' | 'flavor' | 'hop';
}

export interface IdleFrame {
  /** The loop under everything; plays whenever `action` is null. */
  readonly base: string | null;
  readonly action: IdleAction | null;
  /** Root heading, radians (0 = facing the viewer). Changes only when a turn clip ends. */
  readonly rootYaw: number;
  /** Root lateral offset, model units, within ±boundX. */
  readonly rootX: number;
  /** Upper-body yaw for the writer to spread from spine to head, radians. */
  readonly bodyYaw: number;
  /** Where the body points: rootYaw plus the turn clip's progress plus bodyYaw. For tests and the debug attribute. */
  readonly heading: number;
}

type Step =
  | { readonly kind: 'clip'; readonly action: Omit<IdleAction, 'id'>; readonly durS: number; readonly yawAtEnd: number }
  | { readonly kind: 'walk'; readonly action: Omit<IdleAction, 'id'>; readonly durS: number; readonly dir: 1 | -1 }
  | { readonly kind: 'wait'; readonly durS: number };

export interface IdleEngine {
  step(dt: number, inputs: IdleInputs): IdleFrame;
  /** The mood changed: new base and flavor from the next step on. Heading, position and plans carry over. */
  setClips(next: IdleClips): void;
}

export function createIdleEngine(initial: IdleClips, seed: number = idleConfig.seed, cfg: IdleConfig = idleConfig): IdleEngine {
  const rnd = {
    drift: stream(seed, 'drift'),
    turn: stream(seed, 'turn'),
    steps: stream(seed, 'steps'),
    flavor: stream(seed, 'flavor'),
    hop: stream(seed, 'hop'),
  };
  let clips = initial;
  const dur = (clip: string | null, fallback: number) => (clip ? (clips.durations[clip] ?? fallback) : fallback);
  // The rig's clips are the same whatever the mood, so these hold across setClips.
  const canTurn = initial.turnL !== null && initial.turnR !== null;
  const canWalk = canTurn && initial.walk !== null;
  // Squeaklet: no turn clips, so it sways a little at the root instead. An egg does neither.
  const rodent = !canTurn && initial.hop !== null;

  let now = 0;
  let heading = 0; // 0, +π/2 or −π/2: where the last turn clip left the root
  let x = 0;
  let nextId = 0;
  let queue: Step[] = [];
  let current: { step: Step; t: number; action: IdleAction | null } | null = null;
  let driftValue = 0;
  let driftVel = 0;
  let driftTarget = 0;
  let driftNextAt = between(rnd.drift, cfg.drift.holdS);
  let nextTurnAt = between(rnd.turn, cfg.turn.intervalS);
  let nextStepAt = between(rnd.steps, cfg.steps.intervalS);
  let nextFlavorAt = between(rnd.flavor, cfg.flavor.intervalS);
  let nextHopAt = between(rnd.hop, cfg.squeaklet.hopIntervalS);
  let lastSpeechAt = -Infinity;
  /** When the last step finished: idle plans wait `cfg.restS` after it. */
  let lastActiveAt = -Infinity;
  let bodyYaw = 0;
  let lastUtterance: string | null = null;

  const turnClip = (delta: number) => (delta > 0 ? clips.turnL : clips.turnR)!;
  const turnStep = (delta: number, fadeS: number): Step => ({
    kind: 'clip',
    action: { clip: turnClip(delta), loop: false, fadeS, kind: 'turn' },
    durS: dur(turnClip(delta), cfg.turn.clipS),
    yawAtEnd: delta,
  });
  const backToFront = (): Step[] => (heading === 0 ? [] : [turnStep(-heading, 0.15)]);

  /** Starts the next queued step. A turn's hand-off happened in finish(). */
  const begin = () => {
    const step = queue.shift();
    if (!step) {
      current = null;
      return;
    }
    current = { step, t: 0, action: step.kind === 'wait' ? null : { ...step.action, id: ++nextId } };
  };

  const finish = () => {
    const step = current?.step;
    lastActiveAt = now;
    // The turn clip ends a quarter turn round: hand that to the root on the same
    // frame the writer cuts to the base loop, so the body does not move.
    if (step?.kind === 'clip' && step.yawAtEnd !== 0) heading = clamp(heading + step.yawAtEnd, -Math.PI / 2, Math.PI / 2);
    begin();
  };

  /** Plans a few steps sideways and the turn back, or null when there is no room. */
  const planSteps = (boundX: number): Step[] | null => {
    if (!canWalk || boundX <= 0) return null;
    const perStep = (cfg.steps.strideSpeed * cfg.steps.walkCycleS) / cfg.steps.stepsPerCycle;
    let count = Math.round(between(rnd.steps, cfg.steps.count));
    const first: 1 | -1 = rnd.steps() < 0.5 ? 1 : -1;
    for (; count >= cfg.steps.count.min; count--) {
      for (const dir of [first, -first as 1 | -1]) {
        if (Math.abs(x + dir * count * perStep) <= boundX) {
          const walkS = (count * cfg.steps.walkCycleS) / cfg.steps.stepsPerCycle;
          return [
            turnStep(dir * cfg.turn.angleRad, 0.2),
            { kind: 'walk', action: { clip: clips.walk!, loop: true, fadeS: 0.25, kind: 'walk' }, durS: walkS, dir },
            { kind: 'wait', durS: cfg.steps.settleS },
            turnStep(-dir * cfg.turn.angleRad, 0.2),
          ];
        }
      }
    }
    return null;
  };

  return {
    setClips(next) {
      clips = next;
    },
    step(dtIn, inputs) {
      const dt = Math.max(0, Math.min(dtIn, 0.1));
      now += dt;
      const newSentence = inputs.speaking && inputs.utteranceId !== null && inputs.utteranceId !== lastUtterance;
      if (inputs.speaking) lastSpeechAt = now;
      if (inputs.utteranceId !== null) lastUtterance = inputs.utteranceId;
      const busy = inputs.speaking || inputs.listening || now - lastSpeechAt < cfg.speech.quietAfterS;

      // Speaking while turned away: drop the plan and turn to the viewer.
      if (inputs.speaking && canTurn) {
        const s = current?.step;
        if (s?.kind === 'clip' && s.yawAtEnd !== 0) {
          // Mid-turn: let it finish (under a second), then come straight back.
          const after = clamp(heading + s.yawAtEnd, -Math.PI / 2, Math.PI / 2);
          queue = Math.abs(after) > cfg.speech.faceThresholdRad ? [turnStep(-after, 0.15)] : [];
        } else if (Math.abs(heading) > cfg.speech.faceThresholdRad) {
          // Walking, settling or holding a look-away: stop and turn back now.
          queue = backToFront();
          begin();
        }
      }
      // Talking or listening stands it up: a sniff or a hop in progress ends (the writer fades back to the base).
      if ((inputs.speaking || inputs.listening) && current?.step.kind === 'clip' && (current.step.action.kind === 'flavor' || current.step.action.kind === 'hop')) {
        queue = [];
        begin();
      }
      // Reduced motion: no turns or steps start, and a turned Mon turns back once.
      if (inputs.reduced && current === null && heading !== 0 && canTurn) {
        queue = backToFront();
        begin();
      }

      // The current step.
      if (current) {
        current.t += dt;
        const s = current.step;
        if (s.kind === 'walk') x = clamp(x + s.dir * cfg.steps.strideSpeed * dt, -inputs.boundX, inputs.boundX);
        if (current.t >= s.durS) finish();
      }

      // A gesture for a new sentence, facing front and otherwise still.
      if (newSentence && inputs.gesture && !inputs.reduced && heading === 0 && current === null && queue.length === 0) {
        const clip = clips.gestures[inputs.gesture];
        const d = dur(clip ?? null, 0);
        if (clip && d > 0 && d <= inputs.utteranceS + cfg.gesture.overrunS) {
          queue = [{ kind: 'wait', durS: cfg.gesture.delayS }, { kind: 'clip', action: { clip, loop: false, fadeS: cfg.actionFadeS, kind: 'gesture' }, durS: d, yawAtEnd: 0 }];
          begin();
        }
      }

      // Idle events, only when nothing else is going on.
      if (!busy && !inputs.reduced && !clips.restful && current === null && queue.length === 0 && now - lastActiveAt >= cfg.restS) {
        if (canWalk && now >= nextStepAt) {
          nextStepAt = now + between(rnd.steps, cfg.steps.intervalS);
          const plan = planSteps(inputs.boundX);
          if (plan) {
            queue = plan;
            begin();
          }
        } else if (canTurn && now >= nextTurnAt) {
          nextTurnAt = now + between(rnd.turn, cfg.turn.intervalS);
          const dir = rnd.turn() < 0.5 ? 1 : -1;
          queue = [turnStep(dir * cfg.turn.angleRad, 0.2), { kind: 'wait', durS: between(rnd.turn, cfg.turn.holdS) }, turnStep(-dir * cfg.turn.angleRad, 0.2)];
          begin();
        } else if (clips.flavor && now >= nextFlavorAt && heading === 0) {
          nextFlavorAt = now + between(rnd.flavor, cfg.flavor.intervalS);
          queue = [{ kind: 'clip', action: { clip: clips.flavor, loop: false, fadeS: cfg.actionFadeS, kind: 'flavor' }, durS: dur(clips.flavor, 2), yawAtEnd: 0 }];
          begin();
        } else if (clips.hop && now >= nextHopAt) {
          nextHopAt = now + between(rnd.hop, cfg.squeaklet.hopIntervalS);
          queue = [{ kind: 'clip', action: { clip: clips.hop, loop: false, fadeS: 0.15, kind: 'hop' }, durS: dur(clips.hop, 0.6), yawAtEnd: 0 }];
          begin();
        }
      }
      // Timers that came due while busy wait for a fresh interval, not a burst.
      if (busy) {
        nextStepAt = Math.max(nextStepAt, now + cfg.speech.quietAfterS);
        nextTurnAt = Math.max(nextTurnAt, now + cfg.speech.quietAfterS);
      }

      // Upper-body drift: a new target every few seconds, eased (critically damped spring).
      if (now >= driftNextAt) {
        driftNextAt = now + between(rnd.drift, rodent ? cfg.squeaklet.swayHoldS : cfg.drift.holdS);
        const amp = between(rnd.drift, cfg.drift.yawRad);
        driftTarget = (rnd.drift() * 2 - 1) * amp;
      }
      const gain = inputs.reduced ? cfg.drift.reducedGain : inputs.speaking ? cfg.drift.speechGain : current?.step.kind === 'walk' ? 0 : 1;
      const k = cfg.drift.rate;
      const target = driftTarget * gain;
      const acc = k * k * (target - driftValue) - 2 * k * driftVel;
      driftVel += acc * dt;
      driftValue += driftVel * dt;
      const bodyLimit = cfg.drift.yawRad.max;
      const drift = clamp(driftValue, -bodyLimit, bodyLimit);

      const action = current?.action ?? null;
      const s = current?.step;
      const turning = s?.kind === 'clip' && s.yawAtEnd !== 0 ? s.yawAtEnd * Math.min(1, current!.t / s.durS) : 0;
      const sway = rodent ? drift * (cfg.squeaklet.swayRad / bodyLimit) : 0;
      // Turned away, the upper body only ever glances back toward the viewer:
      // drifting further round showed the back of the head.
      const away = heading + turning;
      const wanted = rodent ? 0 : Math.abs(away) > 1e-3 ? -Math.sign(away) * Math.min(Math.abs(drift), Math.abs(away)) : drift;
      bodyYaw += (wanted - bodyYaw) * (1 - Math.exp(-cfg.drift.settleRate * dt));
      const base = inputs.listening && clips.listen ? clips.listen : clips.base;
      return { base, action, rootYaw: heading + sway, rootX: x, bodyYaw, heading: heading + turning + sway + bodyYaw };
    },
  };
}
