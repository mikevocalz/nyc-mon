// A static server that runs Valdrada's own client modules (github.com/mkturkcan/valdrada @ 2724c79, MIT) in a headless
// page, for the vd-port bake (bake.mjs). Nothing here reimplements Valdrada: it serves its files unchanged except for
// two instrumentation splices, listed in PATCHES, that tag which part built which mesh.
//
// Layout served:
//   /src/...        client/src (Valdrada's modules)
//   /data, /fonts, ... client/public (its runtime data)
//   /tiles/...      the pinned tiles (tooling/city/.cache/valdrada, fetched by tooling/city/valdrada/fetch.mjs)
//   /textures/...   the PBR sets the facade kit loads (tooling/city/.cache/valdrada-textures, fetched by fetch-textures.mjs)
//   /node/three/... three 0.185.1, the version Valdrada pins (client/package.json), so the bake's geometry is its own
//   /node/earcut/... earcut 3.0.2
//   /harness.html, /harness.js  the page (harness.js beside this file)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.bin': 'application/octet-stream',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.ktx2': 'image/ktx2', '.wasm': 'application/wasm' };

// Splices: [file suffix, find, replace]. Each must match exactly once or the server refuses to start the page.
export const PATCHES = [
  // city/areas.js areaBuild: each part builds into its own named sub-group, so the bake knows whose meshes are whose.
  ['/src/city/areas.js',
    'try { const r = P.m.build(group, ctx);',
    'try { const __sub = new group.constructor(); __sub.name = "vdpart:" + P.name; group.add(__sub); const r = P.m.build(__sub, ctx);'],
  // city/areas.js areaBuild: keep each tile's build context, so the bake can rebuild one facade-kit spec at a time.
  ['/src/city/areas.js',
    'export async function areaBuild(group, ctx) {',
    'export async function areaBuild(group, ctx) {\n  (globalThis.__vdAreaCtx ||= {})[ctx.key] = ctx;'],
];

export function startServer({ valdrada = join(homedir(), 'src/valdrada'), cache, deps, overlay, port = 0 } = {}) {
  const roots = [
    ['/src/', join(valdrada, 'client/src/')],
    ['/tiles/', join(cache, 'valdrada/')],
    ['/textures/', join(cache, 'valdrada-textures/')],
    ['/node/three/', join(deps, 'three/')],
    ['/node/earcut/', join(deps, 'earcut/')],
    ...(overlay ? [['/', overlay]] : []),
    ['/', join(valdrada, 'client/public/')],
  ];
  const server = createServer(async (req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    try {
      if (url === '/harness.html' || url === '/harness.js' || url === '/eztree-stub.js' || url === '/harvest.js' || url === '/far-bake.html') {
        res.writeHead(200, { 'content-type': TYPES[extname(url)] });
        res.end(await readFile(join(HERE, url.slice(1))));
        return;
      }
      let file = null;
      for (const [prefix, dir] of roots.filter(([p]) => url.startsWith(p))) {
        const candidate = normalize(join(dir, url.slice(prefix.length)));
        if (!candidate.startsWith(dir)) continue;
        try { await stat(candidate); file = candidate; break; } catch { /* try the next root */ }
      }
      if (!file) throw new Error('not found');
      let body = await readFile(file);
      for (const [suffix, find, replace] of PATCHES) {
        if (!url.endsWith(suffix)) continue;
        const text = body.toString('utf8');
        const n = text.split(find).length - 1;
        if (n !== 1) throw new Error(`patch for ${suffix} matched ${n} times`);
        body = Buffer.from(text.replace(find, replace));
      }
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch (e) {
      res.writeHead(404); res.end(String(e.message));
    }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}
