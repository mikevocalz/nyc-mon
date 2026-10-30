// The storefront plan's supply. tooling/city/bake-vd-storefronts.mjs writes the plan as JSON bytes in plan.bin, a
// Metro asset (and a static file on web), not a TS module: with rings 1-10 it is 37 MB of JSON, and as a module it went
// through every bundler and type pass in the repo (Turbopack's loaders on web, Metro on native). It is read once while
// the game scene loads (load-game-scene.ts), next to the block packs: buildCityWorld is synchronous, so the plan must be
// here before it runs; without it lane B draws nothing and says so.
import type { StorefrontPlan } from './plan-types.ts';

let plan: StorefrontPlan | null = null;
let pending: Promise<StorefrontPlan | null> | null = null;

/** The preloaded plan, or null when preloadVdStorefrontPlan has not finished (or failed). */
export function vdStorefrontPlan(): StorefrontPlan | null {
  return plan;
}

/** Tests and tools hand the plan in directly (read from plan.bin on disk). */
export function setVdStorefrontPlan(value: StorefrontPlan | null): void {
  plan = value;
}

/** plan.bin's bytes (UTF-8 JSON) to the plan. */
export function decodeStorefrontPlan(bytes: Uint8Array | ArrayBuffer): StorefrontPlan {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return JSON.parse(new TextDecoder().decode(u8)) as StorefrontPlan;
}

/**
 * Reads plan.bin through the platform asset loader. Resolves null (and logs) on failure: the world then builds
 * without lane B's storefronts.
 */
export function preloadVdStorefrontPlan(): Promise<StorefrontPlan | null> {
  if (plan) return Promise.resolve(plan);
  pending ??= (async () => {
    try {
      const [{ VD_STOREFRONT_PLAN_ASSET }, { fetchAssetBytes }] = await Promise.all([
        import('./plan-asset.ts'),
        import('@acme/ui/three/asset-bytes'),
      ]);
      const bytes = await fetchAssetBytes(VD_STOREFRONT_PLAN_ASSET);
      if (!bytes) throw new Error('vd-port: plan.bin produced no bytes');
      plan = decodeStorefrontPlan(bytes);
      return plan;
    } catch (cause) {
      console.warn('[vd-port] the storefront plan did not load; lane B draws no storefronts', cause);
      return null;
    } finally {
      pending = null;
    }
  })();
  return pending;
}
