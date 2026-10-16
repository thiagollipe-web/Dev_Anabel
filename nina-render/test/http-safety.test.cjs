'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{Readable}=require('node:stream');
const {readJsonObject,readBytes,gate,ByteCache}=require('../http-safety.cjs');
test('reject JSON primitives and enforce a byte limit',async()=>{for(const json of ['null','[]','1','"text"'])await assert.rejects(()=>readJsonObject(Readable.from([Buffer.from(json)]),100),{status:400});await assert.rejects(()=>readBytes(Readable.from([Buffer.alloc(11)]),10),{status:413});});
test('preserve Unicode across network chunks',async()=>{const bytes=Buffer.from('{"nome":"ação"}');const object=await readJsonObject(Readable.from([...bytes].map(n=>Buffer.from([n]))),100);assert.equal(object.nome,'ação');});
test('concurrency gate has global and per-session caps',()=>{const enter=gate(3,2),a=enter('a'),b=enter('a');assert.throws(()=>enter('a'),{status:429});const c=enter('b');assert.throws(()=>enter('c'),{status:429});a();a();const d=enter('a');[b,c,d].forEach(fn=>fn());});
test('image cache respects its byte budget',()=>{const cache=new ByteCache(50);for(let i=0;i<100;i++)cache.set(i,'x'.repeat(20));assert(cache.bytes<=50);assert(cache.size<=2);});

test('forwarded addresses require explicit trusted ingress and a private peer',()=>{const {clientAddress}=require('../http-safety.cjs');const req={socket:{remoteAddress:'10.0.0.2'},headers:{'cf-connecting-ip':'203.0.113.4'}};assert.equal(clientAddress(req),'10.0.0.2');assert.equal(clientAddress(req,true),'203.0.113.4');req.socket.remoteAddress='198.51.100.4';assert.equal(clientAddress(req,true),'198.51.100.4');});
