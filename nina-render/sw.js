'use strict';
const CACHE='nina-public-v7';
const PUBLIC=['/manifest.webmanifest','/icon-192.png','/icon-512.png'];
const OFFLINE=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nina — Sem conexão</title><style>body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#11131a;color:#ececf2;font:16px system-ui;padding:24px;box-sizing:border-box}main{max-width:360px}p{line-height:1.7;color:#b9bfd0}a{display:inline-block;padding:14px 20px;border-radius:12px;background:#c7b8ff;color:#211735;text-decoration:none}a:focus-visible{outline:3px solid white;outline-offset:4px}</style><main><h1>Você está sem conexão</h1><p>Reconecte-se para entrar ou conversar com a Nina. Suas conversas salvas neste navegador não foram apagadas.</p><a href="/">Tentar novamente</a></main></html>`;
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PUBLIC)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('nina-public-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 if(event.request.mode==='navigate'){
  event.respondWith(fetch(event.request).catch(()=>new Response(OFFLINE,{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"}})));
  return;
 }
 if(!PUBLIC.includes(url.pathname)||url.search)return;
 event.respondWith(caches.open(CACHE).then(async cache=>{
  const cached=await cache.match(event.request);
  if(cached)return cached;
  const response=await fetch(event.request);
  if(response.ok)await cache.put(event.request,response.clone());
  return response;
 }));
});
