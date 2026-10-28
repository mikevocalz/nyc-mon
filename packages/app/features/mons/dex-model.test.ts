import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { allSpecies, eggs } from '@acme/content';
import { MONS_COPY } from './copy.ts';
import {
  ALL_DEX, adjacentEntry, dexDigits, dexEntry, dexIndex, entryFacts, entryName, evolutionLine, evolutionTrigger,
  filterDex, groupByBloodline, MISSING_CANON_FIELDS, seenCount, seenSpeciesIds, UNSEEN,
} from './dex-model.ts';
import { LIST_MAX, LIST_MIN, monsArrangement } from './dex-layout.ts';

const NO_SAVE = undefined;
const EMPTY = { eggs: [], mons: [] };
/** A Caller mid-incubation: picked the Metro Egg at M08, nothing hatched. */
const INCUBATING = { eggs: [{ speciesId: 'dex-001' }], mons: [] };
/** A Caller whose Squeaklet hatched. */
const HATCHED = { eggs: [{ speciesId: 'dex-001' }], mons: [{ speciesId: 'dex-002' }] };
/** A Hood Ratti that reached Agua Ratti (#006). */
const AGUA = { eggs: [{ speciesId: 'dex-001' }], mons: [{ speciesId: 'dex-006' }] };

describe('MONS seen rule', () => {
  it('sees nothing without a save, or with a save that never reached M08', () => {
    assert.equal(seenSpeciesIds(NO_SAVE).size, 0);
    assert.equal(seenSpeciesIds(EMPTY).size, 0);
  });

  it('counts all three starter eggs as met at M08, and never the Baby inside an unhatched egg', () => {
    const seen = seenSpeciesIds(INCUBATING);
    assert.deepEqual([...seen].sort(), eggs.map((e) => e.speciesId).sort());
    assert.equal(seen.has('dex-002'), false, 'Squeaklet stays ??? until the hatch');
  });

  it('adds a hatched Mon and the forms on its chain, nothing ahead of it', () => {
    const seen = seenSpeciesIds(HATCHED);
    assert.ok(seen.has('dex-002'));
    assert.equal(seen.has('dex-003'), false);
  });

  it('follows an evolved Mon back through its history but not to the sibling Max branches', () => {
    const seen = seenSpeciesIds(AGUA);
    for (const id of ['dex-001', 'dex-002', 'dex-003', 'dex-004', 'dex-006']) assert.ok(seen.has(id), id);
    assert.equal(seen.has('dex-005'), false);
    assert.equal(seen.has('dex-007'), false);
  });

  it('ignores species ids content does not ship', () => {
    const seen = seenSpeciesIds({ eggs: [], mons: [{ speciesId: 'dex-999' }] });
    assert.equal(seen.has('dex-999'), false);
  });
});

describe('MONS index', () => {
  it('lists every record content ships, in Dex number order', () => {
    const index = dexIndex(new Set());
    assert.equal(index.length, allSpecies.length);
    const numbers = index.map((e) => e.dexId ?? 0);
    assert.deepEqual(numbers, [...numbers].sort((a, b) => a - b));
    assert.equal(dexDigits(index[0]!.dexId), '001');
  });

  it('shows unseen forms as ??? with only their number', () => {
    const entry = dexEntry('dex-004', seenSpeciesIds(HATCHED))!;
    assert.equal(entry.seen, false);
    assert.equal(entryName(entry), UNSEEN);
    assert.equal(entryName(dexEntry('dex-002', seenSpeciesIds(HATCHED))!), 'Squeaklet');
  });

  it('counts seen of total', () => {
    assert.deepEqual(seenCount(dexIndex(seenSpeciesIds(HATCHED))), { seen: 4, total: allSpecies.length });
  });

  it('filters by Bloodline and groups the list under one heading per Bloodline', () => {
    const index = dexIndex(new Set());
    const yote = filterDex(index, { ...ALL_DEX, bloodline: 'F12' });
    assert.ok(yote.length > 0 && yote.every((e) => e.bloodlineId === 'F12'));
    const headings = groupByBloodline(index).filter((i) => i.kind === 'heading');
    assert.deepEqual(headings.map((h) => (h.kind === 'heading' ? h.bloodlineId : '')), ['F01', 'F02', 'F12']);
  });

  it('searches by number for every form but by name only among seen ones, so a search never leaks a name', () => {
    const index = dexIndex(seenSpeciesIds(HATCHED));
    assert.deepEqual(filterDex(index, { ...ALL_DEX, text: '2' }).map((e) => e.dexId), [2, 12, 62]);
    assert.deepEqual(filterDex(index, { ...ALL_DEX, text: 'No. 004' }).map((e) => e.dexId), [4]);
    assert.deepEqual(filterDex(index, { ...ALL_DEX, text: 'squeak' }).map((e) => e.dexId), [2]);
    assert.equal(filterDex(index, { ...ALL_DEX, text: 'royale' }).length, 0, 'Ratti Royale is unseen');
  });

  it('filters by stage among seen forms only', () => {
    const index = dexIndex(seenSpeciesIds(HATCHED));
    assert.deepEqual(filterDex(index, { ...ALL_DEX, stage: 'Egg' }).map((e) => e.dexId), [1, 8, 61]);
    assert.equal(filterDex(index, { ...ALL_DEX, stage: 'Max' }).length, 0);
  });

  it('steps to the neighbouring numbers and stops at either end', () => {
    const index = dexIndex(new Set());
    assert.equal(adjacentEntry(index, 'dex-002', 1)?.speciesId, 'dex-003');
    assert.equal(adjacentEntry(index, 'dex-001', -1), undefined);
  });
});

