import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

test('the rendered label memo includes generated POIs and refreshes when they change', () => {
  const source = readFileSync(new URL('./CityWalkStage.tsx', import.meta.url), 'utf8');
  const memo = source.match(/const allLabels = useMemo\(\(\) => (\[[^;]+?\]), (\[[^;]+?\])\);/);
  assert.ok(memo, 'the rendered collection is memoized');
  const names = ['landmarks', 'genPoi', 'signs', 'streetLabels'];
  const groups = names.map((key) => [{ key }]);
  // Execute the actual collection expression, not a separately reimplemented concatenation.
  const collect = (values: typeof groups) =>
    JSON.stringify(runInNewContext(memo[1]!, Object.fromEntries(names.map((name, i) => [name, values[i]]))));
  assert.equal(collect(groups), JSON.stringify(groups.flat()));
  assert.equal(collect([groups[0]!, [], groups[2]!, groups[3]!]), JSON.stringify([groups[0], groups[2], groups[3]].flat()));
  assert.ok(memo[2]!.slice(1, -1).split(',').map((name) => name.trim()).includes('genPoi'));
  assert.match(source, /\{allLabels\.map\(\(l\) =>/);
});
