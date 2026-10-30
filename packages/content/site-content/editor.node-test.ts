import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFields, copyFor } from './copy.ts';
import { parseSitePage, blockImage } from './reader.ts';
import { safeRoute, iframeEmbed } from './core.ts';
import { signPreview, verifyPreview, previewOrigin } from './preview.ts';
import { validateWebsiteSeed } from './seed.ts';
const section = (copy: { key: string; value: string }[]) => parseSitePage({ id: 1, title: 'Test', route: '/', _status: 'published', sections: [{ sectionKey: 'hero', label: 'Hero', copy, content: [] }] })!.sections[0]!;
test('copy overlay changes nested strings and intentionally empty text, not structural identities or counts', () => {
 const defaults = { title: 'Old', items: [{ id: 'keep', label: 'Old label', href: '/city', count: 3 }] };
 const updated = copyFor(section([{ key: 'title', value: '' }, { key: 'items.0.label', value: 'New label' }, { key: 'items.0.id', value: 'replace' }, { key: 'items.0.count', value: '99' }, { key: 'items.1.label', value: 'extra' }]), defaults);
 assert.deepEqual(updated, { title: '', items: [{ id: 'keep', label: 'New label', href: '/city', count: 3 }] });
 assert.equal(defaults.title, 'Old');
});
test('copy flattening and overlay have matching paths including arrays and prefixes', () => {
 const defaults = { body: 'Original', items: [{ id: 'no-edit', text: 'One' }], format: (x: string) => x };
 const rows = copyFields(defaults, 'panel');
 assert.deepEqual(rows.map(r => r.key), ['panel.body', 'panel.items.0.text']);
 const edited = copyFor(section(rows.map(r => ({ ...r, value: `${r.value}!` }))), defaults, 'panel');
 assert.equal(edited.items[0]!.text, 'One!'); assert.equal(edited.format, defaults.format);
});
for (const unsafe of ['javascript:alert(1)', '//evil.test', 'data:text/html,<script>', 'https://u:p@example.com']) test(`copy cannot introduce unsafe link ${unsafe}`, () => assert.equal(copyFor(section([{ key: 'href', value: unsafe }]), { href: '/city' }).href, '/city'));
for (const route of ['/cms-preview', '/cms-preview/fake', '/admin', '/api', '/payload-api', '/auth']) test(`reserved route ${route} is not editable content`, () => assert.equal(safeRoute(route), null));
test('preview routes cannot be embedded even on an approved origin', () => assert.equal(iframeEmbed('https://site.test/cms-preview/token', ['https://site.test']), null));
const secret = 'test-secret-which-is-at-least-thirty-two-characters';
const now = 1793334000000;
const scope = { id: '123', editor: '456', route: '/story', audience: 'https://site.test' };
test('preview capability is scoped to page, editor and exact website origin', () => {
 const token=signPreview(scope,secret,now); const claim=verifyPreview(token,secret,scope.audience,now+1000);
 assert.equal(claim?.id,scope.id); assert.equal(claim?.editor,scope.editor); assert.equal(claim?.route,scope.route);
 assert.equal(verifyPreview(token,secret,'https://other.test',now),null);
 assert.equal(verifyPreview(token,'a-different-secret-which-is-also-long-enough',scope.audience,now),null);
 assert.equal(verifyPreview(token,secret,scope.audience,now+900000),null);
 assert.equal(verifyPreview(token,secret,scope.audience,now-31000),null);
});
test('tampered preview payload and malformed token fail closed', () => {
 const token=signPreview(scope,secret,now); const [body = '',sig = '']=token.split('.');
 const changed=Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(body,'base64url').toString()), id:'999'})).toString('base64url');
 for(const value of [`${changed}.${sig}`, token+'x', 'malformed', 'x'.repeat(5000)]) assert.equal(verifyPreview(value,secret,scope.audience,now),null);
});
test('weak preview secrets are never issued', () => assert.throws(()=>signPreview(scope,'short',now)));
for(const origin of ['http://remote.test','https://u:p@site.test','https://site.test/admin','https://site.test?x=1']) test(`invalid preview origin ${origin}`,()=>assert.throws(()=>previewOrigin(origin)));
test('Payload 4 original image dimensions are preserved',()=>assert.equal(blockImage({image:{id:1,mimeType:'image/webp',url:'https://cdn.test/a.webp',alt:'Photo',original:{width:640,height:480}}})?.width,640));
const seed = () => ({schemaVersion:2,pages:[{page:{title:'Home',route:'/',_status:'draft',seo:{title:'Home',description:'Original'},sections:[{sectionKey:'hero',label:'Hero',hidden:false,copy:[{key:'title',label:'Headline',value:'Original'}],content:[]}]},assets:[{sectionKey:'hero',slot:'hero',source:'https://site.test/_next/static/media/hero.webp',alt:'Photo',decorative:false,width:1200,height:800,focalX:0.5,focalY:0.5,caption:''}]}]});
test('seed validation returns an independent copy of a draft-only manifest',()=>{const input=seed();const validated=validateWebsiteSeed(input,'https://site.test');validated[0]!.page.title='Changed';assert.equal(input.pages[0]!.page.title,'Home');});
for(const source of ['https://evil.test/home/a.webp','https://site.test/admin','https://site.test/home/%2e%2e/admin','http://site.test/home/a.webp']) test(`seed rejects untrusted asset ${source}`,()=>{const input=seed();input.pages[0]!.assets[0]!.source=source;assert.throws(()=>validateWebsiteSeed(input,'https://site.test'));});
test('seed rejects published pages, duplicate routes, duplicate sections and fields',()=>{
 const a=seed();a.pages[0]!.page._status='published';assert.throws(()=>validateWebsiteSeed(a,'https://site.test'));
 const b=seed();b.pages.push(structuredClone(b.pages[0]!));assert.throws(()=>validateWebsiteSeed(b,'https://site.test'));
 const c=seed();c.pages[0]!.page.sections.push(structuredClone(c.pages[0]!.page.sections[0]!));assert.throws(()=>validateWebsiteSeed(c,'https://site.test'));
 const d=seed();d.pages[0]!.page.sections[0]!.copy.push({key:'title',label:'Duplicate',value:'No'});assert.throws(()=>validateWebsiteSeed(d,'https://site.test'));
});
test('seed rejects relationship injection and unknown placements',()=>{
 const a=seed();(a.pages[0]!.page.sections[0]!.content as unknown[]).push({blockType:'image',image:1});assert.throws(()=>validateWebsiteSeed(a,'https://site.test'));
 const b=seed();b.pages[0]!.assets[0]!.sectionKey='unknown';assert.throws(()=>validateWebsiteSeed(b,'https://site.test'));
});
test('local asset source is explicit-test-only',()=>{const input=seed();input.pages[0]!.assets[0]!.source='http://localhost:3000/home/a.webp';assert.throws(()=>validateWebsiteSeed(input,'http://localhost:3000'));assert.equal(validateWebsiteSeed(input,'http://localhost:3000',true).length,1);});
