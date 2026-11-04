# Watch Mon assets

These are Watch-specific derivatives of NYC-MON's approved Mon models, not replacement game assets.

- Squeaklet: https://admin.nyc-mon.city/v1/mon-models/glb/dex-002
- Lil’ Ratti: https://admin.nyc-mon.city/v1/mon-models/glb/dex-003
- Imported: November 2, 2026.
- Source rights/license: existing NYC-MON character assets; no new third-party license is asserted.
- Conversion: installed Blender 5.2.3, through the running Blender MCP server. `tooling/export-watch-mons.py` is the reviewed conversion script.
- Copied/exported subpaths: `squeaklet.usdz`, `lil-ratti.usdz`; exact source/output SHA-256, mesh/triangle counts, texture sizes and bytes are in `validation.json`.

Each derivative contains a baked authored pose, approximately 60,000 triangles and 512px textures. Source GLBs and rigs are untouched. USD exports use Y up and negative Z forward. SceneKit loads with `convertToYUp`, normalizes the model bounds and frames a single Mon. The Watch adds a small breathing motion; this is not the source rig's full animation set. Reduced Motion, wrist-down and background states pause it.

Native SceneKit on macOS successfully loaded and rendered both exports with textures. This establishes format and framing checks, not Apple Watch performance or visual acceptance. Watch device builds compile both standard device architectures. Physical paired-device verification remains separate.
