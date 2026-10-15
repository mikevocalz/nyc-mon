import assert from 'node:assert/strict';
import test from 'node:test';
import { typeRamp, typeScale, xrTypeRamp } from '@acme/theme';
import { tv } from 'tailwind-variants';
import { TYPE_SCALE_TV } from './type-scale.ts';

const withColour = tv({ base: 'font-sans text-text' }, TYPE_SCALE_TV);

test('every display, type-ramp and xr-ramp step survives a colour class after it', () => {
  for (const step of [...Object.keys(typeScale), ...Object.keys(typeRamp), ...Object.keys(xrTypeRamp)]) {
    const out = withColour({ className: `text-${step} text-primary` }).split(' ');
    assert.ok(out.includes(`text-${step}`), `text-${step} was dropped: ${out.join(' ')}`);
    assert.ok(out.includes('text-primary'), `text-primary was dropped: ${out.join(' ')}`);
    assert.ok(!out.includes('text-text'), `text-text should lose to text-primary: ${out.join(' ')}`);
  }
});

test('two sizes still merge: the later type-ramp step wins', () => {
  const out = withColour({ className: 'text-type-body text-type-caption' }).split(' ');
  assert.ok(out.includes('text-type-caption') && !out.includes('text-type-body'), out.join(' '));
  const mixed = withColour({ className: 'text-sm text-type-title' }).split(' ');
  assert.ok(mixed.includes('text-type-title') && !mixed.includes('text-sm'), mixed.join(' '));
});
