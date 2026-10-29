// The vd port with every lane on, walked from the Apollo to the Manhattan Valley arch and back past the State Office
// Building at the iPad Pro 12.9" buffer (budget.test-support.ts), against the same walk without lane A's blocks.
//
// Asserted: lane A's own cost (its shader modules, pipelines and texture bytes over the walk without it), the iPad's 8
// vertex buffers per pipeline, and that every lane mounted. Logged, not asserted: the combined totals. On 2026-10-29 the
// combined walk created 189 shader modules and 125 pipelines against the 150 / 90 caps; the collapse onto shared graphs
// across lanes is the open item in the PR (lane A adds 6 and 4 of them).
import assert from 'node:assert/strict';
import { test } from 'node:test';

const { measureVdBudgetInChild } = await import('./budget.test-support.ts');

const BASE = {
  EXPO_PUBLIC_WORLD_PHYSICAL: '1',
  EXPO_PUBLIC_WORLD_VD: undefined,
  EXPO_PUBLIC_WORLD_PRESET: 'ipad-a12x',
  EXPO_PUBLIC_WORLD_STREAM: '1',
};

test('vd port, every lane on: lane A costs at most 8 modules, 4 pipelines and 1 MB of texture; 8 vertex buffers a pipeline', () => {
  const on = measureVdBudgetInChild({ ...BASE, EXPO_PUBLIC_WORLD_VD_BLOCKS: '1' });
  const off = measureVdBudgetInChild({ ...BASE, EXPO_PUBLIC_WORLD_VD_BLOCKS: '0' });
  const { names: n1, pipelineOwners: _p1, ...a } = on;
  const { names: _n0, pipelineOwners: _p0, ...b } = off;
  console.info('[vd-budget] all lanes', JSON.stringify(a));
  console.info('[vd-budget] without lane A', JSON.stringify(b));
  assert.ok(n1.includes('city:vd-blocks-shell') && n1.includes('city:vd-blocks-near'), 'lane A mounted');
  assert.ok(n1.some((n) => n.startsWith('vd:storefronts')), 'lane B mounted');
  assert.ok(n1.some((n) => n.startsWith('vd-pool:')) && on.structureVertices > 0, 'lane C mounted and streamed');
  assert.ok(on.shaderModules - off.shaderModules <= 8, `lane A: +${on.shaderModules - off.shaderModules} shader modules`);
  assert.ok(on.renderPipelines - off.renderPipelines <= 4, `lane A: +${on.renderPipelines - off.renderPipelines} pipelines`);
  assert.ok(on.textureBytes - off.textureBytes <= 1_000_000, `lane A: +${on.textureBytes - off.textureBytes} texture bytes`);
  assert.ok(on.maxVertexBuffers <= 8, `${on.maxVertexBuffers} vertex buffers in one pipeline`);
});
