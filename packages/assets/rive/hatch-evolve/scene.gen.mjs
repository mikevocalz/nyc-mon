#!/usr/bin/env node
/**
 * Writes scene.rml for the hatch-evolve Rive project: the evolution light
 * that plays behind the Metro Egg as it hatches (packages/ui/three/mon/
 * hatch-timeline.ts holds the beats). Generated because the sparkle spiral
 * and the shard-free particle paths are sampled curves; every other line is
 * plain RML. Run `node scene.gen.mjs` then `./build.sh`.
 *
 *   node scene.gen.mjs [--stage=wireframe|structure|motion|detail]
 *
 * The stages are the build order the Rive CLI agent workflow asks for; the
 * committed scene.rml is always `detail`.
 *
 * View model `Hatch` (the host drives it):
 *   stir, crack, burst, reveal   triggers, one per beat; crack fires 3 times
 *   intensity                    0..1, the glow and charge behind the egg
 *   reducedMotion                true: stir/crack/intensity do nothing, burst
 *                                and reveal play one soft fade glow only
 *
 * Colours are token hexes from packages/theme/tokens.ts (ARGB, no #):
 * brand.orange FC7C00, orange-300 FEBE80, orange-200 FED8B3, orange-100
 * FFEDDB, brand.apple F80000, brand.white F8F8F8.
 *
 * Light rules (Alexa+ PLATFORM-DOCS §2.9): one bloom, rising over 21 frames
 * (350 ms); every other brightening ramps at least as slowly; nothing strobes.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const stage = (process.argv.find((a) => a.startsWith('--stage=')) ?? '--stage=detail').slice(8);
const STAGES = ['wireframe', 'structure', 'motion', 'detail'];
if (!STAGES.includes(stage)) throw new Error(`unknown stage ${stage}`);
const at = (s) => STAGES.indexOf(stage) >= STAGES.indexOf(s);

const SIZE = 768;
const C = SIZE / 2;
const TAU = Math.PI * 2;
const n = (v) => Number(v.toFixed(4));

const COL = {
  orange: 'FC7C00',
  gold: 'FEBE80',
  pale: 'FED8B3',
  cream: 'FFEDDB',
  apple: 'F80000',
  white: 'F8F8F8',
};
const argb = (hex, a = 1) => `${Math.round(a * 255).toString(16).padStart(2, '0').toUpperCase()}${hex}`;

// ---- ids --------------------------------------------------------------
let next = 100;
const id = () => `0:${next++}`;
const VM = { vm: '0:40', stir: '0:41', crack: '0:42', burst: '0:43', reveal: '0:44', intensity: '0:45', reduced: '0:46', inst: '0:50' };

// ---- drawing ------------------------------------------------------------
const stops = (list) =>
  list.map(([pos, hex, a]) => `<GradientStop colorValue="${argb(hex, a)}" position="${pos}" name="S"/>`).join('');
const radialFill = (r, list) => `<Fill name="Fill"><RadialGradient startX="0" startY="0" endX="${r}" endY="0" name="G">${stops(list)}</RadialGradient></Fill>`;

/** Every animated drawable, by role, so the animations can key them by id. */
const O = {};
const shapes = [];
function shape(key, { x = 0, y = 0, rotation = 0, opacity, path, paint, blend = 'additive' }) {
  const sid = id();
  O[key] = sid;
  // Wireframe: everything shown at full strength so the layout can be checked by eye.
  const op = stage === 'wireframe' ? 1 : (opacity ?? 0);
  shapes.push(
    `<Shape x="${n(x)}" y="${n(y)}" rotation="${n(rotation)}" opacity="${op}" blendModeValue="${blend}" name="${key}" id="${sid}">${path}${paint}</Shape>`,
  );
  return sid;
}
const ellipse = (w, h = w) => `<Ellipse width="${w}" height="${h}" name="Path"/>`;
const star = (r) => {
  const k = r * 0.22;
  const pts = [[0, -r], [k, -k], [r, 0], [k, k], [0, r], [-k, k], [-r, 0], [-k, -k]];
  return `<PointsPath isClosed="true" name="Path">${pts.map(([px, py]) => `<StraightVertex x="${n(px)}" y="${n(py)}"/>`).join('')}</PointsPath>`;
};
const ray = (r0, r1, w0, w1) =>
  `<PointsPath isClosed="true" name="Path"><StraightVertex x="${r0}" y="${-w0}"/><StraightVertex x="${r1}" y="${-w1}"/><StraightVertex x="${r1}" y="${w1}"/><StraightVertex x="${r0}" y="${w0}"/></PointsPath>`;

