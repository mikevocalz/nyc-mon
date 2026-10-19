// The Caller proxy: a low-poly figure built from three.js primitives that
// stands in for the Caller until Mike's own character models land
// (docs/plans/quest-presence.md). Colours are neutral on purpose: a grey
// mannequin head and hands, a royal jacket and ink trousers, so the proxy
// never claims a skin tone, face or outfit the canon has not given the
// Caller. The one canon prop is the H-Lynk Core on the left wrist (red body,
// black scanner head, red LED: DECISIONS 7 and 16). A carolina ring on the
// ground marks the Caller from the 30 m chase distance.
//
// Animation is procedural and driven by gait cycles walked (`gaitPhase`,
// distance over a stride that lengthens from walk to run), so limb swing
// matches ground speed at any frame rate and an idle Caller costs no frames:
// update() reports motion only while walking, running or airborne.
//
// Decision: BUILD primitives, DEFER a baked CC0 rig (Quaternius). A baked
// skinned mesh plus clips is a few hundred KB of TS and an unverified
// SkinnedMesh path on react-native-webgpu, for a figure Mike's models will
// replace. Asset size here: 0 bytes, about 14 draw calls.
import { palette, signage } from '@acme/theme';
import type { Three } from '@acme/ui/three';
import type { ActorFrame, SceneActor, SceneActorFactory } from '../scene-actor.ts';
import { callerStore, type CallerState } from './caller-store.ts';
import { RUN_SPEED, WALK_SPEED, isAirborne } from './locomotion.ts';

export { CYCLE_METRES } from './locomotion.ts';
const LEG_SWING_WALK = 0.45;
const LEG_SWING_RUN = 0.85;

export interface CallerPose {
  /** Hip rotation of the left leg, radians; the right leg mirrors it. */
  readonly leg: number;
  /** Shoulder rotation of the left arm, radians, opposite the left leg. */
  readonly arm: number;
  /** Vertical body bob, metres. */
  readonly bob: number;
  /** Forward lean, radians. */
  readonly lean: number;
}
/** A CallerPose the caller reuses across frames (the actor keeps one; the proxy owns it). */
export type MutableCallerPose = { -readonly [K in keyof CallerPose]: CallerPose[K] };

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** The figure's pose for a Caller state. Pure, so the gait reads are testable without a renderer; `out` reuses the caller's pose object. */
export function poseFor(state: Pick<CallerState, 'gait' | 'speed' | 'gaitPhase' | 'jump'>, out: MutableCallerPose = { leg: 0, arm: 0, bob: 0, lean: 0 }): CallerPose {
  if (isAirborne(state.jump)) {
    out.leg = -0.5; out.arm = -0.6; out.bob = 0; out.lean = 0.1;
    return out;
  }
  if (state.gait === 'idle' || state.speed <= 0) {
    out.leg = 0; out.arm = 0; out.bob = 0; out.lean = 0;
    return out;
  }
  const run = clamp01((state.speed - WALK_SPEED) / (RUN_SPEED - WALK_SPEED));
  const amplitude = (LEG_SWING_WALK + (LEG_SWING_RUN - LEG_SWING_WALK) * run) * clamp01(state.speed / WALK_SPEED);
  const phase = state.gaitPhase * Math.PI * 2;
  const swing = Math.sin(phase);
  out.leg = swing * amplitude;
  out.arm = -swing * amplitude * 0.8;
  // Two bobs per cycle, one per footfall.
  out.bob = Math.abs(Math.cos(phase)) * (0.02 + 0.04 * run);
  out.lean = 0.05 + 0.12 * run;
  return out;
}

type CallerStoreLike = { getState: () => CallerState };

