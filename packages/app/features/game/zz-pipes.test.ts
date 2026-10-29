import { test } from 'node:test';
process.env.EXPO_PUBLIC_WORLD_PHYSICAL = '1';
process.env.EXPO_PUBLIC_WORLD_RELEASE_UPLOADED = '1';
test('pipes', async () => {
  const { measureFirstFrame } = await import('./city-scene.physical-first-frame.test-support.ts');
  const f = await measureFirstFrame();
  const h = new Map<string, number>();
  for (const p of f.pipelines) { const k = p.label.replace(/[0-9]+/g, '#'); h.set(k, (h.get(k) ?? 0) + 1); }
  console.log([...h].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v} ${k}`).join('\n'));
  console.log(f.pipelines.slice(0, 5));
});
