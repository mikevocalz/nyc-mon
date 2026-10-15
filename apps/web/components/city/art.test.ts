import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
registerHooks({ load(url, context, nextLoad) {
  if (!url.endsWith('.webp')) return nextLoad(url, context);
  return { format: 'module', source: `export default ${JSON.stringify({ src: new URL(url).pathname, width: 1200, height: 800 })};`, shortCircuit: true };
} });
const { cityPhoto, cityPhotoHref, CITY_PHOTO_DISTRICTS } = await import('./art.ts');
const { cityAtlasMotion, CITY_MOTION_TARGETS } = await import('./motion.ts');

test('three existing real districts have local, accessible, credited photo references', () => {
  assert.deepEqual(CITY_PHOTO_DISTRICTS, ['downtown', 'midtown', 'harlem']);
  for (const district of CITY_PHOTO_DISTRICTS) {
    const photo = cityPhoto(district)!;
    assert.equal(photo.district, district);
    assert.ok(photo.width > 0 && photo.height > 0);
    assert.ok(photo.alt && photo.credit.author && photo.credit.sourceUrl);
    assert.match(photo.credit.license, /CC0|Public domain/);
    assert.ok(photo.sizes && photo.blurDataURL);
    assert.doesNotMatch(cityPhotoHref(photo.source), /^https?:/);
  }
});

test('fictional Mega City receives no new physical location or photograph', () => {
  assert.equal(cityPhoto('megacity'), null);
});

test('motion targets photos only and ends within the declared 780ms budget', () => {
  assert.deepEqual(CITY_MOTION_TARGETS, CITY_PHOTO_DISTRICTS);
  assert.equal(cityAtlasMotion.id, 'w03.atlas.settle');
  for (const track of cityAtlasMotion.tracks) {
    assert.deepEqual(track.to, { scale: 1 });
    assert.equal(track.repeat ?? 0, 0);
    assert.ok(track.atMs + track.durationMs <= 780);
    assert.deepEqual(Object.keys(cityAtlasMotion.initial[track.target]!), ['scale']);
  }
});

test('web photo URLs preserve bundler URLs and reject Metro-only numeric asset IDs', () => {
  assert.equal(cityPhotoHref('/nyc-mon/_next/static/photo.webp'), '/nyc-mon/_next/static/photo.webp');
  assert.equal(cityPhotoHref({ src: '/photo.webp', width: 1200, height: 800 }), '/photo.webp');
  assert.throws(() => cityPhotoHref(4), /web image source/);
});
