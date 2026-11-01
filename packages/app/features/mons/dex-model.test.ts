import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { allSpecies, bloodlines, eggs } from '@acme/content';
import { MONS_COPY } from './copy.ts';
import {
  ALL_DEX, adjacentEntry, bloodlineFilters, dexDigits, dexEntry, dexIndex, entryFacts, entryName, entryTypes, evolutionLine,
  evolutionTrigger, filterDex, groupByBloodline, MISSING_CANON_FIELDS, seenCount, seenSpeciesIds, UNSEEN,
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

  it('counts all four starter eggs as met at M08, and never the Baby inside an unhatched egg', () => {
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
    assert.deepEqual(seenCount(dexIndex(seenSpeciesIds(HATCHED))), { seen: 5, total: allSpecies.length });
  });

  it('filters by Bloodline and groups the list under one heading per Bloodline', () => {
    const index = dexIndex(new Set());
    const yote = filterDex(index, { ...ALL_DEX, bloodline: 'F12' });
    assert.ok(yote.length > 0 && yote.every((e) => e.bloodlineId === 'F12'));
    const headings = groupByBloodline(index).filter((i) => i.kind === 'heading');
    const ids = headings.map((h) => (h.kind === 'heading' ? h.bloodlineId : ''));
    // One heading per Bloodline content ships, each listed once: Dex order never splits a Bloodline.
    assert.equal(ids.length, bloodlines.length);
    assert.deepEqual([...ids].sort(), bloodlines.map((b) => b.bloodlineId).sort());
    for (const bloodline of bloodlines) {
      const run = groupByBloodline(filterDex(index, { ...ALL_DEX, bloodline: bloodline.bloodlineId }));
      assert.equal(run.filter((i) => i.kind === 'entry').length, allSpecies.filter((s) => s.bloodlineId === bloodline.bloodlineId).length, bloodline.bloodlineId);
    }
    assert.deepEqual(bloodlineFilters().map((f) => f.id), bloodlines.map((b) => b.bloodlineId));
  });

  it('searches by number for every form but by name only among seen ones, so a search never leaks a name', () => {
    const index = dexIndex(seenSpeciesIds(HATCHED));
    const twos = allSpecies.filter((s) => s.dexId !== null && dexDigits(s.dexId).includes('2')).map((s) => s.dexId).sort((a, b) => a! - b!);
    assert.ok(twos.length > 3, 'the full roster has more than the starters\' 2, 12 and 62');
    assert.deepEqual(filterDex(index, { ...ALL_DEX, text: '2' }).map((e) => e.dexId), twos);
    assert.deepEqual(filterDex(index, { ...ALL_DEX, text: 'No. 004' }).map((e) => e.dexId), [4]);
    assert.deepEqual(filterDex(index, { ...ALL_DEX, text: 'squeak' }).map((e) => e.dexId), [2]);
    assert.equal(filterDex(index, { ...ALL_DEX, text: 'royale' }).length, 0, 'Ratti Royale is unseen');
  });

  it('filters by stage among seen forms only', () => {
    const index = dexIndex(seenSpeciesIds(HATCHED));
    assert.deepEqual(filterDex(index, { ...ALL_DEX, stage: 'Egg' }).map((e) => e.dexId), [1, 8, 20, 61]);
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

  it('reads each form\'s trigger from its evolutionUnlock, and none where content has none', () => {
    for (const s of allSpecies) {
      const trigger = evolutionTrigger(s.speciesId);
      if (s.evolutionUnlock === null || s.evolutionUnlock === undefined) assert.equal(trigger, null, s.speciesId);
      else assert.deepEqual(trigger, { name: s.evolutionUnlock.itemName, mastery: s.evolutionUnlock.mastery, swatch: null }, s.speciesId);
    }
    assert.equal(evolutionTrigger('dex-005')?.name, 'Street Cred Crystal');
    assert.equal(evolutionTrigger('dex-004'), null, 'a Mid has no unlock');
  });

  it('is empty for an id content does not know', () => {
    assert.deepEqual(evolutionLine('dex-999', new Set()), []);
  });
});

describe('MONS facts come from content only', () => {
  it('shows lore (culture note first, else the roster summary) and the size target, and nothing content leaves null', () => {
    for (const s of allSpecies) {
      const expected = [
        ...((s.cultureNote ?? s.loreSummary ?? null) === null ? [] : [{ id: 'lore', value: s.cultureNote ?? s.loreSummary }]),
        ...((s.scaleTargetDescription ?? null) === null ? [] : [{ id: 'size', value: s.scaleTargetDescription }]),
      ];
      assert.deepEqual(entryFacts(s.speciesId), expected, s.speciesId);
      assert.deepEqual(entryTypes(s.speciesId), s.legacyTypeNames ?? [], s.speciesId);
      assert.equal(s.districtId ?? null, null, 'update the entry when a home district lands');
    }
    assert.deepEqual(entryFacts('dex-999'), []);
    assert.deepEqual(entryTypes('dex-001'), [], 'an Egg has no type');
    assert.ok(MISSING_CANON_FIELDS.some((m) => m.field === 'home district'));
    assert.equal(MISSING_CANON_FIELDS.some((m) => m.field.startsWith('records')), false, 'content ships the full roster');
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
