// The seam between the city world (city-scene.ts and world/**) and anything
// that lives and moves in it (the Caller's character first). The world adds
// every actor's object to its scene once and calls update() before each
// render; an actor never reaches into the world's meshes, and the world never
// reads an actor's state. Pure types: no three.js import here, so both sides
// and node tests can depend on it.

/** What one frame hands every actor: seconds since the last frame (clamped by the canvas) and whether motion is reduced. */
export interface ActorFrame {
  readonly delta: number;
  readonly time: number;
  readonly reducedMotion: boolean;
}

/**
 * A thing in the world. `object` is a three.js Object3D created with the
 * world's own THREE instance (passed to `create`), typed as unknown here so
 * this file stays free of three.
 */
export interface SceneActor {
  readonly id: string;
  readonly object: unknown;
  /** Advance one frame. Return true while the actor is still moving, so an on-demand canvas keeps drawing. */
  update(frame: ActorFrame): boolean;
  dispose(): void;
}

/** Builds an actor against the world's THREE namespace once the scene exists. */
export type SceneActorFactory = (THREE: unknown) => SceneActor;
