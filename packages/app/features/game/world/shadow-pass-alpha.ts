// three r186 renders every shadow caster through one shared override material
// (ShadowBaseNode's ShadowMaterial) and copies each caster's alphaTest onto it
// before the draw (Renderer._renderObjectDirect). Material's alphaTest setter
// bumps `version` whenever the value crosses zero, and a bumped version makes
// every render object using the material recompute its full cache key
// (RenderObject.getCacheKey: material key, node children, a hash) on its next
// draw. The city has both kinds of caster: seven alpha-tested ones (vd tree
// leaves near/mid/far, trees-near, landmark and sign lettering, the facelift)
// among ~55, so the override flips across zero many times per cascade and all
// ~109 shadow render objects re-keyed every frame. Measured in node (V8, the
// recording device, 48 moving cars): 27 % of all samples, frame JS p50 2.97 ms
// to 1.16-1.30 ms with the bump skipped, no new pipelines or bind groups.
//
// Skipping the bump on the shadow-pass material is safe because each render
// object's own alphaTest never changes: it is copied from its caster's
// material, and no caster changes its alphaTest after creation. A render
// object built while the override held 0.5 keyed on 0.5 and keeps that key.
//
// This belongs in patches/three@0.186.1.patch (Renderer: assign
// `overrideMaterial._alphaTest` for a shadow-pass material). It lives here
// until that patch can be re-applied with an install; the install is
// idempotent, applies to three r186 only, and is pinned by
// shadow-pass-alpha.test.ts.
import type { Three } from '@acme/ui/three';

const INSTALLED = Symbol.for('nyc-mon.shadowPassAlphaTest');

/** Whether this three is the one the bypass was measured against. */
export function shadowPassAlphaApplies(THREE: Pick<Three, 'REVISION'>): boolean {
  return THREE.REVISION === '186';
}

/** Makes alphaTest on a shadow-pass material a plain store (see the header). Returns whether it is installed. */
export function installShadowPassAlphaTest(THREE: Three): boolean {
  if (!shadowPassAlphaApplies(THREE)) return false;
  const proto = THREE.Material.prototype as unknown as Record<PropertyKey, unknown>;
  if (proto[INSTALLED] === true) return true;
  const base = Object.getOwnPropertyDescriptor(THREE.Material.prototype, 'alphaTest');
  if (!base?.get || !base.set) return false;
  const { get, set } = base;
  Object.defineProperty(THREE.Material.prototype, 'alphaTest', {
    configurable: true,
    enumerable: base.enumerable ?? false,
    get,
    set(this: { isShadowPassMaterial?: boolean; _alphaTest: number }, value: number) {
      if (this.isShadowPassMaterial === true) this._alphaTest = value;
      else set.call(this, value);
    },
  });
  Object.defineProperty(proto, INSTALLED, { value: true, configurable: true });
  return true;
}
