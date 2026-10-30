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

/** True for gzip bytes (the website's plan.bin.gz): the 1f 8b magic. */
export function isGzip(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

/**
 * Inflates gzip bytes with the platform's DecompressionStream (browsers and Node 18+); other bytes pass through, so a
 * host that already decoded the transfer, or native's plain plan.bin, needs no branch at the call site.
 */
export async function inflatePlanBytes(input: Uint8Array | ArrayBuffer): Promise<Uint8Array> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (!isGzip(bytes)) return bytes;
  const Stream = (globalThis as { DecompressionStream?: typeof DecompressionStream }).DecompressionStream;
  if (!Stream) throw new Error('vd-port: plan.bin.gz needs DecompressionStream, which this runtime lacks');
  const body = new Blob([bytes as BlobPart]).stream().pipeThrough(new Stream('gzip'));
  return new Uint8Array(await new Response(body).arrayBuffer());
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
        // Extensionless on purpose: Turbopack then picks plan-asset.web.ts (the gzip copy) and Metro plan-asset.ts. An
        // explicit './plan-asset.ts' resolves that exact file on every bundler and the web would fetch 37 MB raw.
        import('./plan-asset'),
        import('@acme/ui/three/asset-bytes'),
      ]);
      const bytes = await fetchAssetBytes(VD_STOREFRONT_PLAN_ASSET);
      if (!bytes) throw new Error('vd-port: plan.bin produced no bytes');
      plan = decodeStorefrontPlan(await inflatePlanBytes(bytes));
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