/** Builds the proxy against any store with the Caller's shape; tests pass their own. */
export function createCallerProxyWith(store: CallerStoreLike): SceneActorFactory {
  return (threeNamespace: unknown): SceneActor => {
    const THREE = threeNamespace as Three;
    const geometries: { dispose(): void }[] = [];
    const materials: InstanceType<typeof THREE.Material>[] = [];
    const geometry = <G extends { dispose(): void }>(g: G): G => { geometries.push(g); return g; };
    const material = (color: string, roughness = 0.8) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness });
      materials.push(m);
      return m;
    };

    const jacket = material(palette.royal[600]);
    const trousers = material(palette.ink[800]);
    const mannequin = material(palette.silver[300], 0.6);
    const visor = material(palette.ink[900], 0.3);
    const shoes = material(signage.black);
    const hlynkBody = material(palette.apple[600], 0.7);
    const hlynkHead = material(signage.black, 0.4);
    const led = new THREE.MeshBasicMaterial({ color: palette.apple[500] });
    const ringMaterial = new THREE.MeshBasicMaterial({ color: palette.carolina[400], transparent: true, opacity: 0.85, depthWrite: false });
    materials.push(led, ringMaterial);

    const mesh = (g: ConstructorParameters<typeof THREE.Mesh>[0], m: InstanceType<typeof THREE.Material>, x: number, y: number, z: number) => {
      const out = new THREE.Mesh(g, m);
      out.position.set(x, y, z);
      return out;
    };

    // Root: ground position and heading. Figure: everything that leaves the ground on a jump.
    const root = new THREE.Group();
    root.name = 'caller-proxy';
    const figure = new THREE.Group();
    figure.name = 'caller-proxy:figure';
    root.add(figure);

    const ring = new THREE.Mesh(geometry(new THREE.RingGeometry(0.45, 0.6, 32)), ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    ring.name = 'caller-proxy:ring';
    root.add(ring);

    // Torso and head, on a body group that bobs and leans.
    const body = new THREE.Group();
    figure.add(body);
    const torso = mesh(geometry(new THREE.CapsuleGeometry(0.17, 0.36, 4, 12)), jacket, 0, 1.27, 0);
    torso.scale.z = 0.7;
    body.add(torso);
    body.add(mesh(geometry(new THREE.SphereGeometry(0.12, 16, 12)), mannequin, 0, 1.66, 0));
    // A dark visor on the face side so the facing reads from behind and above.
    body.add(mesh(geometry(new THREE.BoxGeometry(0.16, 0.05, 0.06)), visor, 0, 1.68, 0.1));

    // Limbs hang from pivot groups at the hips and shoulders, so a rotation.x swings them.
    const legGeometry = geometry(new THREE.CapsuleGeometry(0.075, 0.68, 4, 8));
    const shoeGeometry = geometry(new THREE.BoxGeometry(0.12, 0.08, 0.24));
    const limb = (x: number, y: number) => { const pivot = new THREE.Group(); pivot.position.set(x, y, 0); return pivot; };
    const leftLeg = limb(0.1, 0.95);
    const rightLeg = limb(-0.1, 0.95);
    for (const leg of [leftLeg, rightLeg]) {
      leg.add(mesh(legGeometry, trousers, 0, -0.43, 0));
      leg.add(mesh(shoeGeometry, shoes, 0, -0.9, 0.04));
      figure.add(leg);
    }
    const armGeometry = geometry(new THREE.CapsuleGeometry(0.05, 0.5, 4, 8));
    const handGeometry = geometry(new THREE.SphereGeometry(0.055, 10, 8));
    const leftArm = limb(0.25, 1.48);
    const rightArm = limb(-0.25, 1.48);
    for (const arm of [leftArm, rightArm]) {
      arm.add(mesh(armGeometry, jacket, 0, -0.3, 0));
      arm.add(mesh(handGeometry, mannequin, 0, -0.6, 0));
      body.add(arm);
    }
    // H-Lynk Core on the left wrist: red body, black scanner head, red LED in the head.
    leftArm.add(mesh(geometry(new THREE.BoxGeometry(0.075, 0.1, 0.06)), hlynkBody, 0.045, -0.48, 0));
    leftArm.add(mesh(geometry(new THREE.BoxGeometry(0.05, 0.035, 0.05)), hlynkHead, 0.05, -0.415, 0));
    leftArm.add(mesh(geometry(new THREE.SphereGeometry(0.01, 6, 4)), led, 0.077, -0.415, 0));

    const pose: MutableCallerPose = { leg: 0, arm: 0, bob: 0, lean: 0 };
    const apply = (state: CallerState): boolean => {
      root.visible = state.spawned;
      if (!state.spawned) return false;
      root.position.set(state.x, state.groundY, state.z);
      root.rotation.y = state.heading;
      figure.position.y = state.jump.height;
      poseFor(state, pose);
      leftLeg.rotation.x = pose.leg;
      rightLeg.rotation.x = -pose.leg;
      leftArm.rotation.x = pose.arm;
      rightArm.rotation.x = -pose.arm;
      body.position.y = pose.bob;
      body.rotation.x = pose.lean;
      return state.gait !== 'idle' || isAirborne(state.jump);
    };
    apply(store.getState());

    let disposed = false;
    return {
      id: 'caller-proxy',
      object: root,
      update: (_frame: ActorFrame) => apply(store.getState()),
      dispose: () => {
        if (disposed) return;
        disposed = true;
        root.removeFromParent();
        for (const g of geometries) g.dispose();
        for (const m of materials) m.dispose();
      },
    };
  };
}

/** The Game screen's Caller proxy, reading {@linkcode callerStore}. Pass it in the scene's `actors`. */
export const createCallerProxy: SceneActorFactory = createCallerProxyWith(callerStore);
