// Tests and harnesses build the scene without load-game-scene.ts, so the storefront plan is read here from the file
// the bake wrote (plan.bin, committed).
import { readFileSync } from 'node:fs';
import type { StorefrontPlan } from './plan-types.ts';
import { decodeStorefrontPlan, setVdStorefrontPlan } from './load.ts';

let cached: StorefrontPlan | null = null;

/** The plan as plan.bin holds it, read once per process. */
export function readVdStorefrontPlanFromDisk(): StorefrontPlan {
  cached ??= decodeStorefrontPlan(new Uint8Array(readFileSync(new URL('./plan.bin', import.meta.url))));
  return cached;
}

/** Reads plan.bin and hands it to load.ts, as preloadVdStorefrontPlan does in the app. */
export function loadVdStorefrontPlanFromDisk(): StorefrontPlan {
  const plan = readVdStorefrontPlanFromDisk();
  setVdStorefrontPlan(plan);
  return plan;
}
