// WCAG contrast audit for every text/background pair the semantic tokens form.
// Run: node contrast.mjs   (exits 1 if any pair is under AA 4.5:1)
import { semantic } from './tokens.ts';

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const SURFACES = ['bg', 'surface', 'surface-raised', 'surface-sunken'];
const TEXT_ON_SURFACES = ['text', 'text-muted', 'primary', 'accent', 'success', 'danger', 'info'];
const FILLS = ['primary', 'primary-pressed', 'accent', 'accent-pressed', 'success', 'danger', 'info'];

const pairs = [];
for (const fg of TEXT_ON_SURFACES) for (const bg of SURFACES) pairs.push([fg, bg]);
for (const fill of FILLS) {
  const on = `on-${fill.replace('-pressed', '')}`;
  pairs.push([on, fill]);
}
pairs.push(['text-inverse', 'text']);

let failed = 0;
for (const mode of ['dark', 'light']) {
  console.log(`\n${mode}`);
  for (const [fg, bg] of pairs) {
    const a = semantic[fg][mode];
    const b = semantic[bg][mode];
    const r = ratio(a, b);
    const ok = r >= 4.5;
    if (!ok) failed++;
    console.log(`  ${ok ? 'AA ' : 'FAIL'} ${r.toFixed(2).padStart(5)}  ${fg} ${a} on ${bg} ${b}`);
  }
}
if (failed) {
  console.error(`\n${failed} pair(s) under 4.5:1`);
  process.exit(1);
}
console.log('\nall pairs clear AA 4.5:1');
