import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareNativeDropdown, selectNativeDropdown } from './NativeDropdown.model.ts';

const groups = [
  { id: 'normal', label: 'Standard', options: [
    { value: 'normal', label: 'Normal', supportingText: 'Show source pixels' },
    { value: 'multiply', label: 'Multiply', supportingText: 'Multiply layer channels' },
  ] },
  { id: 'special', label: 'Effects', options: [
    { value: 'screen', label: 'Screen' },
    { value: 'unsupported', label: 'Unavailable', disabled: true },
  ] },
] as const;

test('multiple grouped choices retain deterministic order and selected item', () => {
  const m = prepareNativeDropdown(groups, 'multiply');
  assert.equal(m.groups.length, 2);
  assert.deepEqual(m.options.map(x=>x.value), ['normal', 'multiply', 'screen', 'unsupported']);
  assert.equal(m.selected?.supportingText, 'Multiply layer channels');
});

test('invalid values do not become fabricated selected choices', () => {
  const m = prepareNativeDropdown(groups, 'missing');
  assert.equal(m.selected, null);
  assert.equal(m.options.length, 4);
});

test('only one supported, changed value dispatches a selection', () => {
  const calls:string[] = [];
  const model = prepareNativeDropdown(groups, 'normal');
  for(const choice of ['normal', 'missing', 'unsupported']){
    assert.equal(selectNativeDropdown(model, 'normal', choice, v => calls.push(v)),false);
  }
  assert.equal(selectNativeDropdown(model, 'normal', 'screen', v => calls.push(v)),true);
  assert.deepEqual(calls,['screen']);
});

test('groups and option values have stable unique identifiers', () => {
  assert.throws(()=> prepareNativeDropdown([{...groups[0],options:[]}],''),RangeError);
  assert.throws(()=> prepareNativeDropdown([groups[0],groups[0]],''),RangeError);
  assert.throws(()=> prepareNativeDropdown([{id:'bad',options:[
    {value:'same',label:'One'},{value:'same',label:'Two'}]}],'same'),RangeError);
  assert.throws(()=> prepareNativeDropdown([],'none'),RangeError);
});
