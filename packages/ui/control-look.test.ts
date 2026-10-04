import assert from 'node:assert/strict';
import test from 'node:test';
import { palette } from '@acme/theme';
import { DISABLED_FRAME_TONE, controlLook, frameTone, layoutClasses, outerLayout } from './control-look.ts';

test('no variant is the solid corner-cut face in the district tone', () => {
  assert.deepEqual(controlLook(undefined), { look: 'solid', tone: 'orange' });
  assert.deepEqual(controlLook(undefined, undefined, 'downtown'), { look: 'solid', tone: 'royal' });
  assert.deepEqual(controlLook('cornerCut', 'leaf'), { look: 'solid', tone: 'leaf' });
  assert.deepEqual(controlLook('neon', undefined, 'harlem'), { look: 'solid', tone: 'brick' });
  assert.deepEqual(controlLook('primary'), { look: 'solid', tone: 'orange' });
});

test('legacy variants map to neon looks', () => {
  assert.deepEqual(controlLook('outline'), { look: 'outline', tone: 'orange' });
  assert.deepEqual(controlLook('ghost', undefined, 'megacity'), { look: 'ghost', tone: 'carolina' });
  assert.deepEqual(controlLook('danger', 'leaf', 'downtown'), { look: 'solid', tone: 'apple' });
});

test('accent takes the district second voice unless a tone is given', () => {
  assert.deepEqual(controlLook('accent'), { look: 'solid', tone: 'royal' });
  assert.deepEqual(controlLook('accent', undefined, 'downtown'), { look: 'solid', tone: 'carolina' });
  assert.deepEqual(controlLook('accent', undefined, 'harlem'), { look: 'solid', tone: 'apple' });
  assert.deepEqual(controlLook('accent', 'leaf'), { look: 'solid', tone: 'leaf' });
});

test('brick outlines lift to the control-border step', () => {
  assert.equal(frameTone('outline', 'brick'), palette.orange[700]);
  assert.equal(frameTone('solid', 'brick'), palette.orange[800]);
  assert.equal(frameTone('outline', 'royal'), 'royal');
  assert.equal(DISABLED_FRAME_TONE, palette.ink[700]);
});

test('layoutClasses keeps only the classes that size the control in its parent', () => {
  assert.equal(layoutClasses(undefined), '');
  assert.equal(layoutClasses('flex-1'), 'flex-1');
  assert.equal(layoutClasses('flex-[2]'), 'flex-[2]');
  assert.equal(layoutClasses('w-full opacity-50'), 'w-full');
  assert.equal(layoutClasses('mt-2 self-stretch flex-row'), 'self-stretch');
});

test('outerLayout lets a caller align the button', () => {
  assert.equal(outerLayout(undefined), 'self-start');
  assert.equal(outerLayout('flex-1 mt-2'), 'self-start flex-1');
  assert.equal(outerLayout('self-end'), 'self-end');
});

test('cta is the orange solid face whatever the tone or district', () => {
  assert.deepEqual(controlLook('cta'), { look: 'solid', tone: 'orange' });
  assert.deepEqual(controlLook('cta', 'royal', 'downtown'), { look: 'solid', tone: 'orange' });
});
