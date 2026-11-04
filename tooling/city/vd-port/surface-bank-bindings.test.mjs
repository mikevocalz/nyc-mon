import test from 'node:test';
import assert from 'node:assert/strict';
import {surfaceBankBindings} from './surface-bank-bindings.mjs';
const base={sha256:'a'.repeat(64),format:1023,type:1009,width:2,height:2,wrapS:1000};
const capture={tiles:[{textures:[{...base,uuid:'transient'}]}]};
const bank={textures:[{...base,uuid:'another',page:0,layer:0},{...base,uuid:'env:cityAO',page:1,layer:0},{...base,uuid:'pbr:brick:albedo',page:2,layer:0}]};
test('bank binding retains sampler matching and resolves semantic pages independently of transientUUID',()=>{
 const binding=surfaceBankBindings(capture,bank);
 assert.deepEqual(binding.semanticTextures.map(t=>[t.id,t.semantic]),[[1,'env:cityAO'],[2,'pbr:brick:albedo']]);
 assert.equal(binding.resolveTextureBinding({material:{},role:'map',initialBinding:{...base,texture:0}}).page,0);
 const actual=binding.resolveTextureBinding({material:{pbr:{set:'brick'}},role:'pbAlb',uniform:{texture:'placeholder'},initialBinding:{texture:0}});
 assert.equal(actual.page,2);assert.equal(actual.texture,2);
 assert.equal(binding.resolveTextureBinding({material:{},role:'pbCAO',uniform:{dynamic:'cityAO'},initialBinding:{texture:0}}).texture,1);
 assert.throws(()=>binding.resolveTextureBinding({material:{},role:'map',initialBinding:{...base,wrapS:1001,texture:0}}),/page missing/);
 assert.throws(()=>binding.resolveTextureBinding({material:{pbr:{set:'absent'}},role:'pbAlb',initialBinding:{texture:0}}),/resource missing/);
});
