# Authored city surface bake

Run from the repository root:

```sh
node tooling/city/vd-port/build-surface-production.mjs --capture
```

The source checkout must be clean at Valdrada commit
`2724c7938f20e068748ad1fd66e907d2bc662e3e` in `~/src/valdrada`.
The command restores isolated Three.js 0.185.1 and earcut 3.2.3 from that
checkout's committed npm lockfile, verifies the package integrity, and leaves
application dependencies unchanged. Historical bakes used earcut 3.0.2;
their geometry hashes are historical evidence, not the source-lock baseline.

Outputs live in the ignored, persistent `apps/mobile/.expo/game-assets/`:

- `full-source-provenance.json.gz`: settled source descriptors, exact constant
  attributes and frames, and ordered Float64 geometry hashes for all structures.
- `source-payloads/`: captured source pixels, identified by their decoded SHA-256.
- `pbr-source-footprint.json`: verified immutable KTX source headers and hashes.
- `source-bank/`: original mapped images, full-resolution/full-mip ASTC PBR
  channels, and actual city AO. Lossless gzip changes disk storage only.
- `source-spool/`: backpressured source geometry batches and committed-root
  integrity records. Interrupted root tails are discarded only after the
  preceding committed bytes have been authenticated.
- `source-city/`: the immutable material registry, parameter tables, VDN3 family
  packages, manifest, exact resource dependency report, and static Metro asset
  requires in `assets.js`.
- `production-status.json` and stage logs: generation progress and failures.

The bake waits for fonts and authored bitmap replacements before capturing a
tile. It preserves original UVs, material boundaries, shader attributes,
object/instance frames, and visible alpha geometry. Unsupported source graphs,
missing resources, changed source material facts, or geometry hash differences
stop generation. Only the separately documented zero-area omissions and named
sign normal repairs are applied.

After a completed source capture, omit `--capture` to rerun the remaining
generation stages. The source stream resumes at authenticated completed roots.
After changing renderer semantics, rebuild the registry and packages together:

```sh
node tooling/city/vd-port/build-surface-production-registry.mjs
node tooling/city/vd-port/write-surface-stream.mjs
```

The generated asset module supplies bytes and metadata. Runtime admission
budgets and app registration remain scene-owned. Generation integrity checks
do not constitute native visual or performance acceptance.
