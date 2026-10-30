import assert from 'node:assert/strict';
import test from 'node:test';
import { iframeEmbed, mediaPlacements, safeLink, safeRoute, sectionKeysAreUnique, youtubeEmbed } from './core.ts';

for (const route of ['/', '/story', '/how-it-works', '/legal/privacy']) {
  test(`route accepts ${route}`, () => assert.equal(safeRoute(route), route));
}
for (const route of ['//evil.test', '/admin', '/admin/users', '/api/x', '/auth/login', '/foo/../admin', '/bad?x=1', '/%61dmin', '/CAPS']) {
  test(`route rejects ${route}`, () => assert.equal(safeRoute(route), null));
}
test('route strips one trailing slash', () => assert.equal(safeRoute('/story/'), '/story'));
for (const value of ['javascript:alert(1)', 'data:text/html,x', '//evil.test', '/\\evil.test', 'https://user:pass@example.com', 'https://x.test/\nfoo']) {
  test(`link rejects ${JSON.stringify(value)}`, () => assert.equal(safeLink(value), null));
}
for (const value of ['/get', '/get?source=home', '#signup', 'https://example.com/a']) {
  test(`link accepts ${value}`, () => assert.equal(safeLink(value), value));
}
for (const url of ['https://youtu.be/abcdefghijk', 'https://www.youtube.com/watch?v=abcdefghijk', 'https://m.youtube.com/shorts/abcdefghijk', 'https://www.youtube-nocookie.com/embed/abcdefghijk']) {
  test(`YouTube accepts ${url}`, () => assert.equal(youtubeEmbed(url), 'https://www.youtube-nocookie.com/embed/abcdefghijk'));
}
for (const url of ['https://youtube.com.evil.test/watch?v=abcdefghijk', 'javascript:alert(1)', 'http://youtu.be/abcdefghijk', 'https://youtu.be/too-short', 'https://evil@youtube.com/watch?v=abcdefghijk']) {
  test(`YouTube rejects ${url}`, () => assert.equal(youtubeEmbed(url), null));
}
test('YouTube removes autoplay and preserves bounded start', () => assert.equal(youtubeEmbed('https://youtube.com/watch?v=abcdefghijk&autoplay=1&start=25'), 'https://www.youtube-nocookie.com/embed/abcdefghijk?start=25'));
const allowed = ['https://ui.example.com'];
test('iframe accepts an exact approved origin', () => assert.equal(iframeEmbed('https://ui.example.com/iframe.html?id=button', allowed), 'https://ui.example.com/iframe.html?id=button'));
for (const url of ['https://ui.example.com.evil.test/', 'https://other.example.com/', 'http://ui.example.com/', 'https://u:p@ui.example.com/', 'https://ui.example.com:8443/', 'https://ui.example.com/admin', 'https://ui.example.com/%61dmin/login', 'https://ui.example.com/payload-api/media']) {
  test(`iframe rejects ${url}`, () => assert.equal(iframeEmbed(url, allowed), null));
}
test('an empty iframe allowlist fails closed', () => assert.equal(iframeEmbed('https://ui.example.com/', []), null));
test('allowlist entries must be origins, not paths', () => assert.equal(iframeEmbed('https://ui.example.com/', ['https://ui.example.com/iframe.html']), null));
test('duplicate section keys rejected', () => assert.equal(sectionKeysAreUnique([{ sectionKey: 'hero' }, { sectionKey: 'hero' }]), false));
test('distinct stable section keys accepted', () => assert.equal(sectionKeysAreUnique([{ sectionKey: 'hero' }, { sectionKey: 'world' }]), true));
test('placement discovers galleries and populated uploads', () => {
  const page = { id: 1, route: '/', title: 'Home', sections: [{ sectionKey: 'world', label: 'World', content: [
    { blockType: 'image', image: 42 }, { blockType: 'gallery', images: [{ image: { id: 42 } }, { image: 99 }] },
  ] }] };
  const usage = mediaPlacements(page, '42');
  assert.equal(usage.length, 2);
  assert.deepEqual(usage.map((item) => item.field), ['content[0].image', 'content[1].images[0].image']);
  assert.ok(usage.every((item) => item.route === '/' && item.section === 'World'));
  assert.deepEqual(mediaPlacements(page, 100), []);
});
test('malformed placement data does not throw', () => {
  for (const value of [null, [], 'x', { sections: [null] }, { id: 1, sections: [null] }]) assert.deepEqual(mediaPlacements(value, 1), []);
});
