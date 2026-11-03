import assert from 'node:assert/strict';
import test from 'node:test';
import { buttonClassName } from '../html/button-class.ts';
import { studioDomStyle, studioDirectionClass } from './style.ts';

test('portable control axis spacing becomes valid DOM geometry without mutating source', () => {
  const source = Object.freeze({ paddingHorizontal: 14, paddingVertical: 8, marginHorizontal: 3, minHeight: 44, borderWidth: 1, textAlignVertical: 'top' });
  assert.deepEqual(studioDomStyle(source), { paddingLeft: 14, paddingRight: 14, paddingTop: 8, paddingBottom: 8, marginLeft: 3, marginRight: 3, minHeight: 44, borderWidth: 1, borderStyle: 'solid' });
  assert.equal(source.paddingHorizontal, 14);
});
test('explicit edges override axis defaults and intentional border styles survive', () => {
  assert.deepEqual(studioDomStyle({ paddingHorizontal: 14, paddingLeft: 2, marginVertical: 6, marginBottom: 0, borderBottomWidth: 1, borderStyle: 'dashed' }), { paddingLeft: 2, paddingRight: 14, marginTop: 6, marginBottom: 0, borderBottomWidth: 1, borderStyle: 'dashed' });
});

test('button direction resolves to one caller utility after interop and important CSS', () => {
  assert.equal(buttonClassName(studioDirectionClass('row')), 'inline-flex flex-row');
  assert.equal(buttonClassName(studioDirectionClass('row-reverse')), 'inline-flex flex-row-reverse');
  assert.equal(buttonClassName(studioDirectionClass('column')), 'inline-flex flex-col');
  assert.equal(buttonClassName(studioDirectionClass('column-reverse')), 'inline-flex flex-col-reverse');
  assert.equal(buttonClassName('flex-row items-center'), 'inline-flex flex-row items-center');
  assert.equal(buttonClassName(), 'inline-flex flex-col');
});


test('RN numeric line heights stay pixels rather than DOM font-size multipliers', () => {
  const source = Object.freeze({ fontSize: 17, lineHeight: 29, textAlignVertical: 'top' });
  assert.deepEqual(studioDomStyle(source), { fontSize: 17, lineHeight: '29px' });
  assert.deepEqual(studioDomStyle({ fontSize: 19, lineHeight: 34 }), { fontSize: 19, lineHeight: '34px' });
  assert.equal(source.lineHeight, 29);
  assert.equal(studioDomStyle({ lineHeight: 'normal' }).lineHeight, 'normal');
  assert.equal(studioDomStyle({ lineHeight: '1.5' }).lineHeight, '1.5');
});
