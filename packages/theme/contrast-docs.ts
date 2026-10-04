/**
 * Writes the measured tables in docs/design/CONTRAST.md and docs/DESIGN_SYSTEM.md
 * from the registry in contrast.ts, so the docs never carry hand-typed ratios.
 * Each generated block sits between `<!-- contrast:<name>:start -->` and
 * `<!-- contrast:<name>:end -->`; everything outside the markers is prose and
 * stays as written.
 *
 *   node contrast-docs.ts          rewrite the blocks
 *   node contrast-docs.ts --check  exit 1 if a block is stale
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FORBIDDEN, PAIRS, THRESHOLD, measureAll, measureForbidden, resolveToken, toHex, type Measurement, type Pair,
} from './contrast.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const fmt = (n: number) => n.toFixed(2);
const result = (m: Measurement) =>
  m.pair.role === 'decorative' || m.pair.role === 'disabled' ? 'exempt' : m.pass ? 'pass' : 'FAIL';

function where(p: Pair): string {
  const files = p.usedAt.map((u) => `\`${u}\``).join(', ');
  const base = files || 'token contract';
  return p.reason ? `${base}; ${p.reason}` : base;
}

const HEAD =
  '| Pair | Mode | Foreground | Background | Ratio | Role (min) | Result | Where used |\n' +
  '|---|---|---|---|---:|---|---|---|';

function row(m: Measurement): string {
  return `| ${m.pair.id} | ${m.mode} | \`${m.pair.fg}\` ${m.fgHex} | \`${m.pair.bg.join(' + ')}\` ${m.bgHex} | ${fmt(m.ratio)} | ${m.pair.role} (${THRESHOLD[m.pair.role]}) | ${result(m)} | ${where(m.pair)} |`;
}

function forbiddenTable(ids?: ReadonlySet<string>): string {
  const lines = ['| Rule | Pair | Ratio | Needs | Rule text |', '|---|---|---:|---:|---|'];
  for (const f of FORBIDDEN) {
    if (ids && !ids.has(f.id)) continue;
    const { ratio, threshold } = measureForbidden(f);
    const hex = (t: string) => toHex(resolveToken(t, 'dark'));
    lines.push(`| ${f.id} | \`${f.fg}\` ${hex(f.fg)} on \`${f.bg}\` ${hex(f.bg)} | ${fmt(ratio)} | ${threshold} | ${f.rule} |`);
  }
  return lines.join('\n');
}

export function blocks(): Record<string, string> {
  const all = measureAll(PAIRS);
  const contract = all.filter((m) => m.pair.id.startsWith('contract:'));
  const usage = all.filter((m) => !m.pair.id.startsWith('contract:'));
  const exempt = all.filter((m) => result(m) === 'exempt').length;
  const failed = all.filter((m) => result(m) === 'FAIL').length;
  const passed = all.length - exempt - failed;

  // DESIGN_SYSTEM.md: the daylit, H-Lynk and tone-text rows, the pairs that doc introduces.
  const isNew = (m: Measurement) =>
    /^(daylit|hlynk):/.test(m.pair.id) || / ghost label on /.test(m.pair.id) || m.pair.id === 'field error message on page';
  const newRows = all.filter(isNew);
  const newForbidden = new Set([
    'orange on daylit page', 'LED on Core body', 'apple-400 on Core body', 'black text on Core body',
    'concrete-900 keys on Core body', 'black keys on apple-700', 'white on apple',
  ]);

  return {
    summary: `- ${all.length} measured rows: ${passed} pass, ${failed} fail, ${exempt} exempt (decorative or disabled).`,
    usage: [HEAD, ...usage.map(row)].join('\n'),
    contract: [HEAD, ...contract.map(row)].join('\n'),
    forbidden: forbiddenTable(),
    'design-system-pairs': [HEAD, ...newRows.map(row)].join('\n'),
    'design-system-forbidden': forbiddenTable(newForbidden),
  };
}

const DOCS: Record<string, readonly string[]> = {
  'docs/design/CONTRAST.md': ['summary', 'usage', 'contract', 'forbidden'],
  'docs/DESIGN_SYSTEM.md': ['design-system-pairs', 'design-system-forbidden'],
};

/** The doc with every generated block replaced. Throws when a marker pair is missing. */
export function render(file: string, text: string, b = blocks()): string {
  let out = text;
  for (const name of DOCS[file] ?? []) {
    const start = `<!-- contrast:${name}:start -->`;
    const end = `<!-- contrast:${name}:end -->`;
    const i = out.indexOf(start);
    const j = out.indexOf(end);
    if (i < 0 || j < i) throw new Error(`${file}: missing ${start} ... ${end}`);
    // Blank lines around the block keep tables and lists from fusing with the comments.
    out = `${out.slice(0, i + start.length)}\n\n${b[name]}\n\n${out.slice(j)}`;
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const check = process.argv.includes('--check');
  const b = blocks();
  let stale = 0;
  for (const file of Object.keys(DOCS)) {
    const abs = resolve(ROOT, file);
    const before = readFileSync(abs, 'utf8');
    const after = render(file, before, b);
    if (before === after) continue;
    if (check) {
      stale++;
      console.error(`${file} is stale; run: node packages/theme/contrast-docs.ts`);
    } else {
      writeFileSync(abs, after);
      console.log(`${file} written`);
    }
  }
  if (stale) process.exit(1);
}
