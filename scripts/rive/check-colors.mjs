#!/usr/bin/env node
// Fails when an RML colour is not a token from packages/theme/tokens.ts.
//
// RML colours are ARGB hex with no '#'. The RGB six digits must match a hex
// in tokens.ts; the alpha prefix is free, because alpha is a per-paint
// opacity and tokens.ts itself carries alpha only on the glow and scrim
// pairs. Decision: BUILD alpha-free matching; a stricter mode would force a
// token per translucent shadow, which tokens.ts does not define.
//
// Usage: node scripts/rive/check-colors.mjs [project-dir ...]
// With no arguments every project under packages/ui/rive is checked.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(import.meta.url), '../../..');
const tokensPath = join(repoRoot, 'packages/theme/tokens.ts');
const riveRoot = join(repoRoot, 'packages/ui/rive');

const tokenSource = readFileSync(tokensPath, 'utf8');
const tokenHexes = new Set(
  [...tokenSource.matchAll(/#([0-9a-fA-F]{6})(?:[0-9a-fA-F]{2})?\b/g)].map((m) => m[1].toUpperCase()),
);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'build' || entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (entry.endsWith('.rml')) out.push(full);
  }
  return out;
}

// Attributes that carry a colour in RML: colorValue on SolidColor and
// GradientStop, propertyValue on ViewModelInstanceColor / CustomPropertyColor,
// value on KeyFrameColor.
const colourAttr = /\b(colorValue|propertyValue|value)="([0-9a-fA-F]{6}|[0-9a-fA-F]{8})"/g;

const dirs = process.argv.slice(2).length ? process.argv.slice(2).map((d) => resolve(d)) : [riveRoot];
const files = dirs.flatMap((d) => (statSync(d).isDirectory() ? walk(d) : [d]));

let failures = 0;
let checked = 0;
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  text.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(colourAttr)) {
      const [, attr, hex] = m;
      // propertyValue and value also carry numbers, strings and ids. A six- or
      // eight-digit numeric literal matches the pattern; no token is
      // all-numeric, so skip those. `value` is only a colour on KeyFrameColor.
      if (attr !== 'colorValue' && /^\d+$/.test(hex)) continue;
      if (attr === 'value' && !line.includes('KeyFrameColor')) continue;
      checked += 1;
      const rgb = hex.length === 8 ? hex.slice(2) : hex;
      if (!tokenHexes.has(rgb.toUpperCase())) {
        failures += 1;
        console.error(`${relative(repoRoot, file)}:${i + 1}: ${attr}="${hex}" is not a packages/theme/tokens.ts colour`);
      }
    }
  });
}

console.log(`check-colors: ${checked} colour attributes in ${files.length} RML files, ${failures} off-token`);
process.exit(failures === 0 ? 0 : 1);
