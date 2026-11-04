import type { Node, NodeMaterial } from 'three/webgpu';

const installed = new WeakSet<NodeMaterial>();

/**
 * Source normal gameplay: engine.js ScenePrePass (270–290) draws a regular half-float RT.
 * Three 0.185.1 WebGLRenderer (2342, 2351–2359) therefore uses working color space and
 * NoToneMapping; OutputPass runs later (engine.js 1612). signKit's pre-fog EASE is
 * consequently linear HDR, despite following the identity tone/color shader chunks.
 * NodeMaterial.outputNode would run AFTER fog. Wrap setupOutput instead, before its
 * fog/premultiplication, and leave our common post's single output transform intact.
 */
export function installSourceOutputHook(
  material: NodeMaterial,
  hook: (linearHdr: Node<'vec4'>) => Node<'vec4'>,
): void {
  if (installed.has(material)) throw new Error(`${material.name}: authored output hook already installed`);
  installed.add(material);
  const setupOutput = material.setupOutput;
  material.setupOutput = function (builder, output) {
    return setupOutput.call(this, builder, hook(output as Node<'vec4'>));
  };
}
