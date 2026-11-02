// The vd port with every lane on, walked from the Apollo to the Manhattan Valley arch and back past the State Office
// Building at the iPad Pro 12.9" buffer (budget.test-support.ts).
//
// Asserted: the iPad's caps on the combined walk at its worst point (every module and pipeline the walk ever built):
// 150 shader modules, 90 render pipelines and 8 vertex buffers a pipeline; texture growth of lanes A and C over the walk
// without them at most 40 MB; lane A's own share (its modules, pipelines and texture bytes over the walk without it);
// and that every lane mounted. On 2026-10-29 the combined walk built 138 modules and 87 pipelines (189 and 125 before
// the lanes' materials went onto shared graphs and one vertex layout per family).
import assert from 'node:assert/strict';
import { test } from 'node:test';

const { measureVdBudgetInChild } = await import('./budget.test-support.ts');

const BASE = {
  EXPO_PUBLIC_WORLD_PHYSICAL: '1',
  EXPO_PUBLIC_WORLD_VD: undefined,
  EXPO_PUBLIC_WORLD_PRESET: 'ipad-a12x',
  EXPO_PUBLIC_WORLD_STREAM: '1',
};

test('vd port, every lane on: <= 150 modules, <= 90 pipelines, 8 vertex buffers a pipeline, +40 MB of texture', () => {
  const on = measureVdBudgetInChild({ ...BASE, EXPO_PUBLIC_WORLD_VD_BLOCKS: '1' });
  const off = measureVdBudgetInChild({ ...BASE, EXPO_PUBLIC_WORLD_VD_BLOCKS: '0' });
  const bare = measureVdBudgetInChild({ ...BASE, EXPO_PUBLIC_WORLD_VD_BLOCKS: '0', EXPO_PUBLIC_WORLD_VD_FURNITURE: '0' });
  const { names: n1, pipelineOwners: _p1, ...a } = on;
  const { names: _n0, pipelineOwners: _p0, ...b } = off;
  console.info('[vd-budget] all lanes', JSON.stringify(a));
  console.info('[vd-budget] without lane A', JSON.stringify(b));
  console.info('[vd-budget] without lanes A and C', JSON.stringify({ shaderModules: bare.shaderModules, renderPipelines: bare.renderPipelines, textureBytes: bare.textureBytes }));
  assert.ok(n1.includes('city:vd-blocks-shell') && n1.includes('city:vd-blocks-near'), 'lane A mounted');
  assert.ok(n1.some((n) => n.startsWith('vd:storefronts')), 'lane B mounted');
  assert.ok(n1.some((n) => n.startsWith('vd-pool:')) && on.structureVertices > 0, 'lane C mounted and streamed');
  assert.ok(on.shaderModules <= 150, `${on.shaderModules} shader modules on the walk`);
  assert.ok(on.renderPipelines <= 90, `${on.renderPipelines} render pipelines on the walk`);
  assert.ok(on.maxVertexBuffers <= 8, `${on.maxVertexBuffers} vertex buffers in one pipeline`);
  assert.ok(on.textureBytes - bare.textureBytes <= 40_000_000, `lanes A and C: +${on.textureBytes - bare.textureBytes} texture bytes`);
  assert.ok(on.shaderModules - off.shaderModules <= 8, `lane A: +${on.shaderModules - off.shaderModules} shader modules`);
  assert.ok(on.renderPipelines - off.renderPipelines <= 4, `lane A: +${on.renderPipelines - off.renderPipelines} pipelines`);
  assert.ok(on.textureBytes - off.textureBytes <= 1_000_000, `lane A: +${on.textureBytes - off.textureBytes} texture bytes`);
});