// Back to front: settle glow, glow core, rays, data rings, crack rings, sparkles, bloom.
shape('SettleGlow', { path: ellipse(600), paint: radialFill(300, [[0, COL.cream, 0.95], [0.35, COL.gold, 0.7], [0.7, COL.orange, 0.25], [1, COL.orange, 0]]) });
shape('GlowCore', { path: ellipse(640), paint: radialFill(320, [[0, COL.white, 1], [0.25, COL.cream, 0.9], [0.5, COL.gold, 0.55], [0.78, COL.orange, 0.22], [1, COL.apple, 0]]) });
const RAYS = 12;
for (let i = 0; i < RAYS; i++) {
  shape(`Ray${i}`, {
    rotation: (i * TAU) / RAYS,
    path: ray(70, 372, 4, i % 2 ? 10 : 16),
    paint: `<Fill name="Fill"><LinearGradient startX="70" startY="0" endX="372" endY="0" name="G">${stops([[0, COL.cream, 0.9], [0.45, COL.gold, 0.45], [1, COL.orange, 0]])}</LinearGradient></Fill>`,
  });
}
// Digimon nod: two thin orange orbits, flattened and tilted, each carrying a bright arc.
for (const [i, tilt] of [[0, -0.35], [1, 0.42]]) {
  const trim = id();
  O[`OrbitTrim${i}`] = trim;
  shape(`Orbit${i}`, {
    rotation: tilt,
    path: ellipse(560, 170),
    paint: `<Stroke thickness="3" cap="round" name="Line"><SolidColor colorValue="${argb(COL.orange, 0.95)}" name="C"/><TrimPath start="0" end="0.22" offset="${i * 0.5}" modeValue="sequential" name="Trim" id="${trim}"/></Stroke><Stroke thickness="1" name="Track"><SolidColor colorValue="${argb(COL.orange, 0.25)}" name="C"/></Stroke>`,
  });
}
for (let i = 0; i < 3; i++) {
  shape(`CrackRing${i}`, {
    path: ellipse(300),
    paint: `<Stroke thickness="${i === 0 ? 10 : 6}" name="Glow"><SolidColor colorValue="${argb(i === 2 ? COL.orange : COL.gold, 0.9)}" name="C"/><Feather strength="10" name="F"/></Stroke><Stroke thickness="${i === 0 ? 3 : 2}" name="Line"><SolidColor colorValue="${argb(COL.cream, 1)}" name="C"/></Stroke>`,
  });
}
const SPARKS = 10;
for (let i = 0; i < SPARKS; i++) {
  const a = (i * TAU) / SPARKS;
  shape(`Spark${i}`, {
    x: Math.cos(a) * 250,
    y: Math.sin(a) * 250,
    path: star(i % 3 === 0 ? 18 : 12),
    paint: `<Fill name="Fill"><SolidColor colorValue="${argb(i % 4 === 1 ? COL.gold : COL.white)}" name="C"/></Fill>`,
  });
}
shape('Bloom', { path: ellipse(1000), paint: radialFill(500, [[0, 'FFFFFF', 1], [0.3, COL.white, 1], [0.55, COL.cream, 0.8], [0.8, COL.gold, 0.35], [1, COL.orange, 0]]) });

// ---- animation -------------------------------------------------------------
const P = { x: 13, y: 14, rotation: 15, scaleX: 16, scaleY: 17, opacity: 18, trimOffset: 116 };
const EASE = '<CubicEaseInterpolator x1="0.42" y1="0" x2="0.58" y2="1"/>';
const OUT = '<CubicEaseInterpolator x1="0" y1="0" x2="0.58" y2="1"/>';

