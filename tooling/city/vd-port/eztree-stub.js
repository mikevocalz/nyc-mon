// The bake never draws Valdrada's ez-tree trees (lane C owns trees); this stands in for the optional import.
export class Tree { constructor() { throw new Error('ez-tree is not part of the vd-port bake'); } }
export default { Tree };
