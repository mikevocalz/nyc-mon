import assert from 'node:assert/strict';
import test from 'node:test';
import { amplitudeEnvelope, sampleAmplitude } from './amplitude.ts';
import { parseSpeechCue, pickSpeechTrack, sampleSpeechTrack, type FaceTrack } from './cue.ts';
import { arkitToRig, mouthToRig } from './retarget.ts';
import { damp } from './smoothing.ts';
import { buildVisemeTimeline, charViseme, sampleVisemes, type CharacterAlignment, type VisemeKey } from './visemes.ts';

/** An alignment for `text`, every character `stepMs` long, as ElevenLabs shapes it. */
function align(text: string, stepMs = 80): CharacterAlignment {
  const chars = [...text];
  return {
    characters: chars,
    character_start_times_seconds: chars.map((_, i) => (i * stepMs) / 1000),
    character_end_times_seconds: chars.map((_, i) => ((i + 1) * stepMs) / 1000),
  };
}

test('characters map to the viseme the lips make', () => {
  assert.equal(charViseme('m'), 'closed');
  assert.equal(charViseme('B'), 'closed');
  assert.equal(charViseme('p'), 'closed');
  assert.equal(charViseme('f'), 'teeth');
  assert.equal(charViseme('v'), 'teeth');
  assert.equal(charViseme('a'), 'open');
  assert.equal(charViseme('é'), 'wide');
  assert.equal(charViseme('i'), 'wide');
  assert.equal(charViseme('o'), 'round');
  assert.equal(charViseme('w'), 'round');
  assert.equal(charViseme('s', 'h'), 'round');
  assert.equal(charViseme('s', 'o'), 'mid');
  assert.equal(charViseme('t'), 'mid');
  assert.equal(charViseme(','), 'rest');
  assert.equal(charViseme('!'), 'rest');
  assert.equal(charViseme(' '), null);
  assert.equal(charViseme("'"), null);
});

test('the timeline merges repeats, drops audio tags and rests at long word gaps', () => {
  const keys = buildVisemeTimeline(align('[happily] mmm'));
  // The tag's characters are not read out: only the m's remain, merged into one key.
  assert.deepEqual(keys, [{ v: 'closed', startMs: 800, endMs: 1040 }]);

  const gap: CharacterAlignment = {
    characters: ['a', ' ', 'o'],
    character_start_times_seconds: [0, 0.1, 0.5],
    character_end_times_seconds: [0.1, 0.12, 0.6],
  };
  assert.deepEqual(buildVisemeTimeline(gap), [
    { v: 'open', startMs: 0, endMs: 100 },
    { v: 'rest', startMs: 100, endMs: 500 },
    { v: 'round', startMs: 500, endMs: 600 },
  ]);
});

test('a laugh tag opens the mouth for its span', () => {
  const keys = buildVisemeTimeline(align('[laughs] hi', 50));
  assert.equal(keys[0]?.v, 'open');
  assert.equal(keys[0]?.startMs, 0);
});

test('sampling: rest outside the clip, full shape mid-key, and lips meet on m/b/p', () => {
  const keys: VisemeKey[] = [
    { v: 'open', startMs: 0, endMs: 300 },
    { v: 'closed', startMs: 300, endMs: 400 },
    { v: 'open', startMs: 400, endMs: 700 },
  ];
  const opts = { vary: false };
  assert.equal(sampleVisemes(keys, -200, opts).open, 0);
  assert.equal(sampleVisemes(keys, 1200, opts).open, 0);
  assert.equal(sampleVisemes(keys, 150, opts).open, 0.85);
  assert.equal(sampleVisemes(keys, 350, opts).open, 0, 'a bilabial must close the lips fully');
});

test('coarticulation: the mouth crosses a boundary smoothly, no jump', () => {
  const keys: VisemeKey[] = [
    { v: 'wide', startMs: 0, endMs: 300 },
    { v: 'round', startMs: 300, endMs: 600 },
  ];
  let prev = sampleVisemes(keys, 0, { vary: false });
  for (let t = 1; t <= 600; t += 1) {
    const s = sampleVisemes(keys, t, { vary: false });
    assert.ok(Math.abs(s.round - prev.round) < 0.05 && Math.abs(s.wide - prev.wide) < 0.05, `jump at ${t} ms`);
    prev = s;
  }
  // Rounding is anticipated: it has started before the boundary.
  assert.ok(sampleVisemes(keys, 260, { vary: false }).round > 0.05);
});

