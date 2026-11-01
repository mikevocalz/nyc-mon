// The one import the Caller reads the world through. The world lane's
// queries in ../world/bundled-queries.ts answer from the same bundled tile the
// scene draws: buildings and water block, roads, sidewalks, footways, parks
// and plazas are walkable, and the ground is flat at y = 0.
export { cityGroundHeight, isWalkable } from '../world/bundled-queries.ts';
