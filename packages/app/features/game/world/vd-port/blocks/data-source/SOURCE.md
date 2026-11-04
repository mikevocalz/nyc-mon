# Authored building packs

Imported 2026-11-02 from https://github.com/mkturkcan/valdrada at commit `2724c7938f20e068748ad1fd66e907d2bc662e3e` (MIT). Dataset revision `09b583662e760b5976d636d341d0e5f81a7c7fcf` is ODbL 1.0; preserve the project attribution and dataset license.

Subpaths: authored building constructors and referenced material/texture resources captured by the versioned `tooling/city/vd-port` pipeline. Static geometry is converted to VDN3; texture pages retain source channels, dimensions and mipmaps, with native ASTC for Basis PBR inputs and gzip storage. No upstream runtime scripts are installed by this import.

The registry records source files and hashes, shader contracts, source frame transforms, and isolated bake dependencies Three 0.185.1 / earcut 3.2.3. Reproduce using `build-surface-production.mjs`, then `write-surface-assets.mjs` with `source-admission-production.json`. The generated entry and manifests authenticate on-demand payloads.
