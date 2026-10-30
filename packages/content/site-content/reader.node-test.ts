import test from 'node:test';
import assert from 'node:assert/strict';
import { blockImage, orderedSectionKeys, parseSitePage, readSitePage, sectionFor, sectionText } from './reader.ts';

const doc = (overrides: Record<string, unknown> = {}) => ({ id: 1, route: '/', title: 'Home', _status: 'published', sections: [{ sectionKey: 'world', label: 'World', copy: [{ key: 'title', label: 'Title', value: 'Changed title' }], content: [] }], ...overrides });
const media = { id: 7, url: 'https://cdn.example.test/a.webp', mimeType: 'image/webp', alt: 'A Mon', width: 100, height: 80 };
test('parses published content and preserves page/section identity', () => {
  const page = parseSitePage(doc());
  assert.equal(page?.route, '/');
  assert.equal(sectionText(sectionFor(page, 'world'), 'title', 'Original'), 'Changed title');
});
for (const status of ['draft', 'changed', null, undefined]) test(`rejects non-published response ${status}`, () => assert.equal(parseSitePage(doc({ _status: status })), null));
test('rejects duplicate section identities', () => assert.equal(parseSitePage(doc({ sections: [{ sectionKey: 'hero' }, { sectionKey: 'hero' }] })), null));
test('empty authored copy does not resurrect fallback text', () => {
  const page = parseSitePage(doc({ sections: [{ sectionKey: 'hero', copy: [{ key: 'body', value: '' }] }] }));
  assert.equal(sectionText(sectionFor(page, 'hero'), 'body', 'fallback'), '');
});
test('authored section list controls removal without resurrecting legacy sections', () => assert.deepEqual(orderedSectionKeys(parseSitePage(doc()), ['hero', 'world', 'hatch']), ['world']));
test('legacy page keeps original order only when CMS is not active', () => assert.deepEqual(orderedSectionKeys(null, ['hero', 'world']), ['hero', 'world']));
test('complete layout permits intentional reordering', () => assert.deepEqual(orderedSectionKeys(parseSitePage(doc({ sections: [{ sectionKey: 'world' }, { sectionKey: 'hero' }] })), ['hero', 'world']), ['world', 'hero']));
test('unknown block types cannot reach the renderer', () => {
  const page = parseSitePage(doc({ sections: [{ sectionKey: 'hero', content: [{ blockType: 'html', html: '<script>' }, { blockType: 'youtube', url: 'https://youtu.be/abcdefghijk' }] }] }));
  assert.deepEqual(page?.sections[0]?.content.map((block) => block.blockType), ['youtube']);
});
test('REST read is anonymous, uncached, exact-route and published-only', async () => {
  const fake: typeof fetch = async (input, options) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, '/payload-api/site-pages');
    assert.equal(url.searchParams.get('where[route][equals]'), '/');
    assert.equal(url.searchParams.get('where[_status][equals]'), 'published');
    assert.equal(url.searchParams.get('draft'), 'false');
    assert.equal(options?.credentials, 'omit');
    assert.equal(options?.cache, 'no-store');
    assert.equal(new Headers(options?.headers).has('authorization'), false);
    return Response.json({ docs: [doc()] });
  };
  assert.equal((await readSitePage('https://cms.example.test/payload-api/', '/', fake))?.title, 'Home');
});
test('HTTP failure is not silently treated as an empty page', async () => {
  await assert.rejects(() => readSitePage('https://cms.example.test/payload-api', '/', async () => new Response('', { status: 503 })), /503/);
});
test('empty collection has an explicit bootstrap fallback', async () => assert.equal(await readSitePage('https://cms.example.test/payload-api', '/', async () => Response.json({ docs: [] })), null));
test('wrong route cannot replace requested page', async () => assert.rejects(() => readSitePage('https://cms.example.test/payload-api', '/', async () => Response.json({ docs: [doc({ route: '/story' })] })), /Invalid published/));
test('draft accidentally returned by an upstream service is rejected', async () => assert.rejects(() => readSitePage('https://cms.example.test/payload-api', '/', async () => Response.json({ docs: [doc({ _status: 'draft' })] })), /Invalid published/));
test('remote CMS credentials and HTTP origins are rejected before fetching', async () => {
  for (const origin of ['http://cms.example.test', 'https://user:pass@cms.example.test', 'https://cms.example.test?key=secret']) {
    await assert.rejects(() => readSitePage(origin, '/', async () => { throw new Error('must not fetch'); }));
  }
});
test('image block reads populated media, alternative text and focal point', () => {
  assert.deepEqual(blockImage({ image: media, focalX: 2, focalY: -1, caption: 'Caption' }), { src: media.url, alt: media.alt, width: 100, height: 80, focalPoint: { x: 1, y: 0 }, caption: 'Caption' });
});
test('image without extracted dimensions still has a stable layout fallback', () => assert.equal(blockImage({ image: { ...media, width: undefined, height: undefined } })?.width, 1200));
test('unpopulated relationships, non-image MIME and unsafe URLs do not render', () => {
  for (const image of [7, { ...media, mimeType: 'image/svg+xml' }, { ...media, url: 'javascript:alert(1)' }, { ...media, url: 'https://user:secret@example.test/a.png' }]) assert.equal(blockImage({ image }), null);
});
test('decorative media explicitly uses empty alt; otherwise meaningful alt is required', () => {
  assert.equal(blockImage({ image: { ...media, alt: '' } }), null);
  assert.equal(blockImage({ image: media, decorative: true })?.alt, '');
  assert.equal(blockImage({ image: media, alt: 'New description' })?.alt, 'New description');
});
