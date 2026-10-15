import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

// Node can't load .webp; stand in a Next-style StaticImageData for each import.
registerHooks({
  load(url, context, nextLoad) {
    if (!url.endsWith('.webp')) return nextLoad(url, context);
    const data = { src: new URL(url).pathname, width: 1200, height: 800 };
    return { format: 'module', source: `export default ${JSON.stringify(data)};`, shortCircuit: true };
  },
});

const { chapterNumber, placePhoto, splitTitle } = await import('./editorial.ts');

test('splitTitle breaks the approved headlines where a reader would', () => {
  assert.deepEqual(splitTitle('We killed them.'), ['We killed', 'them.']);
  assert.deepEqual(splitTitle('Declared gone, decades ago'), ['Declared gone,', 'decades ago']);
  assert.deepEqual(splitTitle('Every block has a legend.'), ['Every block', 'has a legend.']);
  assert.deepEqual(splitTitle('The City'), ['The', 'City']);
  assert.deepEqual(splitTitle('They came back.'), ['They came', 'back.']);
});

test('splitTitle always joins back to the copy', () => {
  for (const title of ['The city that stopped looking', 'The serum that missed', 'Three eras of one company', 'Who shares the streets', 'Harlem']) {
    assert.equal(splitTitle(title).join(' '), title);
  }
});

test('chapterNumber pads to two digits', () => {
  assert.equal(chapterNumber(0), '01');
  assert.equal(chapterNumber(6), '07');
});

test('placePhoto captions Mega City with the district alone', () => {
  const bridge = placePhoto('megacity-brooklyn-bridge-night', '100vw');
  assert.equal(bridge.district, 'megacity');
  assert.equal(bridge.caption?.place, undefined);
  assert.ok(bridge.alt.length > 0);
  assert.equal(placePhoto('harlem-apollo', '100vw').caption?.place, '125th St');
  assert.throws(() => placePhoto('nope', '100vw'));
});