/** keys: [frame, value, interp?] with interp 'ease' | 'out' | 'linear' | 'hold'. */
function track(objectId, prop, keys) {
  const kf = keys
    .map(([frame, value, interp = 'ease']) => {
      if (interp === 'ease' || interp === 'out') return `<KeyFrameDouble frame="${frame}" value="${n(value)}" interpolationType="cubic">${interp === 'ease' ? EASE : OUT}</KeyFrameDouble>`;
      return `<KeyFrameDouble frame="${frame}" value="${n(value)}" interpolationType="${interp}"/>`;
    })
    .join('');
  return { objectId, prop, kf };
}
const animations = [];
function anim(name, duration, tracks, loop = false) {
  const aid = id();
  const byObject = new Map();
  for (const t of tracks) {
    if (!byObject.has(t.objectId)) byObject.set(t.objectId, []);
    byObject.get(t.objectId).push(`<KeyedProperty propertyKey="${P[t.prop]}">${t.kf}</KeyedProperty>`);
  }
  const body = [...byObject].map(([oid, props]) => `<KeyedObject objectId="${oid}">${props.join('')}</KeyedObject>`).join('');
  animations.push(`<LinearAnimation loopValue="${loop ? 'loop' : 'oneShot'}" duration="${duration}" name="${name}" id="${aid}">${body}</LinearAnimation>`);
  return aid;
}

// Objects each layer owns. Two layers never key the same property.
const LEVEL = ['GlowCore', ...Array.from({ length: RAYS }, (_, i) => `Ray${i}`), 'Orbit0', 'Orbit1'];
const SPIRAL = Array.from({ length: SPARKS }, (_, i) => `Spark${i}`);
const BEAT = ['SettleGlow', 'CrackRing0', 'CrackRing1', 'CrackRing2', 'Bloom'];
const zero = (keys) => keys.map((k) => track(O[k], 'opacity', [[0, 0, 'hold']]));

// Level layer: a blend on `intensity` between two looping poses that move the same way.
const LOOP = 120;
function levelPose(level) {
  const t = [];
  t.push(track(O.GlowCore, 'opacity', [[0, 0.92 * level, 'hold']]));
  t.push(track(O.GlowCore, 'scaleX', [[0, 0.55 + 0.45 * level, 'ease'], [LOOP / 2, 0.58 + 0.47 * level, 'ease'], [LOOP, 0.55 + 0.45 * level]]));
  t.push(track(O.GlowCore, 'scaleY', [[0, 0.55 + 0.45 * level, 'ease'], [LOOP / 2, 0.58 + 0.47 * level, 'ease'], [LOOP, 0.55 + 0.45 * level]]));
  for (let i = 0; i < RAYS; i++) {
    const base = (i * TAU) / RAYS;
    // A slow turn of one ray spacing per loop: seamless, 12-fold symmetric.
    t.push(track(O[`Ray${i}`], 'rotation', [[0, base, 'linear'], [LOOP, base + TAU / RAYS]]));
    t.push(track(O[`Ray${i}`], 'opacity', [[0, 0.75 * Math.max(0, level - 0.15) / 0.85, 'hold']]));
  }
  for (const i of [0, 1]) {
    t.push(track(O[`Orbit${i}`], 'opacity', [[0, Math.max(0, level - 0.6) / 0.4, 'hold']]));
    t.push(track(O[`OrbitTrim${i}`], 'trimOffset', [[0, i * 0.5, 'linear'], [LOOP, i * 0.5 + (i ? -1 : 1)]]));
  }
  // Sparkles spiral in toward the egg, 1.5 turns each, staggered round the loop.
  for (let s = 0; s < SPARKS; s++) {
    const xs = [];
    const ys = [];
    const os = [];
    const phase0 = s / SPARKS;
    let prevP = null;
    for (let f = 0; f <= LOOP; f += 4) {
      const p = (f / LOOP + phase0) % 1;
      const wrap = prevP !== null && p < prevP;
      prevP = p;
      const r = 340 - 290 * p * p;
      const a = (s * TAU) / SPARKS + p * TAU * 1.5;
      const op = Math.sin(p * Math.PI) * Math.max(0, level - 0.6) / 0.4;
      // The jump back out happens while the sparkle is invisible: hold across it.
      if (wrap && xs.length) {
        xs.at(-1)[2] = 'hold';
        ys.at(-1)[2] = 'hold';
      }
      xs.push([f, Math.cos(a) * r, 'linear']);
      ys.push([f, Math.sin(a) * r, 'linear']);
      os.push([f, op, 'linear']);
    }
    t.push(track(O[`Spark${s}`], 'x', xs), track(O[`Spark${s}`], 'y', ys), track(O[`Spark${s}`], 'opacity', os));
  }
  return t;
}

