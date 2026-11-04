# Exact legacy-shell collision data

Generated from the committed Valdrada block shell packs by `tooling/city/vd-port/build-shell-collision.mjs`. Original geometry provenance/licenses remain in each block manifest. Every ring shell SHA-256, source cell frame/bounds/range and producer source hash is recorded in manifest.ts. The original native triangle acceptance and BVH builder are used without simplification. Each gzip member stores owned Float32 coordinates, source triangle IDs, order, AABBs and tree nodes.

Production region: `[-892,-1,-892,892,24,892]`. Runtime preload authenticates the complete compressed bank and original shell bytes; a mismatched frame, source, or coverage region is rejected. Scene disposal releases decoded data.

Generation is asset production; native startup/performance and query regression verification remain deferred until implementation is complete.