describe('MONS evolution line', () => {
  it('runs Egg to Max from the roster with the three Max forms as one branching column', () => {
    const line = evolutionLine('dex-002', seenSpeciesIds(HATCHED));
    assert.deepEqual(line.map((c) => c.stage), ['Egg', 'Baby', 'Small', 'Mid', 'Max']);
    assert.deepEqual(line.map((c) => c.steps.length), [1, 1, 1, 1, 3]);
    assert.deepEqual(line.map((c) => c.branches), [false, false, false, false, true]);
    assert.deepEqual(line[4]!.steps.map((s) => s.dexId), [5, 6, 7]);
  });

  it('labels seen steps, leaves unseen ones unnamed and marks the entry being read', () => {
    const steps = evolutionLine('dex-002', seenSpeciesIds(HATCHED)).flatMap((c) => c.steps);
    assert.equal(steps.find((s) => s.dexId === 1)?.label, 'Metro Egg');
    assert.equal(steps.find((s) => s.dexId === 3)?.label, null);
    assert.deepEqual(steps.filter((s) => s.current).map((s) => s.dexId), [2]);
  });

  it('names no branch trigger: canon has none, so every Max form reads Trigger unknown', () => {
    for (const s of allSpecies.filter((x) => x.stage === 'Max')) assert.equal(evolutionTrigger(s.speciesId), null, s.formName ?? '');
    assert.equal(MONS_COPY['mons.entry.trigger.unknown'], 'Trigger unknown');
  });

  it('is empty for an id content does not know', () => {
    assert.deepEqual(evolutionLine('dex-999', new Set()), []);
  });
});

describe('MONS facts come from content only', () => {
  it('leaves out every null field instead of inventing one', () => {
    for (const s of allSpecies) {
      assert.equal(s.cultureNote, null, 'update this test when a culture note lands');
      assert.deepEqual(entryFacts(s.speciesId), []);
    }
    assert.ok(MISSING_CANON_FIELDS.some((m) => m.field.startsWith('branch triggers')));
  });

  it('keeps the ui copy to the canon words', () => {
    const text = Object.values(MONS_COPY).join(' ').toLowerCase();
    for (const banned of ['device', 'pet', 'player', 'owner', 'trainer', 'family', 'catch', 'capture', '—']) {
      assert.equal(text.includes(banned), false, banned);
    }
  });
});

describe('MONS layout', () => {
  it('keeps phones and tablet portrait to one column', () => {
    assert.deepEqual(monsArrangement({ width: 390, height: 844, fold: null }), { mode: 'single' });
    assert.deepEqual(monsArrangement({ width: 844, height: 390, fold: null }), { mode: 'single' }, 'phone landscape is under md');
    assert.deepEqual(monsArrangement({ width: 820, height: 1180, fold: null }), { mode: 'single' });
  });

  it('splits landscape from md, the list at two fifths within its bounds', () => {
    assert.deepEqual(monsArrangement({ width: 767, height: 500, fold: null }), { mode: 'single' });
    assert.deepEqual(monsArrangement({ width: 768, height: 500, fold: null }), { mode: 'split', listWidth: LIST_MIN, gapWidth: 0 });
    assert.deepEqual(monsArrangement({ width: 1100, height: 820, fold: null }), { mode: 'split', listWidth: LIST_MAX, gapWidth: 0 });
  });

  it('puts the boundary on a separating fold, portrait or not, and keeps both panes off the hinge', () => {
    const open = monsArrangement({ width: 884, height: 1104, fold: { leadingWidth: 442, gapWidth: 0 } });
    assert.deepEqual(open, { mode: 'split', listWidth: 442, gapWidth: 0 });
    const duo = monsArrangement({ width: 1114, height: 720, fold: { leadingWidth: 540, gapWidth: 34 } });
    assert.deepEqual(duo, { mode: 'split', listWidth: 540, gapWidth: 34 });
  });

  it('ignores a fold that leaves a side too narrow for a pane', () => {
    assert.deepEqual(monsArrangement({ width: 600, height: 900, fold: { leadingWidth: 300, gapWidth: 0 } }), { mode: 'single' });
  });
});