const BLOOM_RISE = 21; // 350 ms at 60 fps
const anims = {};
if (at('motion')) {
  anims.levelOff = anim('LevelOff', 1, [...zero(LEVEL), ...zero(SPIRAL)]);
  anims.levelLow = anim('LevelLow', LOOP, levelPose(0), true);
  anims.levelHigh = anim('LevelHigh', LOOP, levelPose(1), true);

  anims.rest = anim('Rest', 1, zero(BEAT));
  // stir: nothing bright yet, a faint warm breath from the middle (the 3D stage dims around it).
  anims.stir = anim('Stir', 30, [...zero(BEAT.filter((k) => k !== 'SettleGlow')), track(O.SettleGlow, 'opacity', [[0, 0, 'ease'], [30, 0.18]]), track(O.SettleGlow, 'scaleX', [[0, 0.4, 'hold']]), track(O.SettleGlow, 'scaleY', [[0, 0.4, 'hold']])]);
  // crack: one light ring leaves the centre (rises over 21 frames, then fades).
  const ringOut = (k, delay, s0, s1, peak) => [
    track(O[k], 'opacity', [[0, 0, 'hold'], [delay, 0, 'ease'], [delay + 21, peak, 'out'], [delay + 50, 0]]),
    track(O[k], 'scaleX', [[0, s0, 'hold'], [delay, s0, 'out'], [delay + 50, s1]]),
    track(O[k], 'scaleY', [[0, s0, 'hold'], [delay, s0, 'out'], [delay + 50, s1]]),
  ];
  anims.crack = anim('Crack', 54, [...zero(['CrackRing1', 'CrackRing2', 'Bloom']), track(O.SettleGlow, 'opacity', [[0, 0.18, 'hold']]), ...ringOut('CrackRing0', 0, 0.45, 1.5, 0.85)]);
  // burst: the one bloom (21-frame rise, short hold, slow fall) and two rings out.
  anims.burst = anim('Burst', 72, [
    track(O.SettleGlow, 'opacity', [[0, 0.18, 'ease'], [20, 0]]),
    track(O.CrackRing0, 'opacity', [[0, 0, 'hold']]),
    track(O.Bloom, 'opacity', [[0, 0, 'ease'], [BLOOM_RISE, 1, 'hold'], [BLOOM_RISE + 8, 1, 'ease'], [72, 0]]),
    track(O.Bloom, 'scaleX', [[0, 0.3, 'out'], [BLOOM_RISE, 1.3, 'out'], [72, 1.6]]),
    track(O.Bloom, 'scaleY', [[0, 0.3, 'out'], [BLOOM_RISE, 1.3, 'out'], [72, 1.6]]),
    ...ringOut('CrackRing1', 4, 0.5, 2.6, 0.9),
    ...ringOut('CrackRing2', 12, 0.4, 2.2, 0.8),
  ]);
  // reveal: the settling glow comes up behind the Baby, then breathes slowly.
  anims.reveal = anim('Reveal', 60, [...zero(['CrackRing0', 'CrackRing1', 'CrackRing2', 'Bloom']), track(O.SettleGlow, 'opacity', [[0, 0, 'ease'], [42, 0.6]]), track(O.SettleGlow, 'scaleX', [[0, 0.7, 'out'], [60, 1]]), track(O.SettleGlow, 'scaleY', [[0, 0.7, 'out'], [60, 1]])]);
  anims.settle = anim('Settle', 240, [track(O.SettleGlow, 'opacity', [[0, 0.6, 'ease'], [120, 0.48, 'ease'], [240, 0.6]]), track(O.SettleGlow, 'scaleX', [[0, 1, 'ease'], [120, 1.05, 'ease'], [240, 1]]), track(O.SettleGlow, 'scaleY', [[0, 1, 'ease'], [120, 1.05, 'ease'], [240, 1]])], true);
  // Reduced motion: one soft glow up (burst) and down (reveal). No rays, rings or sparkles.
  anims.calmUp = anim('CalmUp', 36, [...zero(['CrackRing0', 'CrackRing1', 'CrackRing2', 'Bloom']), track(O.SettleGlow, 'opacity', [[0, 0, 'ease'], [36, 0.5]]), track(O.SettleGlow, 'scaleX', [[0, 1, 'hold']]), track(O.SettleGlow, 'scaleY', [[0, 1, 'hold']])]);
  anims.calmDown = anim('CalmDown', 48, [track(O.SettleGlow, 'opacity', [[0, 0.5, 'ease'], [48, 0.3]])]);
} else {
  anims.rest = anim('Rest', 60, []);
}

