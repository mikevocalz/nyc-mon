import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// Node can't load .webp; stand in a Next-style StaticImageData for each import.
registerHooks({
  load(url, context, nextLoad) {
    if (!url.endsWith('.webp')) return nextLoad(url, context);
    const data = { src: new URL(url).pathname, width: 960, height: 1200 };
    return { format: 'module', source: `export default ${JSON.stringify(data)};`, shortCircuit: true };
  },
});

const { PROOF_ITEMS, PROOF_KIND_LABEL, PROOF_MAX_ITEMS, proofDateLabel, proofProblem, publicProof } = await import('./proof.ts');
type Item = (typeof PROOF_ITEMS)[number];

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const KINDS = Object.keys(PROOF_KIND_LABEL);

test('every candidate passes its own gate, and the page shows three to five of them', () => {
  for (const item of PROOF_ITEMS) assert.equal(proofProblem(item), null, `${item.id}: ${proofProblem(item)}`);
  const shown = publicProof();
  assert.ok(shown.length >= 3 && shown.length <= PROOF_MAX_ITEMS, `shows ${shown.length}`);
});

test('ids are unique', () => {
  assert.equal(new Set(PROOF_ITEMS.map((i) => i.id)).size, PROOF_ITEMS.length);
});

test('no testimonial, quote, review or press kind exists', () => {
  assert.deepEqual(KINDS.sort(), ['concept-art', 'design-artifact', 'prototype', 'render']);
  for (const item of PROOF_ITEMS) {
    assert.ok(KINDS.includes(item.kind), `${item.id}: kind ${item.kind}`);
    assert.doesNotMatch(item.kind, /testimonial|quote|review|press/);
  }
});

test('every rendered item carries a status label that names its kind, and alt text', () => {
  for (const item of publicProof()) {
    assert.ok(item.status.startsWith(PROOF_KIND_LABEL[item.kind]), `${item.id}: status "${item.status}"`);
    assert.ok(item.alt.trim().length > 20, `${item.id}: alt`);
  }
});

test('captions and titles hold no numbers, counts, quotes or social proof', () => {
  for (const item of PROOF_ITEMS) {
    const text = `${item.title} ${item.caption} ${item.status}`;
    assert.doesNotMatch(text, /\d/, `${item.id}: number`);
    assert.doesNotMatch(text, /["“”]/, `${item.id}: quotation`);
    assert.doesNotMatch(text, /\b(players?|users?|fans?|downloads?|reviews?|rated|stars?|loved|award|featured|press)\b/i, `${item.id}: social proof`);
    assert.doesNotMatch(text, /!/, `${item.id}: exclamation mark`);
  }
});

test('copy follows COPY_DECK: no banned words, no pronoun for a Mon', () => {
  const banned = /\b(device|devices|owner|trainer|user|master|catch|capture|recruit|callah|unlock|seamless|elevate|journey|reimagine)\b/i;
  for (const item of PROOF_ITEMS) {
    for (const [field, text] of [['title', item.title], ['caption', item.caption], ['status', item.status], ['alt', item.alt]] as const) {
      assert.doesNotMatch(text, banned, `${item.id}.${field}`);
    }
  }
  // The eggs' captions name the Baby that hatches; the Baby gets no pronoun.
  for (const item of PROOF_ITEMS.filter((i: Item) => i.kind === 'concept-art')) {
    assert.doesNotMatch(item.caption, /\b(he|his|him|she|her)\b/i, `${item.id}: pronoun`);
  }
});

test('generated art is labelled as concept art, never as a render', () => {
  for (const item of PROOF_ITEMS.filter((i: Item) => i.rights.status === 'generated')) {
    assert.equal(item.kind, 'concept-art', item.id);
    assert.match(item.status, /generated/i, `${item.id}: status says generated`);
  }
});

test('an unapproved item, or one with unknown rights, never renders', () => {
  const base = PROOF_ITEMS[0]!;
  assert.deepEqual(publicProof([{ ...base, approvedForPublic: false }]), []);
  assert.deepEqual(publicProof([{ ...base, rights: { status: 'unknown', note: '' } }]), []);
  assert.deepEqual(publicProof([{ ...base, approvalRef: undefined }]), []);
  assert.deepEqual(publicProof([{ ...base, status: 'Pre-release' }]), []);
  assert.deepEqual(publicProof([{ ...base, caption: 'Seen by 10,000 Callers.' }]), []);
});

test('empty state: no approved items means nothing to render', () => {
  assert.deepEqual(publicProof([]), []);
  assert.deepEqual(publicProof(PROOF_ITEMS.map((i: Item) => ({ ...i, approvedForPublic: false }))), []);
});

test('the strip is capped', () => {
  const many = Array.from({ length: PROOF_MAX_ITEMS + 3 }, (_, n) => ({ ...PROOF_ITEMS[0]!, id: `x${n}` }));
  assert.equal(publicProof(many).length, PROOF_MAX_ITEMS);
});

test('each source path exists and its date is a commit date of that path', (t) => {
  let gitDates: (path: string) => string[];
  try {
    // A shallow clone (CI checkouts default to depth 1) has no per-file history to compare against.
    const shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: REPO, encoding: 'utf8' }).trim();
    if (shallow === 'true') {
      t.skip('shallow clone: no per-file history');
      return;
    }
    gitDates = (path) => execFileSync('git', ['log', '--format=%cs', '--', path], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch {
    t.skip('git unavailable');
    return;
  }
  for (const item of PROOF_ITEMS) {
    assert.ok(existsSync(REPO + item.source.path), `${item.id}: ${item.source.path} exists`);
    const dates = gitDates(item.source.path);
    if (dates.length === 0) continue; // not committed yet (working tree); nothing to compare
    assert.ok(dates.includes(item.source.committed), `${item.id}: ${item.source.committed} is not a commit date of ${item.source.path} (${dates.slice(0, 3).join(', ')})`);
  }
});

test('dates print in a fixed, timezone-proof format', () => {
  assert.equal(proofDateLabel('2026-10-08'), 'Oct 8, 2026');
  assert.equal(proofDateLabel('2026-01-01'), 'Jan 1, 2026');
});
