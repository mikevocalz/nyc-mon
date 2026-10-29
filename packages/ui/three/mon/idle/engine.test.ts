import assert from 'node:assert/strict';
import test from 'node:test';
import { idleConfig } from './config.ts';
import { createIdleEngine, resolveIdleClips, stream, type IdleFrame, type IdleInputs } from './engine.ts';
import { gestureFor } from './gestures.ts';

/** Clip lengths as Lil' Ratti's GLB has them (measured 2026-10-23). */
const RATTI: Record<string, number> = {
  up_idle: 6, up_breathe: 3, up_look_listen: 2.5, up_turn_L: 1, up_turn_R: 1, up_walk: 1, quad_idle_sniff: 3, emote_tired: 2.2,
  wave: 1.8, head_nod: 1, head_shake: 1, shrug: 1.4, self_point: 1.3, emote_happy: 2.2, beckon: 1.7, emote_curious: 2.2,
};
const SQUEAKLET: Record<string, number> = { jaw_chomp: 0.8, mouth_close: 1.67, rat_run: 0.57, tail_swish: 1.1, blink: 4 };
const IDLE = ['up_idle', 'up_breathe', 'quad_idle_sniff'];
const FPS = 60;
const quiet: IdleInputs = { speaking: false, utteranceId: null, gesture: null, utteranceS: 0, listening: false, reduced: false, boundX: 0.35 };

function run(seconds: number, seed = 7, inputs: (t: number) => IdleInputs = () => quiet, clips = resolveIdleClips(IDLE, RATTI)) {
  const e = createIdleEngine(clips, seed);
  const frames: (IdleFrame & { t: number })[] = [];
  for (let i = 0; i < seconds * FPS; i++) frames.push({ t: i / FPS, ...e.step(1 / FPS, inputs(i / FPS)) });
  return frames;
}
const actionsOf = (frames: readonly IdleFrame[]) => {
  const seen = new Map<number, { kind: string; clip: string }>();
  for (const f of frames) if (f.action && !seen.has(f.action.id)) seen.set(f.action.id, { kind: f.action.kind, clip: f.action.clip });
  return [...seen.values()];
};

test('the same seed replays bit for bit; another seed does not', () => {
  assert.deepEqual(run(120, 7), run(120, 7));
  assert.notDeepEqual(run(120, 7).map((f) => f.bodyYaw), run(120, 8).map((f) => f.bodyYaw));
});

test('channel streams are independent: one channel draws the same numbers whatever else exists', () => {
  const a = stream(3, 'drift');
  const b = stream(3, 'drift');
  stream(3, 'a-new-channel')();
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  assert.notEqual(stream(3, 'drift')(), stream(3, 'turn')());
});

test('ten idle minutes: no spin, the heading only ever sits at the front or a quarter turn, and stays in the stage box', () => {
  const frames = run(600);
  const bodyMax = idleConfig.drift.yawRad.max + 1e-9;
  for (const f of frames) {
    assert.ok([0, Math.PI / 2, -Math.PI / 2].includes(f.rootYaw), `rootYaw ${f.rootYaw} at ${f.t}`);
    assert.ok(Math.abs(f.bodyYaw) <= bodyMax, `bodyYaw ${f.bodyYaw}`);
    // Never further round than a quarter turn: turned away, it only glances back.
    assert.ok(Math.abs(f.heading) <= Math.PI / 2 + 1e-9, `heading ${f.heading} at ${f.t}`);
    assert.ok(Math.abs(f.rootX) <= quiet.boundX + 1e-9, `rootX ${f.rootX}`);
  }
  // Mostly facing the viewer.
  // Mostly facing the viewer: a third of a radian covers the upper-body drift.
  const front = frames.filter((f) => Math.abs(f.heading) < Math.PI / 6).length / frames.length;
  assert.ok(front > 0.6, `front ${front}`);
  // It does step about, and every excursion comes back to the front.
  assert.ok(Math.max(...frames.map((f) => Math.abs(f.rootX))) > 0.1);
  const turns = actionsOf(frames).filter((a) => a.kind === 'turn');
  const lefts = turns.filter((a) => a.clip === 'up_turn_L').length;
  const rights = turns.filter((a) => a.clip === 'up_turn_R').length;
  assert.ok(Math.abs(lefts - rights) <= 1, `${lefts} left turns, ${rights} right`);
});

test('steps come every 8-20 s plus the excursion itself', () => {
  const frames = run(600);
  const walkStarts: number[] = [];
  let last = -1;
  for (const f of frames) {
    if (f.action?.kind === 'walk' && f.action.id !== last) walkStarts.push(f.t);
    if (f.action) last = f.action.id;
  }
  assert.ok(walkStarts.length >= 15, `${walkStarts.length} walks in 10 min`);
  for (let i = 1; i < walkStarts.length; i++) {
    const gap = walkStarts[i]! - walkStarts[i - 1]!;
    // interval + turn, walk (≤1.5 s), settle, turn back; a look-away can sit between two walks.
    assert.ok(gap >= idleConfig.steps.intervalS.min - 0.1 && gap <= idleConfig.steps.intervalS.max + 12, `gap ${gap}`);
  }
});

