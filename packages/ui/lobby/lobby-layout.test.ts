// The lobby's class contract (lobby-layout.ts). Unit fixtures on strings,
// not device evidence: they pin the phone column and the variant rules.
import assert from 'node:assert/strict';
import test from 'node:test';
import { LOBBY_PAIRED_IDENTITY, LOBBY_PAIRED_RESUME, LOBBY_SPLIT_PROBE, lobbyLayoutClasses } from './lobby-layout.ts';

const PROPERTY = /^(?:(md|lg):)?(?:(portrait|landscape):)?(.+)$/;

/** The style group a utility writes, coarse enough to catch two variants competing. */
function group(utility: string): string {
  if (utility.startsWith('max-w-')) return 'max-w';
  if (/^w-/.test(utility)) return 'w';
  if (/^gap-/.test(utility)) return 'gap';
  if (/^p[trblxy]?-/.test(utility)) return utility.split('-')[0]!;
  if (/^m[trblxy]?-/.test(utility)) return utility.split('-')[0]!;
  if (/^justify-/.test(utility)) return 'justify';
  if (/^flex-(row|col)/.test(utility)) return 'flex-direction';
  if (/^flex-/.test(utility)) return 'flex';
  return utility;
}

test('phones keep the old column and carry no md class', () => {
  const phone = lobbyLayoutClasses(false);
  assert.equal(phone.column, 'flex-1 gap-6 px-4 pb-4 pt-6');
  assert.equal(phone.start, 'mt-auto');
  for (const value of Object.values(phone) as string[]) assert.doesNotMatch(value, /md:|lg:|portrait|landscape/);
});

test('tablet: one value per breakpoint and at most one orientation value per property', () => {
  for (const value of [...(Object.values(lobbyLayoutClasses(true)) as string[]), LOBBY_PAIRED_IDENTITY, LOBBY_PAIRED_RESUME]) {
    const seen = new Map<string, number>();
    for (const token of value.split(/\s+/).filter(Boolean)) {
      const [, bp = '', orientation = '', utility = ''] = PROPERTY.exec(token)!;
      const key = `${bp}|${orientation}|${group(utility)}`;
      assert.ok(!seen.has(key), `${token} competes with another class in "${value}"`);
      seen.set(key, 1);
    }
    // One orientation value per property: portrait and landscape never both set it.
    const oriented = new Map<string, number>();
    for (const token of value.split(/\s+/).filter((t: string) => /portrait:|landscape:/.test(t))) {
      const prop = group(PROPERTY.exec(token)![3]!);
      oriented.set(prop, (oriented.get(prop) ?? 0) + 1);
    }
    for (const [prop, count] of oriented) assert.equal(count, 1, `${prop} has more than one orientation value`);
  }
});

test('tablet portrait is top-aligned: START follows its resume line from md', () => {
  const tablet = lobbyLayoutClasses(true);
  assert.match(tablet.start, /(^|\s)md:mt-0(\s|$)/);
  assert.match(tablet.column, /md:max-w-\[640px\]/);
});

test('tablet landscape splits into two panes and docks START at the foot', () => {
  const tablet = lobbyLayoutClasses(true);
  assert.match(tablet.column, /md:landscape:flex-row/);
  assert.match(tablet.identity, /md:landscape:flex-1/);
  assert.match(tablet.board, /md:landscape:flex-1/);
  assert.match(tablet.resume, /md:landscape:justify-end/);
  assert.match(tablet.resume, /md:landscape:flex-none/);
  // The JS probe reads the same variant the row uses.
  assert.match(LOBBY_SPLIT_PROBE, /md:landscape:flex/);
});

test('paired panes dock START at the foot, level with the board', () => {
  assert.match(LOBBY_PAIRED_RESUME, /justify-end/);
  assert.doesNotMatch(LOBBY_PAIRED_RESUME, /justify-center/);
  // Same bottom padding on both panes, so START's foot meets the board's.
  const bottoms = (v: string) => v.split(/\s+/).filter((t) => /(^|:)pb-/.test(t)).sort();
  assert.deepEqual(bottoms(LOBBY_PAIRED_RESUME), bottoms(LOBBY_PAIRED_IDENTITY));
});
