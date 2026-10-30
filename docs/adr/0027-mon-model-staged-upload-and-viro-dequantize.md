# 0027 — Mon model uploads over 4.5 MB, and quantized GLBs in the Viro preview

- **Status:** Accepted
- **Date:** 2026-10-30
- **Deciders:** Mike
- **Code:** `packages/payload/src/storage/stagedUpload.ts`, `packages/payload/src/admin/console/endpoints/models.ts`, `packages/payload/src/admin/console/views/modelUpload.ts`, `packages/spatial/glbDequantize.ts`, `packages/spatial/MonModelViewer.tsx`. Tests: `packages/payload/src/admin/console/__tests__/modelUpload.test.ts`, `packages/spatial/glbDequantize.test.ts`.

## 1. Uploads over 4.5 MB

### Context

The console sent a model as one multipart `POST /payload-api/mon-models`. Vercel refuses a function request body over 4.5 MB with a 413 before Payload runs, so `corner-egg-hatch.glb` (4,998,988 bytes) failed, and Squeaklet (19.3 MB) and Lil' Ratti (23.7 MB) could never go up, although the console allows 25 MiB. Bunny Storage has no presigned URLs, and its AccessKey must not reach the browser.

Options considered:

- **(a) Vercel Blob client upload, then a server copy to Bunny.** Needs a Blob store connected to `nyc-mon-admin` and its `BLOB_*` variables. Neither exists (checked 2026-10-30 with the Vercel env listing). Creating them is a production config change, and every model would be stored twice for a moment.
- **(b) A Bunny Edge Script that accepts an HMAC-signed PUT.** Needs a script deployed on Bunny and a shared secret kept in sync in two dashboards. A second runtime to own for one form.
- **(c) Chunks through the function, staged on Bunny.** No new infrastructure or secrets.

### Decision

Option (c). Files up to 4 MiB keep the single multipart request. Larger files:

1. `POST /payload-api/console/models/uploads { name, size }`. The server applies the `.glb` and 25 MiB rules and returns a token signed with the Payload secret that binds the upload to the staff user, the byte size and a one-hour expiry.
2. `PUT /payload-api/console/models/uploads/:token/:index` with each 4 MiB chunk as a raw body. The server checks the index, the exact length and, on chunk 0, the GLB header, then writes the chunk to `_staging/mon-models/<nonce>/<index>` on Bunny Storage from the server.
3. `POST /payload-api/console/models/uploads/:token/complete { id }` (replace) or `{ speciesId }` (add). The server reads the chunks back, joins them, checks the total against the signed size and calls the Local API `create` or `update` with `file` and `overrideAccess: false`. The collection hooks run unchanged: `readGlb` sets the filename, height, clips, morphs and `in-review` status, and the Bunny hook stores the file and writes `bunnyUrl`. The staging folder is deleted whether the save succeeds or fails.
4. If a chunk fails, the browser calls `DELETE /payload-api/console/models/uploads/:token` to drop the staged parts.

Endpoints accept the same roles as the collection's create and update access (`ops`, `content`).

### Consequences

- The function never sees more than 4 MiB of body. A 25 MiB file is seven chunks plus the start and complete calls.
- A browser closed mid-upload leaves at most 25 MiB under `_staging/mon-models/` until someone deletes it. The folder is safe to clear at any time.
- If Vercel Blob is connected later, option (a) can replace the chunk step without changing step 3.

## 2. Quantized GLBs render blank in the Viro preview

### Context

On `/admin/models/dex-001` the Viro web renderer logged the default scene as loaded and the GLB fetched with a 200, but the canvas was empty. Dropping the same Metro egg into the preview twice, once as shipped and once after `gltf-transform dequantize`, showed the cause: the float copy draws a red egg, the original draws nothing. Same page, camera and lights.

The hatch eggs and the rigged Mons are written with `KHR_mesh_quantization` (`tooling/blender/hatching/compress.sh`). virocore's loader, which the web wasm and native Viro share, binds every non-float vertex attribute as an unnormalized unsigned integer: `VROGeometrySubstrateOpenGL::configureVertexDescriptor` marks only colour attributes normalized, `parseVertexFormat` maps every 2-byte type to `GL_UNSIGNED_SHORT`, and `createVAO` binds them with `glVertexAttribIPointer`. A signed normalized int16 POSITION never reaches the shader as metres.

The files are valid glTF. three.js, which the game uses for eggs and Mons, reads them correctly, and quantization keeps phone downloads small.

### Decision

Leave the shipped files quantized. `MonModelViewer` fetches the GLB, and when it declares `KHR_mesh_quantization`, `dequantizeGlb` rewrites the quantized vertex, morph target and animation accessors as float32 (sparse accessors are expanded) and drops the extension. Node transforms, which carry the quantization scale, stay as they are. Viro loads the float copy from a `blob:` URL that is revoked when the file changes.

### Consequences

- The preview costs one extra read of the file in the browser and about 1.8 times its size in memory while it is shown.
- Viro still cannot draw quantized meshes anywhere else. If a Viro scene in the game ever loads these files, it needs the same step, or virocore needs to honour `accessor.normalized` and signed component types.
