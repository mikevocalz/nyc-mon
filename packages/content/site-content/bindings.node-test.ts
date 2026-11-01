import assert from 'node:assert/strict';
import {test} from 'node:test';
import {copyTree, copyRows, copyGroups} from './bindings.ts';
import {signPreview,verifyPreview,previewOrigin,previewTarget} from './preview.ts';
import type {SitePage,SiteSection} from './reader.ts';
const section=(copy: Record<string,string>):SiteSection=>({sectionKey:'hero',label:'Hero',hidden:false,copy:Object.entries(copy).map(([key,value])=>({key,value,label:key})),content:[]});
test('copy changes are page-scoped and leave authored objects and identifiers alone',()=>{
 const original={title:'Before',id:'stable',items:[{name:'One',tone:'orange'}]};
 const actual=copyTree(original,section({title:'After',id:'broken','items.0.name':'Two','items.0.tone':'blue'}));
 assert.deepEqual(actual,{title:'After',id:'stable',items:[{name:'Two',tone:'orange'}]});assert.equal(original.title,'Before');
});
test('blank text removes optional copy without accidentally reviving fallback',()=>assert.equal(copyTree({title:'Old'},section({title:''})).title,''));
test('strings remain strings, never evaluated markup',()=>assert.equal(copyTree({title:'Old'},section({title:'<script>alert(1)</script>'})).title,'<script>alert(1)</script>'));
test('unsafe edited link schemes are rejected, safe site links survive',()=>{
 assert.equal(copyTree({href:'/safe'},section({href:'javascript:alert(1)'})).href,'/safe');
 assert.equal(copyTree({href:'/safe'},section({href:'/story'})).href,'/story');
});
test('format functions accept only positional text templates',()=>{
 const result=copyTree({greet:(name:string)=>`Hi ${name}`},section({greet:'Welcome {0}!'}));assert.equal(result.greet('Mon'),'Welcome Mon!');
});
test('copy flattening preserves real words and stable array keys',()=>assert.deepEqual(copyRows({id:'x',title:'Hi',list:['One','Two']}),[{key:'title',label:'title',value:'Hi'},{key:'list.0',label:'list / 0',value:'One'},{key:'list.1',label:'list / 1',value:'Two'}]));
test('camel-case copy groups bind to named page sections',()=>{
 const page={sections:[{...section({title:'New'}),sectionKey:'clean-city'}]} as SitePage;
 assert.equal(copyGroups({cleanCity:{title:'Old'}},page).cleanCity.title,'New');
});
const secret='preview-unit-test-only-32-characters-long';const now=1_793_330_000_000;
const input={id:'12',actor:'7',route:'/story',audience:'https://site.example'};
test('preview grant is scoped to one page and one audience',()=>{
 const token=signPreview(input,secret,now);assert.equal(verifyPreview(token,secret,input.audience,now)?.id,'12');assert.equal(verifyPreview(token,secret,'https://other.example',now),null);
});
test('tampered signature and payload are rejected',()=>{
 const token=signPreview(input,secret,now);assert.equal(verifyPreview(`X${token}`,secret,input.audience,now),null);assert.equal(verifyPreview(token,secret+'wrong',input.audience,now),null);
});
test('expired or future grants never authorize draft reads',()=>{
 const token=signPreview(input,secret,now);assert.equal(verifyPreview(token,secret,input.audience,now+600000),null);assert.equal(verifyPreview(token,secret,input.audience,now-60000),null);
});
test('malformed token, weak secret and untrusted origins fail closed',()=>{
 for(const token of ['', '..', 'x'.repeat(5000)]) assert.equal(verifyPreview(token,secret,input.audience,now),null);
 assert.throws(()=>signPreview(input,'short',now));assert.throws(()=>previewOrigin('http://untrusted.example'));assert.throws(()=>previewOrigin('https://user:pass@example.com'));
});
test('shared shell preview lands on Home without exposing a fake route',()=>{
 const grant=verifyPreview(signPreview({...input,route:'/website-shell'},secret,now),secret,input.audience,now)!;assert.equal(previewTarget(grant),'/');
});
