// Module hooks for bake-vd-storefronts.mjs. Valdrada's spec files are plain data except bid3.js, which takes the Koch
// building's pier centres (KC) and bay centres (KB) from fk/custom/bid3Koch.js, a three.js builder that cannot load in
// Node. The hook serves that one import as its two data lines (bid3Koch.js L10-L11 @ 2724c79), read from the file itself.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function resolve(specifier, context, next) {
  if (specifier.endsWith('custom/bid3Koch.js') && context.parentURL) {
    const file = fileURLToPath(new URL(specifier, context.parentURL));
    const src = readFileSync(file, 'utf8').split('\n');
    const kc = src.find((l) => l.startsWith('export const KC'));
    const kb = src.find((l) => l.startsWith('export const KB'));
    if (!kc || !kb) throw new Error('bid3Koch.js: KC / KB lines not found');
    return { url: `data:text/javascript,${encodeURIComponent(`${kc}\n${kb}\n`)}`, shortCircuit: true };
  }
  return next(specifier, context);
}
