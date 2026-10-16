'use strict';
const {StringDecoder}=require('node:string_decoder');
class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
async function readBytes(stream,maxBytes){
 let bytes=0;const chunks=[];
 for await(const chunk of stream){bytes+=chunk.length;if(bytes>maxBytes)throw new HttpError(413,'Limite de tamanho excedido.');chunks.push(chunk);}
 return Buffer.concat(chunks,bytes);
}
async function readJsonObject(req,maxBytes){
 const bytes=await readBytes(req,maxBytes);const decoder=new StringDecoder('utf8');let value;
 try{value=JSON.parse(decoder.write(bytes)+decoder.end());}catch{throw new HttpError(400,'JSON inválido.');}
 if(!value||typeof value!=='object'||Array.isArray(value))throw new HttpError(400,'Envie um objeto JSON.');return value;
}
function requireString(value,name,max){if(typeof value!=='string'||!value.trim()||value.length>max)throw new HttpError(400,'Campo inválido: '+name);return value;}
function gate(maxTotal=4,maxPerSession=2){let total=0;const active=new Map();return key=>{const n=active.get(key)||0;if(total>=maxTotal||n>=maxPerSession)throw new HttpError(429,'Há tarefas em andamento. Aguarde.');total++;active.set(key,n+1);let released=false;return()=>{if(released)return;released=true;total--;const left=(active.get(key)||1)-1;if(left)active.set(key,left);else active.delete(key);};};}
function cachedFetch(fetcher,maxBytes=2000000){const pending=new Map();return async url=>{if(pending.has(url))return pending.get(url);const promise=(async()=>{const r=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(20000)});if(!r.ok)throw new HttpError(502,'Dependência indisponível.');return readBytes(r.body,maxBytes);})();pending.set(url,promise);try{return await promise;}finally{pending.delete(url);}};}
module.exports={HttpError,readBytes,readJsonObject,requireString,gate,cachedFetch};
class ByteCache{
 constructor(maxBytes=33554432,ttl=600000){this.maxBytes=maxBytes;this.ttl=ttl;this.bytes=0;this.items=new Map();}
 get size(){return this.items.size;}keys(){return this.items.keys();}
 delete(key){const old=this.items.get(key);if(old){this.bytes-=old.bytes;this.items.delete(key);}}
 get(key){const item=this.items.get(key);if(!item)return undefined;if(item.until<Date.now()){this.delete(key);return undefined;}this.items.delete(key);this.items.set(key,item);return item.value;}
 has(key){return this.get(key)!==undefined;}
 set(key,value){const bytes=Buffer.byteLength(JSON.stringify(value));this.delete(key);if(bytes>this.maxBytes)return this;while(this.bytes+bytes>this.maxBytes)this.delete(this.items.keys().next().value);this.items.set(key,{value,bytes,until:Date.now()+this.ttl});this.bytes+=bytes;return this;}
}
module.exports.ByteCache=ByteCache;
function clientAddress(req,trustRenderEdge=false){
 const peer=String(req.socket.remoteAddress||'').replace(/^::ffff:/,'');
 const privatePeer=/^(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(peer)||peer==='::1'||/^(?:fc|fd|fe80:)/i.test(peer);
 const client=req.headers['cf-connecting-ip'];
 // Enabled only behind the configured Render/Cloudflare ingress, never for direct public peers.
 if(trustRenderEdge&&privatePeer&&typeof client==='string'&&require('node:net').isIP(client))return client;
 return peer;
}
module.exports.clientAddress=clientAddress;