// ---- state machine -----------------------------------------------------------
const bind = (prop, kind, key) => `<${kind}><DataBindContext sourcePathIds="${VM.vm}-${prop}" propertyKey="${key}"/></${kind}>`;
const onTrigger = (prop) => `<TransitionViewModelCondition><TransitionPropertyViewModelComparator>${bind(prop, 'BindablePropertyTrigger', 686)}</TransitionPropertyViewModelComparator><TransitionValueTriggerComparator/></TransitionViewModelCondition>`;
const reducedIs = (v) => `<TransitionViewModelCondition><TransitionPropertyViewModelComparator>${bind(VM.reduced, 'BindablePropertyBoolean', 634)}</TransitionPropertyViewModelComparator><TransitionValueBooleanComparator value="${v}"/></TransitionViewModelCondition>`;
const go = (to, conds, extra = '') => `<StateTransition stateToId="${to}" duration="0"${extra}>${conds}</StateTransition>`;

let machine;
if (at('structure') && at('motion')) {
  const S = { rest: id(), stir: id(), crack: id(), burst: id(), reveal: id(), settle: id(), calmUp: id(), calmDown: id(), lvOff: id(), lvBlend: id() };
  const any = [
    go(S.stir, onTrigger(VM.stir) + reducedIs(false)),
    go(S.crack, onTrigger(VM.crack) + reducedIs(false)),
    go(S.burst, onTrigger(VM.burst) + reducedIs(false)),
    go(S.reveal, onTrigger(VM.reveal) + reducedIs(false)),
    go(S.calmUp, onTrigger(VM.burst) + reducedIs(true)),
    go(S.calmDown, onTrigger(VM.reveal) + reducedIs(true)),
  ].join('');
  const st = (sid, aid, x, y, body = '') => `<AnimationState x="${x}" y="${y}" animationId="${aid}" reset="true" id="${sid}">${body}</AnimationState>`;
  machine = `
        <StateMachine name="Hatch" id="0:7">
            <!-- Beat: one state per trigger. crack re-enters itself (reset) each time it fires. -->
            <StateMachineLayer name="Beat" id="0:8">
                <AnyState x="560" y="-160">${any}</AnyState>
                <ExitState x="760" y="-160"/>
                <EntryState x="0" y="0"><StateTransition stateToId="${S.rest}"/></EntryState>
                ${st(S.rest, anims.rest, 160, 0)}
                ${st(S.stir, anims.stir, 360, 0)}
                ${st(S.crack, anims.crack, 560, 0)}
                ${st(S.burst, anims.burst, 760, 0)}
                ${st(S.reveal, anims.reveal, 960, 0, `<StateTransition stateToId="${S.settle}" duration="200" enableExitTime="true" exitTimeIsPercetange="true" exitTime="100"/>`)}
                ${st(S.settle, anims.settle, 1160, 0)}
                ${st(S.calmUp, anims.calmUp, 760, 200)}
                ${st(S.calmDown, anims.calmDown, 960, 200)}
            </StateMachineLayer>
            <!-- Level: intensity blends the glow, rays, orbits and sparkle spiral. Off under reduced motion. -->
            <StateMachineLayer name="Level" id="0:9">
                <AnyState x="560" y="-160"/>
                <ExitState x="760" y="-160"/>
                <EntryState x="0" y="0"><StateTransition stateToId="${S.lvOff}"/></EntryState>
                ${st(S.lvOff, anims.levelOff, 160, 0, go(S.lvBlend, reducedIs(false)))}
                <BlendState1DViewModel x="360" y="0" id="${S.lvBlend}">
                    ${bind(VM.intensity, 'BindablePropertyNumber', 636)}
                    <BlendAnimation1D animationId="${anims.levelLow}" value="0"/>
                    <BlendAnimation1D animationId="${anims.levelHigh}" value="1"/>
                    ${go(S.lvOff, reducedIs(true))}
                </BlendState1DViewModel>
            </StateMachineLayer>
        </StateMachine>`;
} else {
  machine = `
        <StateMachine name="Hatch" id="0:7">
            <StateMachineLayer name="Beat" id="0:8">
                <AnyState x="560" y="-160"/>
                <ExitState x="760" y="-160"/>
                <EntryState x="0" y="0"><StateTransition stateToId="0:12"/></EntryState>
                <AnimationState x="160" y="0" animationId="${anims.rest}" id="0:12"/>
            </StateMachineLayer>
        </StateMachine>`;
}

