// Runs Valdrada's own browser modules under Node for the vd-port bakes (lane C: street furniture, props, roof plant,
// elevated structures). Nothing here re-implements Valdrada: it loads client/src as shipped at 2724c79 (MIT,
// tooling/city/valdrada/LICENSE.valdrada) and gives it the four browser services it asks for on a default load:
//
//   module resolution  `three` from packages/app (nyc-mon's 0.186.1; Valdrada pins ^0.185.1, no API it uses differs),
//                      `earcut` from the tools directory below
//   canvas             @napi-rs/canvas for document.createElement('canvas'), ImageData and Path2D, so every canvas
//                      texture Valdrada paints is painted by Valdrada's own code
//   fetch              client/public/<url> from the Valdrada checkout, tiles/<id>.bin from the pinned tile cache
//                      (tooling/city/valdrada/fetch.mjs); a file that is not there answers 404, as the dev server does
//   location/window    an empty query string, so every `?flag` takes its default
//
// The canvas and earcut packages live OUTSIDE the repo (VD_TOOLS, default: the session scratch tools dir) and are not
// dependencies of nyc-mon: `npm i @napi-rs/canvas earcut` there once.
import { registerHooks, createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = join(HERE, '../../..');
export const VALDRADA = process.env.VALDRADA ?? join(homedir(), 'src/valdrada');
export const TILE_CACHE = join(HERE, '../.cache/valdrada');
const TOOLS = process.env.VD_TOOLS;
if (!TOOLS || !existsSync(join(TOOLS, 'package.json'))) {
  throw new Error('Set VD_TOOLS to a directory with @napi-rs/canvas and earcut installed (npm i @napi-rs/canvas earcut)');
}

const BASES = [join(REPO, 'packages/app/package.json'), join(TOOLS, 'package.json')].map((p) => pathToFileURL(p).href);
registerHooks({
  resolve(spec, ctx, next) {
    if (/^[./]|^[a-z]+:/.test(spec)) return next(spec, ctx);
    try { return next(spec, ctx); } catch { /* a bare specifier Valdrada's own tree would resolve: try ours */ }
    for (const parentURL of BASES) { try { return next(spec, { ...ctx, parentURL }); } catch { /* next base */ } }
    throw new Error(`vd-port: cannot resolve ${spec}`);
  },
});

const req = createRequire(join(TOOLS, 'package.json'));
const canvas = req('@napi-rs/canvas');
globalThis.ImageData = canvas.ImageData;
globalThis.Path2D = canvas.Path2D;
globalThis.location = { search: '', href: 'http://localhost/', hostname: 'localhost', pathname: '/' };
globalThis.window = globalThis;
globalThis.document = {
  createElement: (tag) => (tag === 'canvas' ? canvas.createCanvas(1, 1) : {}),
  fonts: null,
};
// Valdrada's AR33 sign fonts ship in client/public/fonts; register the TTFs so text is set in the faces it names.
for (const [file, family] of [['fonts/ar33/BarlowCondensed-SemiBold.ttf', 'pkSignC'], ['fonts/ar33/BarlowCondensed-Bold.ttf', 'pkSignC']]) {
  const p = join(VALDRADA, 'client/public', file);
  if (existsSync(p)) canvas.GlobalFonts.registerFromPath(p, family);
}

const response = (p) => {
  if (!p || !existsSync(p)) return { ok: false, status: 404, headers: { get: () => '' }, json: async () => null, arrayBuffer: async () => null, text: async () => '' };
  const b = readFileSync(p);
  return {
    ok: true, status: 200,
    headers: { get: () => (p.endsWith('.json') ? 'application/json' : 'application/octet-stream') },
    json: async () => JSON.parse(b.toString()),
    arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    text: async () => b.toString(),
  };
};
globalThis.fetch = async (url) => {
  const u = String(url);
  if (/^tiles\/[^/]+\.bin$/.test(u)) return response(join(TILE_CACHE, u.split('/').pop()));
  if (/^[a-z]+:/.test(u)) return response(null);
  return response(join(VALDRADA, 'client/public', u.replace(/^\.?\//, '')));
};

export const THREE = await import('three');

// Every object Valdrada adds to a group is tagged with the client/src file that added it (the first three frames), so a
// bake can take one part's output (pk/props.js, vk/*.js, ...) out of a tile group without guessing from names.
const add = THREE.Object3D.prototype.add;
THREE.Object3D.prototype.add = function tagAdd(...objs) {
  const frames = new Error().stack.split('\n').slice(2)
    .map((l) => (l.match(/valdrada\/client\/src\/([^:]+):\d+/) || [])[1]).filter(Boolean);
  for (const o of objs) if (o && o.userData && !o.userData.vdSrc) o.userData.vdSrc = frames.slice(0, 3).join('<');
  return add.apply(this, objs);
};

export const vd = (rel) => import(pathToFileURL(join(VALDRADA, 'client/src', rel)).href);

/** Valdrada's tile bytes for `t_<x>_<z>`, as an ArrayBuffer. */
export function tileBytes(id) {
  const b = readFileSync(join(TILE_CACHE, `${id}.bin`));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}
