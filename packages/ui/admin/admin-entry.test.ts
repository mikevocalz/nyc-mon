// The console entry must never reach Skia, three.js or WebGPU (04-components.md
// G19, 08-handoff.md P3). This walks the import graph of admin/index.ts the way
// the web bundlers resolve it (`.web.*` first, then the plain file, then
// index.*) and fails on any forbidden bare specifier. Type-only imports are
// skipped because they never reach a bundle. Dynamic `import()` is followed:
// a lazy chunk still ships in the build.
//
// Bare packages are not walked into, so the forbidden list also names the
// packages that wrap Skia or WebGPU themselves (react-native-graph).
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const uiRoot = resolve(here, '..');

const WEB_EXTENSIONS = ['.web.tsx', '.web.ts', '.web.jsx', '.web.js'];
const EXTENSIONS = [...WEB_EXTENSIONS, '.tsx', '.ts', '.jsx', '.js', '.json'];
const SOURCE = /\.(tsx?|jsx?)$/;

const FORBIDDEN = [
  /^@shopify\/react-native-skia(\/|$)/,
  /^react-native-skia(\/|$)/,
  /^canvaskit-wasm(\/|$)/,
  /^three(\/|$)/,
  /^@react-three\//,
  /^typegpu(\/|$)/,
  /^@typegpu\//,
  /^unplugin-typegpu(\/|$)/,
  /^react-native-webgpu(\/|$)/,
  /^@webgpu\//,
  /^react-native-graph(\/|$)/,
];

const IMPORT =
  /(?:^|[\s;{}])(?:import|export)\s+(type\s+)?(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;

function isFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile();
}

/** Resolves a relative specifier with web-first extension order. */
function resolveRelative(fromFile: string, specifier: string): string | undefined {
  const base = resolve(dirname(fromFile), specifier);
  if (isFile(base) && !SOURCE.test(base)) return base;
  const stem = base.replace(SOURCE, '');
  for (const extension of EXTENSIONS) {
    if (isFile(stem + extension)) return stem + extension;
  }
  for (const extension of EXTENSIONS) {
    const index = resolve(base, `index${extension}`);
    if (isFile(index)) return index;
  }
  return undefined;
}

interface Finding {
  specifier: string;
  importer: string;
}

interface Graph {
  files: Set<string>;
  bare: Set<string>;
  forbidden: Finding[];
  unresolved: Finding[];
}

function walk(entry: string): Graph {
  const graph: Graph = { files: new Set(), bare: new Set(), forbidden: [], unresolved: [] };
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop();
    if (file === undefined || graph.files.has(file)) continue;
    graph.files.add(file);
    if (!SOURCE.test(file)) continue;
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(IMPORT)) {
      if (match[1] !== undefined) continue;
      const specifier = match[2] ?? match[3] ?? match[4];
      if (specifier === undefined) continue;
      const importer = relative(uiRoot, file);
      if (specifier.startsWith('.')) {
        const target = resolveRelative(file, specifier);
        if (target === undefined) graph.unresolved.push({ specifier, importer });
        else queue.push(target);
        continue;
      }
      graph.bare.add(specifier);
      if (FORBIDDEN.some((pattern) => pattern.test(specifier))) {
        graph.forbidden.push({ specifier, importer });
      }
    }
  }
  return graph;
}

test('@acme/ui/admin reaches no Skia, three.js or WebGPU module', () => {
  const graph = walk(resolve(here, 'index.ts'));
  assert.ok(graph.files.size > 20, `walked only ${graph.files.size} files; the walker is broken`);
  assert.deepEqual(graph.forbidden, []);
});

test('@acme/ui/admin never imports the root @acme/ui barrel', () => {
  const graph = walk(resolve(here, 'index.ts'));
  const selfImports = [...graph.bare].filter((specifier) => specifier === '@acme/ui');
  assert.deepEqual(selfImports, []);
});

test('every relative import in @acme/ui/admin resolves', () => {
  assert.deepEqual(walk(resolve(here, 'index.ts')).unresolved, []);
});

test('the walker does see Skia and three.js through the root barrel', () => {
  // Guards against a walker that silently stops following imports.
  const specifiers = walk(resolve(uiRoot, 'index.ts')).forbidden.map((finding) => finding.specifier);
  assert.ok(specifiers.some((specifier) => specifier.startsWith('react-native-skia')));
  assert.ok(specifiers.some((specifier) => specifier === 'three' || specifier.startsWith('three/')));
});