test('reduced amplitude scales the opening, and variation stays inside ±12%', () => {
  const keys: VisemeKey[] = [{ v: 'open', startMs: 0, endMs: 1000 }];
  assert.ok(Math.abs(sampleVisemes(keys, 500, { amplitude: 0.6, vary: false }).open - 0.51) < 1e-9);
  const varied = sampleVisemes(keys, 500).open;
  assert.ok(varied >= 0.85 * 0.88 && varied <= 0.85 * 1.12);
});

test('damp is frame-rate independent and converges', () => {
  const once = damp(0, 1, 12, 1 / 30);
  const twice = damp(damp(0, 1, 12, 1 / 60), 1, 12, 1 / 60);
  assert.ok(Math.abs(once - twice) < 1e-12);
  assert.equal(damp(0.3, 1, 12, 0), 0.3);
  let x = 0;
  for (let i = 0; i < 120; i++) x = damp(x, 1, 12, 1 / 60);
  assert.ok(x > 0.999);
});

test('mouthToRig: a closed mouth shuts the lips, an open one parts them and drops the jaw', () => {
  assert.deepEqual(mouthToRig({ open: 0, wide: 0, round: 0, upper: 0 }), { jaw: 0, mouthClose: 1, mouthWide: 0, mouthRound: 0, mouthUpperUp: 0 });
  const open = mouthToRig({ open: 0.85, wide: 0.25, round: 0, upper: 0.1 });
  assert.equal(open.jaw, 0.85);
  assert.equal(open.mouthClose, 0);
});

test('arkitToRig: the explicit table, with zeros for every channel', () => {
  const rest = arkitToRig({});
  for (const v of Object.values(rest)) assert.ok(v === 0 || v === 1);
  assert.equal(rest.mouthClose, 1);
  assert.equal(Object.keys(rest).length, 16);
  const r = arkitToRig({
    jawOpen: 0.5,
    mouthPucker: 0.7,
    mouthSmileLeft: 0.4,
    mouthSmileRight: 0.2,
    browInnerUp: 0.3,
    browOuterUpRight: 0.6,
    mouthUpperUpLeft: 0.2,
    mouthUpperUpRight: 0.4,
    noseSneerLeft: 0.25,
    eyeBlinkLeft: 1,
  });
  assert.equal(r.jaw, 0.8);
  assert.equal(r.mouthRound, 0.7);
  assert.equal(r.smile_L, 0.4);
  assert.equal(r.smile_R, 0.2);
  assert.equal(r.browUp_L, 0.3);
  assert.equal(r.browUp_R, 0.6);
  assert.ok(Math.abs((r.mouthUpperUp ?? 0) - 0.3) < 1e-9);
  assert.equal(r.noseWrinkle, 0.25);
  assert.equal('lid_L' in r, false, 'blinks stay with the idle blink');
});

test('fallback order: face, then visemes, then amplitude, then nothing', () => {
  const face: FaceTrack = { fps: 30, names: ['JawOpen'], frames: [[0.2], [0.4]] };
  const alignment = align('hello');
  const amplitude = { fps: 60, values: [0, 0.5, 0.2] };
  assert.equal(pickSpeechTrack({ face, alignment, amplitude })?.kind, 'face');
  assert.equal(pickSpeechTrack({ face: null, alignment, amplitude })?.kind, 'visemes');
  assert.equal(pickSpeechTrack({ face: { ...face, frames: [] }, alignment, amplitude })?.kind, 'visemes');
  assert.equal(pickSpeechTrack({ alignment: align('   '), amplitude })?.kind, 'amplitude');
  assert.equal(pickSpeechTrack({ amplitude: { fps: 60, values: [0, 0] } }), null);
  assert.equal(pickSpeechTrack({}), null);
});

test('face frames are sampled by name on the audio clock, linear between frames', () => {
  const track = { kind: 'face' as const, fps: 10, names: ['MouthSmileLeft', 'JawOpen'], frames: [[0, 0], [0.4, 0.5]] };
  const mid = sampleSpeechTrack(track, 50);
  assert.ok(Math.abs((mid.smile_L ?? 0) - 0.2) < 1e-9);
  assert.ok(Math.abs((mid.jaw ?? 0) - 0.4) < 1e-9); // 0.25 * 1.6
  const past = sampleSpeechTrack(track, 5000);
  assert.equal(past.jaw, 0.8);
});

