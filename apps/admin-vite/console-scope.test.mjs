// Proves src/console.css cannot style anything outside `.nycmon-console`
// (08-handoff.md P2). Runs the real PostCSS pipeline from postcss.config.mjs
// over the real sheet, then checks every rule it emits. The browser half of
// the proof (Payload pages with and without the sheet compute identical
// styles) is in the X3 report.
import assert from 'node:assert/strict';
import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import postcssConfig from './postcss.config.mjs';
import { CONSOLE_LAYER, CONSOLE_ROOT, scopeSelector } from './console-scope.postcss.mjs';

const here = dirname(fileURLToPath(import.meta.url));
// postcss is a dependency of @tailwindcss/postcss, not of this app.
const postcss = createRequire(realpathSync(resolve(here, 'node_modules/@tailwindcss/postcss/package.json')))(
  'postcss',
);

async function build(file, css = readFileSync(file, 'utf8')) {
  return postcss(postcssConfig.plugins).process(css, { from: file });
}

const consoleSheet = resolve(here, 'src/console.css');
const GLOBAL_AT_RULES = new Set(['property', 'font-face', 'keyframes']);

function inKeyframes(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === 'atrule' && /keyframes$/.test(parent.name)) return true;
  }
  return false;
}

test('every rule in the console sheet matches only inside .nycmon-console', async () => {
  const { root } = await build(consoleSheet);
  const leaks = [];
  let rules = 0;
  root.walkRules((rule) => {
    if (inKeyframes(rule)) return;
    rules += 1;
    for (const selector of rule.selectors) {
      if (!selector.includes(CONSOLE_ROOT)) leaks.push(selector);
    }
  });
  assert.ok(rules > 500, `only ${rules} rules; Tailwind did not scan the kit`);
  assert.deepEqual(leaks, []);
});

test('the console sheet declares no custom property on :root, html or [data-theme]', async () => {
  const { root } = await build(consoleSheet);
  const offenders = [];
  root.walkDecls(/^--/, (decl) => {
    const rule = decl.parent;
    if (rule.type !== 'rule') return;
    if (rule.selectors.some((selector) => /^(:root|html|:host|\[data-theme)/.test(selector.trim()) && !selector.includes(CONSOLE_ROOT))) {
      offenders.push(`${rule.selector} { ${decl.prop} }`);
    }
  });
  assert.deepEqual(offenders, []);
});

test('everything but @property, @font-face and @keyframes sits in the console layer, after payload-default', async () => {
  const { root } = await build(consoleSheet);
  const first = root.nodes.find((node) => node.type !== 'comment');
  assert.equal(first.type, 'atrule');
  assert.equal(`@${first.name} ${first.params}`, `@layer payload-default, ${CONSOLE_LAYER}`);
  const outside = root.nodes.filter(
    (node) =>
      node !== first &&
      node.type !== 'comment' &&
      !(node.type === 'atrule' && (GLOBAL_AT_RULES.has(node.name) || (node.name === 'layer' && node.params === CONSOLE_LAYER))),
  );
  assert.deepEqual(outside.map((node) => node.toString().slice(0, 80)), []);
});

test('the kit tokens and a kit utility reach the console root', async () => {
  const { css } = await build(consoleSheet);
  assert.match(css, /\.nycmon-console \{[^}]*--color-text: light-dark\(/);
  assert.match(css, /\.bg-ink-950:where\(\.nycmon-console, \.nycmon-console \*\) \{/);
  assert.match(css, /:root\[data-theme='dark'\] \.nycmon-console \{\s*color-scheme: dark;/);
});

test('a sheet other than src/console.css passes through unscoped', async () => {
  const css = ':root { --color-text: red; } h1 { margin: 0; }';
  const { css: out } = await build(resolve(here, 'node_modules/@payloadcms/ui/dist/styles.css'), css);
  assert.equal(out, css);
});

test('scopeSelector rewrites each selector shape', () => {
  assert.deepEqual(scopeSelector(':root'), [CONSOLE_ROOT]);
  assert.deepEqual(scopeSelector('html, :host'), [CONSOLE_ROOT]);
  assert.deepEqual(scopeSelector("[data-theme='dark']"), [`:root[data-theme='dark'] ${CONSOLE_ROOT}`]);
  assert.deepEqual(scopeSelector('*'), [CONSOLE_ROOT, `${CONSOLE_ROOT} *`]);
  assert.deepEqual(scopeSelector('::backdrop'), [`${CONSOLE_ROOT}::backdrop`, `${CONSOLE_ROOT} *::backdrop`]);
  assert.deepEqual(scopeSelector('h1'), [`h1:where(${CONSOLE_ROOT}, ${CONSOLE_ROOT} *)`]);
  assert.deepEqual(scopeSelector('.placeholder\\:x::placeholder'), [
    `.placeholder\\:x:where(${CONSOLE_ROOT}, ${CONSOLE_ROOT} *)::placeholder`,
  ]);
  assert.deepEqual(scopeSelector('.a\\:\\:b'), [`.a\\:\\:b:where(${CONSOLE_ROOT}, ${CONSOLE_ROOT} *)`]);
});
