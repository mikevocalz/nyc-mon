import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CompileProgressEvent,withCompileProgressEvent} from './compile-progress-event.ts';
const g=globalThis as {ProgressEvent?:unknown};
test('a browser native ProgressEvent stays installed during compilation',()=>{
 const previous=Object.getOwnPropertyDescriptor(g,'ProgressEvent');const native=function NativeProgressEvent(){};
 try{g.ProgressEvent=native;const release=withCompileProgressEvent();assert.equal(g.ProgressEvent,native);release();assert.equal(g.ProgressEvent,native);}
 finally{if(previous)Object.defineProperty(g,'ProgressEvent',previous);else delete g.ProgressEvent;}
});
test('Hermes compilation shares its shim until every active lease settles',()=>{
 const previous=Object.getOwnPropertyDescriptor(g,'ProgressEvent');
 try{delete g.ProgressEvent;const a=withCompileProgressEvent(),b=withCompileProgressEvent();assert.equal(g.ProgressEvent,CompileProgressEvent);a();a();assert.equal(g.ProgressEvent,CompileProgressEvent);b();assert.equal(g.ProgressEvent,undefined);}
 finally{if(previous)Object.defineProperty(g,'ProgressEvent',previous);else delete g.ProgressEvent;}
});
