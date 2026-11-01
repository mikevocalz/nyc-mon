// Keeps src/editor.css on the console's palette. The editor sheet sets
// Payload's own custom properties to literal values (the @acme/theme names
// collide with Payload's, see the sheet's header), so this test is what ties
// those literals to packages/theme/tokens.ts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { palette, semantic } from '../../packages/theme/tokens.ts';

const here = dirname(fileURLToPath(import.meta.url));
const sheet = readFileSync(resolve(here, 'src/editor.css'), 'utf8');

/** `--name: value` pairs of the first block whose selector is exactly `selector`. */
function block(selector) {
  const start = sheet.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `editor.css has no ${selector} block`);
  const body = sheet.slice(start, sheet.indexOf('\n  }', start));
  return new Map([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));
}

const schemes = { light: block(':root'), dark: block("html[data-theme='dark']") };
const upper = (value) => value.toUpperCase();

// The roles a reader of the editor sees first, pinned to the console token.
const roles = {
  '--color-bg': 'bg',
  '--color-bg-elevated': 'surface-raised',
  '--color-bg-secondary': 'surface-sunken',
  '--color-text': 'text',
  '--color-text-secondary': 'text-secondary',
  '--color-border': 'border',
  '--special-border-translucent': 'text-muted',
  '--console-cta': 'cta',
  '--console-cta-pressed': 'cta-pressed',
  '--console-on-cta': 'on-cta',
  '--color-bg-brand': 'accent',
  '--color-bg-brand-hover': 'accent-pressed',
  '--color-text-onbrand': 'on-accent',
  '--color-text-brand': 'accent-pressed',
  '--color-bg-selected-strong': 'accent',
  '--color-text-onselected-strong': 'on-accent',
  '--accessibility-focus-color': 'focus',
  '--field-color-border-focus': 'focus',
  '--field-color-bg': 'surface-raised',
  '--color-text-danger': 'danger',
  '--color-text-success': 'tone-leaf-text',
};

for (const [scheme, values] of Object.entries(schemes)) {
  test(`editor.css ${scheme}: Payload roles carry the console's ${scheme} tokens`, () => {
    for (const [name, role] of Object.entries(roles)) {
      assert.equal(upper(values.get(name) ?? ''), upper(semantic[role][scheme]), `${name} should be ${role} (${scheme})`);
    }
  });

  test(`editor.css ${scheme}: every colour is a console ${scheme} token or a tint of one`, () => {
    const tokens = new Set(Object.values(semantic).map((pair) => upper(pair[scheme]).slice(0, 7)));
    for (const [name, value] of values) {
      if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value)) continue;
      assert.ok(tokens.has(upper(value).slice(0, 7)), `${name}: ${value} is not an @acme/theme ${scheme} colour`);
    }
  });
}

test('editor.css: every other literal colour (cta frame, row tint) comes from the @acme/theme palette', () => {
  const flat = (value) => (typeof value === 'string' ? [value] : Object.values(value).flatMap(flat));
  const known = new Set([...flat(palette), ...Object.values(semantic).flatMap((pair) => [pair.light, pair.dark])].map((hex) => upper(hex).slice(0, 7)));
  for (const [hex] of sheet.matchAll(/#[0-9a-f]{6}(?:[0-9a-f]{2})?\b/gi)) {
    assert.ok(known.has(upper(hex).slice(0, 7)), `${hex} is not an @acme/theme colour`);
  }
});

test('editor.css is square: Payload radii follow @acme/theme radius 0', () => {
  for (const name of ['--radius-small', '--radius-chip', '--radius-medium', '--radius-large']) {
    assert.equal(schemes.light.get(name), '0', name);
  }
});
