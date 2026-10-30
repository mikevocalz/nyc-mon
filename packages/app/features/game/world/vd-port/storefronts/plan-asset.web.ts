// Web fork of plan-asset.ts (Turbopack resolves .web.ts first; Metro never loads it). The website fetches the gzip copy
// of the plan, 6.0 MB instead of 37.3 MB: a static .bin goes out as application/octet-stream, which is served as is,
// uncompressed. storefronts/load.ts inflates it with DecompressionStream. tooling/city/bake-vd-storefronts.mjs writes
// plan.bin.gz next to plan.bin, and plan-gzip.test.ts fails when the two drift.
/* eslint-disable @typescript-eslint/no-require-imports */
export const VD_STOREFRONT_PLAN_ASSET: number = require('./plan.bin.gz');
