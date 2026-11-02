# Authored Mon regression fixtures

These immutable historical GLBs are test inputs, not runtime assets. Production
Mon models remain served through Payload's `/v1/mon-models/glb/:species` route.
Do not import these files into application code, copy them into a public folder,
or replace the tests with a network fetch of the current mutable CDN model.

Source: `mikevocalz/nyc-mon`, commit
`7a954003b3b129e5cfbb26b3e87c1b8585c29149`, immediately before production
bundled copies were removed in `55cb1b971b548dcb90bcd0fa0dd12863bae06a5d`.

| Fixture | Original path | Git blob SHA |
| --- | --- | --- |
| `lil-ratti.glb` | `apps/web/public/mons/lil-ratti.glb` | `da27e0b0451985bf91255a5d24c05f9aeb66790a` |
| `squeaklet.glb` | `apps/web/public/mons/squeaklet.glb` | `eeee7451fd81e201c838f00d06b10af47e04437f` |

The tests intentionally preserve the authored animation jitter, morph seam,
skinning, quantization, framing and clip-name inputs. Those exact inputs are
required to prove the fixes rather than silently changing their expectations.
The blob objects are reused unchanged; no replacement artwork was generated.

The bundled hatch-sequence eggs remain under `packages/assets/eggs`.
Tests use `packages/assets/eggs/metro-egg/metro-egg-hatch.glb` directly for
Metro Egg: its blob is `70f3d08125e96e0dc4f5ede2aac85f60d5584bcb`, identical
to the removed public copy, so no duplicate fixture is needed.