test('the envelope tracks loudness and gates silence', () => {
  const rate = 16_000;
  const samples = new Float32Array(rate); // 1 s: silence, then a tone
  for (let i = rate / 2; i < rate; i++) samples[i] = 0.5 * Math.sin((i / rate) * 2 * Math.PI * 220);
  const env = amplitudeEnvelope(samples, rate, 50);
  assert.equal(env.values.length, 50);
  assert.equal(env.values[5], 0);
  assert.ok((env.values[40] ?? 0) > 0.9);
  assert.equal(sampleAmplitude(env, 100).open, 0);
  assert.ok(sampleAmplitude(env, 800).open > 0.6);
  assert.equal(sampleAmplitude(env, 5000).open, 0);
  assert.deepEqual(amplitudeEnvelope(new Float32Array(100), rate, 50).values.every((v) => v === 0), true);
});

test('cue shape: start and stop parse; malformed cues are null', () => {
  const start = {
    kind: 'start',
    id: 'u1',
    elapsedMs: 12,
    durationMs: 900,
    track: { kind: 'visemes', keys: [{ v: 'open', startMs: 0, endMs: 100 }] },
  };
  assert.deepEqual(parseSpeechCue(start), start);
  assert.deepEqual(parseSpeechCue({ kind: 'stop', id: 'u1' }), { kind: 'stop', id: 'u1' });
  assert.deepEqual(JSON.parse(JSON.stringify(parseSpeechCue(start))), start, 'survives postMessage structured clone / JSON');
  for (const bad of [
    null,
    'start',
    { ...start, id: '' },
    { ...start, durationMs: 0 },
    { ...start, track: { kind: 'visemes', keys: [{ v: 'shout', startMs: 0, endMs: 1 }] } },
    { ...start, track: { kind: 'face', fps: 30, names: ['JawOpen'], frames: [[0.1, 0.2]] } },
    { ...start, track: { kind: 'amplitude', fps: 0, values: [] } },
    { kind: 'pause', id: 'u1' },
  ]) {
    assert.equal(parseSpeechCue(bad), null, JSON.stringify(bad));
  }
  assert.equal(parseSpeechCue({ ...start, elapsedMs: -5 })?.kind, 'start');
});

test('face frames land on the audio clock: frame k at k / fps, from the cue\'s own audio position', async () => {
  const { utteranceTimeMs } = await import('./cue.ts');
  const frames = Array.from({ length: 30 }, (_, k) => [k / 29]);
  const cue = { kind: 'start' as const, id: 'u', elapsedMs: 40, durationMs: 1000, track: { kind: 'face' as const, fps: 30, names: ['JawOpen'], frames } };
  // A fake view clock: the cue arrives at 5000 ms, 40 ms into the audio.
  const receivedAt = 5000;
  for (const k of [0, 3, 12, 29]) {
    const now = receivedAt - cue.elapsedMs + (k / 30) * 1000;
    const t = utteranceTimeMs(cue, receivedAt, now);
    assert.ok(Math.abs(t - (k / 30) * 1000) < 1e-9);
    const jaw = sampleSpeechTrack(cue.track, t).jaw ?? 0;
    assert.ok(Math.abs(jaw - Math.min(1, (k / 29) * 1.6)) < 1e-9, `frame ${k}`);
  }
});

test('a start cue carries a known gesture class and drops an unknown one; a listen cue parses', () => {
  const base = { kind: 'start', id: 'g1', elapsedMs: 0, durationMs: 800, track: { kind: 'amplitude', fps: 60, values: [0.4] } };
  assert.equal((parseSpeechCue({ ...base, gesture: 'greet' }) as { gesture?: string }).gesture, 'greet');
  assert.equal('gesture' in (parseSpeechCue({ ...base, gesture: 'moonwalk' }) ?? {}), false);
  assert.deepEqual(parseSpeechCue({ kind: 'listen', id: 'mic', on: true }), { kind: 'listen', id: 'mic', on: true });
  assert.equal(parseSpeechCue({ kind: 'listen', id: 'mic' }), null);
});