test('reduced motion: no turns, steps, flavor or gestures, and almost no sway', () => {
  const frames = run(300, 7, (t) => ({ ...quiet, reduced: true, speaking: t > 100 && t < 103, utteranceId: t > 100 && t < 103 ? 'u1' : null, gesture: 'greet', utteranceS: 3 }));
  assert.deepEqual(actionsOf(frames), []);
  for (const f of frames) {
    assert.equal(f.rootYaw, 0);
    assert.equal(f.rootX, 0);
    assert.ok(Math.abs(f.bodyYaw) <= idleConfig.drift.yawRad.max * idleConfig.drift.reducedGain + 0.01, `bodyYaw ${f.bodyYaw}`);
  }
});

test('speech while turned away: the Mon turns back to the viewer within a turn clip and holds the front', () => {
  // Find a moment the Mon is turned away, then start talking there.
  const probe = run(600);
  const away = probe.find((f) => f.rootYaw !== 0 && !f.action);
  assert.ok(away, 'the Mon turns away at some point');
  const startAt = away.t;
  const frames = run(startAt + 6, 7, (t) => (t >= startAt ? { ...quiet, speaking: true, utteranceId: 'u1', utteranceS: 6 } : quiet));
  const after = frames.filter((f) => f.t >= startAt + idleConfig.turn.clipS + 0.25);
  assert.ok(after.length > 0);
  for (const f of after) {
    assert.equal(f.rootYaw, 0, `rootYaw at ${f.t}`);
    assert.ok(Math.abs(f.heading) < 0.15, `heading ${f.heading} at ${f.t}`);
  }
  const turnBack = actionsOf(frames.filter((f) => f.t >= startAt));
  assert.equal(turnBack[0]?.kind, 'turn');
});

test('three sentences with short gaps: the Mon faces the viewer throughout and gestures at most once per sentence', () => {
  const sentences = [
    { id: 's1', from: 1, to: 2.6, gesture: 'greet' as const },
    { id: 's2', from: 2.75, to: 4.2, gesture: 'self' as const },
    { id: 's3', from: 4.35, to: 6, gesture: 'question' as const },
  ];
  const frames = run(7, 7, (t) => {
    const s = sentences.find((x) => t >= x.from && t < x.to);
    // the view's face hold keeps `speaking` up through the 150 ms gaps
    const held = t >= 1 && t < 7;
    return { ...quiet, speaking: held, utteranceId: s?.id ?? null, gesture: s?.gesture ?? null, utteranceS: s ? s.to - s.from : 0 };
  });
  for (const f of frames.filter((x) => x.t >= 1)) assert.ok(Math.abs(f.heading) < 0.15, `heading ${f.heading} at ${f.t}`);
  const gestures = actionsOf(frames).filter((a) => a.kind === 'gesture').map((a) => a.clip);
  assert.ok(gestures.length >= 1 && gestures.length <= 3, gestures.join());
  assert.equal(gestures[0], 'wave');
});

test('listening swaps the base to up_look_listen', () => {
  const f = run(2, 7, () => ({ ...quiet, listening: true })).at(-1)!;
  assert.equal(f.base, 'up_look_listen');
});

test('a tired Mon keeps its rest pose while it listens', () => {
  const clips = resolveIdleClips(['emote_tired', 'up_breathe'], RATTI);
  const f = run(2, 7, () => ({ ...quiet, listening: true }), clips).at(-1)!;
  assert.equal(f.base, 'emote_tired');
});

test('a hungry Lil’ Ratti stands in up_idle and sniffs now and then', () => {
  const clips = resolveIdleClips(['quad_idle_sniff', 'up_idle'], RATTI);
  assert.equal(clips.base, 'up_idle');
  assert.equal(clips.flavor, 'quad_idle_sniff');
  const frames = run(300, 11, () => ({ ...quiet, boundX: 0 }), clips);
  const sniffs = actionsOf(frames).filter((a) => a.clip === 'quad_idle_sniff').length;
  assert.ok(sniffs >= 3, `${sniffs} sniffs`);
  const crouched = frames.filter((f) => f.action?.clip === 'quad_idle_sniff').length / frames.length;
  assert.ok(crouched < 0.35, `crouched ${crouched}`);
});

test('asleep: no steps or turns', () => {
  const clips = resolveIdleClips(['emote_tired', 'up_breathe'], RATTI);
  assert.equal(clips.restful, true);
  assert.deepEqual(actionsOf(run(300, 7, () => quiet, clips)), []);
});

test('Squeaklet sways gently at the root and hops, never turns or walks', () => {
  const clips = resolveIdleClips(['tail_swish', 'rat_run'], SQUEAKLET);
  const frames = run(300, 7, () => quiet, clips);
  for (const f of frames) assert.ok(Math.abs(f.rootYaw) <= idleConfig.squeaklet.swayRad + 1e-9, `${f.rootYaw}`);
  const kinds = new Set(actionsOf(frames).map((a) => a.kind));
  assert.ok(!kinds.has('turn') && !kinds.has('walk'));
  assert.ok(kinds.has('hop'));
});