const viewModel = at('structure')
  ? `
    <ViewModel defaultInstanceId="${VM.inst}" name="Hatch" id="${VM.vm}">
        <ViewModelPropertyTrigger name="stir" id="${VM.stir}"/>
        <ViewModelPropertyTrigger name="crack" id="${VM.crack}"/>
        <ViewModelPropertyTrigger name="burst" id="${VM.burst}"/>
        <ViewModelPropertyTrigger name="reveal" id="${VM.reveal}"/>
        <ViewModelPropertyNumber name="intensity" id="${VM.intensity}"/>
        <ViewModelPropertyBoolean name="reducedMotion" id="${VM.reduced}"/>
        <ViewModelInstance exports="true" name="Default" id="${VM.inst}">
            <ViewModelInstanceTrigger viewModelPropertyId="${VM.stir}"/>
            <ViewModelInstanceTrigger viewModelPropertyId="${VM.crack}"/>
            <ViewModelInstanceTrigger viewModelPropertyId="${VM.burst}"/>
            <ViewModelInstanceTrigger viewModelPropertyId="${VM.reveal}"/>
            <ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="${VM.intensity}"/>
            <ViewModelInstanceBoolean propertyValue="false" viewModelPropertyId="${VM.reduced}"/>
        </ViewModelInstance>
    </ViewModel>`
  : '';
const vmAttrs = at('structure') ? ` viewModelId="${VM.vm}" viewModelInstanceId="${VM.inst}"` : '';

const rml = `<Rive version="1" kind="fragment">
    <!-- Generated by scene.gen.mjs (stage: ${stage}); edit that, not this. -->
    <!-- bloom-rise-frames: ${BLOOM_RISE} -->
    <!-- HatchEvolve: the evolution light behind the hatching Metro Egg. Transparent
         768x768 artboard, everything centred on the FX node. Paints are additive so
         the light sums like light over whatever sits behind it. -->
    <Artboard defaultStateMachineId="0:7" styleId="0:5"${vmAttrs} width="${SIZE}" height="${SIZE}" name="HatchEvolve" id="0:2">
        <LayoutComponentStyle name="Artboard Style" id="0:5"/>
        <Node x="${C}" y="${C}" name="FX" id="0:20">
            ${[...shapes].reverse().join('\n            ')}
        </Node>
${machine}
        ${animations.join('\n        ')}
    </Artboard>${viewModel}
</Rive>
`;

const here = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(here, 'scene.rml'), rml);
console.log(`scene.rml (${stage}): ${shapes.length} shapes, ${animations.length} animations`);
