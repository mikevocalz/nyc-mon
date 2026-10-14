import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const lint = new ESLint({ cwd: fileURLToPath(new URL('../', import.meta.url)) });
const options = { filePath: 'components/city/motion-runtime.ts' };

test('route motion may import the established Kinetrell adapter', async () => {
  const [result] = await lint.lintText("import { createGsapTimeline } from 'kinetrell/web/gsap'; export const bind = createGsapTimeline;", options);
  assert.deepEqual(result.messages.filter((message) => message.ruleId === 'no-restricted-imports'), []);
});

test('direct GSAP and other restricted platform imports remain blocked in route adapters', async () => {
  for (const code of [
    "import gsap from 'gsap'; export const raw = gsap;",
    "import { ScrollTrigger } from 'gsap/ScrollTrigger'; export const raw = ScrollTrigger;",
    "import { View } from 'react-native'; export const raw = View;",
  ]) {
    const [result] = await lint.lintText(code, options);
    assert.ok(result.messages.some((message) => message.ruleId === 'no-restricted-imports'), code);
  }
});