test('gestureFor reads the words, not the stage directions', () => {
  assert.equal(gestureFor('*chuckle* Yo James! What’s good?'), 'question');
  assert.equal(gestureFor('Yo Callah, we out here.'), 'greet');
  assert.equal(gestureFor('Say less, Callah.'), 'agree');
  assert.equal(gestureFor('I’m good right now.'), 'self');
  assert.equal(gestureFor('Bet!'), 'excited');
  assert.equal(gestureFor('Nah, only the Caller can do that.'), 'deny');
  assert.equal(gestureFor('*yawn*'), null);
  assert.equal(gestureFor('Energy is at 18 percent.'), null);
});

test('a reply that starts mid-sniff stands the Mon up and still gets its greeting', () => {
  const clips = resolveIdleClips(['quad_idle_sniff', 'up_idle'], RATTI);
  const probe = run(120, 11, () => ({ ...quiet, boundX: 0 }), clips);
  const sniff = probe.find((f) => f.action?.clip === 'quad_idle_sniff');
  assert.ok(sniff);
  const at = sniff.t + 0.5;
  const frames = run(at + 3, 11, (t) => (t >= at ? { ...quiet, boundX: 0, speaking: true, utteranceId: 'u1', gesture: 'greet', utteranceS: 3 } : { ...quiet, boundX: 0 }), clips);
  const after = frames.filter((f) => f.t > at + 0.05);
  assert.ok(after.every((f) => f.action?.clip !== 'quad_idle_sniff'));
  assert.ok(after.some((f) => f.action?.clip === 'wave'));
});

test('every turn-away comes back to the front within a few seconds, and the upper body never snaps', () => {
  const frames = run(1200, 3);
  let awaySince: number | null = null;
  let longest = 0;
  for (const f of frames) {
    if (f.rootYaw !== 0 || f.action?.kind === 'turn') awaySince ??= f.t;
    else if (awaySince !== null) {
      longest = Math.max(longest, f.t - awaySince);
      awaySince = null;
    }
  }
  // Longest excursion: turn 1 s + 3 steps 1.5 s + settle + turn 1 s, or a turn, a 2 s glance and a turn.
  assert.ok(longest < 4.5, `longest time away ${longest.toFixed(2)} s`);
  for (let i = 1; i < frames.length; i++) {
    const jump = Math.abs(frames[i]!.bodyYaw - frames[i - 1]!.bodyYaw);
    assert.ok(jump < 0.05, `bodyYaw jumped ${jump} at ${frames[i]!.t}`);
  }
  const front = frames.filter((f) => Math.abs(f.heading) < (20 * Math.PI) / 180 + 1e-6).length / frames.length;
  assert.ok(front > 0.75, `front ${front}`);
});

test('perform (M13 attention/approach): plays the clip once, facing front, then returns to the idle', () => {
  const e = createIdleEngine(resolveIdleClips(IDLE, RATTI), 7);
  e.step(1 / FPS, quiet);
  assert.equal(e.perform('up_look_listen'), true);
  const frames: IdleFrame[] = [];
  for (let i = 0; i < 4 * FPS; i++) frames.push(e.step(1 / FPS, quiet));
  const first = frames.find((f) => f.action !== null);
  assert.equal(first?.action?.clip, 'up_look_listen');
  assert.equal(first?.action?.kind, 'gesture');
  assert.equal(first?.action?.loop, false);
  // 2.5 s clip: by 4 s it is over and nothing replays it.
  assert.equal(frames.at(-1)?.action?.clip === 'up_look_listen', false);
  assert.ok(frames.every((f) => f.rootYaw === 0));
});

test('perform with a clip the GLB lacks changes nothing and says so', () => {
  const e = createIdleEngine(resolveIdleClips(['tail_swish'], SQUEAKLET), 7);
  e.step(1 / FPS, quiet);
  assert.equal(e.perform('up_look_listen'), false);
  assert.equal(e.step(1 / FPS, quiet).action, null);
});

test('perform while turned away: it turns back to the viewer first, then plays', () => {
  // Run until a turn has landed (heading off the front with no plan running).
  const e = createIdleEngine(resolveIdleClips(IDLE, RATTI), 7);
  let f = e.step(1 / FPS, quiet);
  for (let i = 0; i < 600 * FPS && !(f.rootYaw !== 0 && f.action === null); i++) f = e.step(1 / FPS, quiet);
  assert.notEqual(f.rootYaw, 0, 'the seed should turn the Mon within ten minutes');
  assert.equal(e.perform('wave'), true);
  const kinds: string[] = [];
  for (let i = 0; i < 4 * FPS; i++) {
    const a = e.step(1 / FPS, quiet).action;
    if (a && kinds.at(-1) !== `${a.kind}:${a.clip}`) kinds.push(`${a.kind}:${a.clip}`);
  }
  assert.equal(kinds[0]?.startsWith('turn:'), true, kinds.join(','));
  assert.ok(kinds.includes('gesture:wave'), kinds.join(','));
});
