/// <reference lib="webworker" />
import {allMeta,putMeta,deleteMeta,type Lease} from './storage';
const sw=globalThis as unknown as ServiceWorkerGlobalScope;
const SHELL='garden-shell-v1',MEDIA='garden-resources-v1';
interface ShellRecord {releaseId:string;keys:string[];at:number;entries?:Array<{url:string;sha256:string;bytes:number}>}
const hash=async(bytes:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
const safeStatic=(url:string)=>/^\/assets\/[a-zA-Z0-9/_-]+\.(?:js|css)$/.test(url)||/^\/assets\/garden\/(files|manifests)\/[a-f0-9]+\.(?:webp|png|mp3|wav|json)$/.test(url);
sw.addEventListener('install',event=>event.waitUntil(Promise.resolve()));
// Existing tabs retain their controller until a safe, explicit refresh.
sw.addEventListener('activate',event=>event.waitUntil(Promise.resolve()));
sw.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_GARDEN_UPDATE')event.waitUntil(sw.skipWaiting());if(event.data?.type==='PREPARE_GARDEN_SHELL'&&/^[a-f0-9]{24}$/.test(event.data.releaseId))event.waitUntil(prepareShell(event.data.releaseId).catch(()=>{}));});
async function prepareShell(releaseId:string){
 const response=await fetch(`/assets/garden/shells/${releaseId}.json`,{cache:'no-cache',credentials:'omit'});if(!response.ok)throw Error('shell');const manifest=await response.json() as {releaseId:string;entries:Array<{url:string;sha256:string;bytes:number}>};
 if(manifest.releaseId!==releaseId||!manifest.entries.some(e=>e.url==='/garden/index.html'))throw Error('shell manifest');
 const cache=await caches.open(SHELL),keys:string[]=[];
 for(const item of manifest.entries){if(item.url!=='/garden/index.html'&&!safeStatic(item.url))throw Error('shell path');const r=await fetch(item.url,{credentials:'omit',cache:'no-cache'});if(!r.ok)throw Error('shell fetch');const bytes=await r.clone().arrayBuffer();if(bytes.byteLength!==item.bytes||await hash(bytes)!==item.sha256)throw Error('shell integrity');const key=`/garden/__shell/${releaseId}${item.url}`;await cache.put(key,r);keys.push(key);}
 const byteCount=manifest.entries.reduce((n,e)=>n+e.bytes,0);
 await cache.put(`/garden/__complete/${releaseId}`,new Response(JSON.stringify({releaseId,keys,entries:manifest.entries,at:Date.now(),bytes:byteCount}),{headers:{'Content-Type':'application/json'}}));
 await putMeta('shell:'+releaseId,{bytes:byteCount,at:Date.now()}).catch(()=>{});
 const protectedReleases=new Set((await allMeta<Lease>('lease:').catch(()=>[])).filter(r=>r.value.expires>Date.now()).map(r=>r.value.releaseId));
 const markers=(await cache.keys()).filter(k=>new URL(k.url).pathname.startsWith('/garden/__complete/'));
 const versions=await Promise.all(markers.map(async key=>({key,value:await (await cache.match(key))!.json() as {releaseId:string;keys:string[];at:number}})));
 for(const old of versions.sort((a,b)=>b.value.at-a.value.at).slice(2)){if(protectedReleases.has(old.value.releaseId))continue;for(const key of old.value.keys)await cache.delete(key);await cache.delete(old.key);await deleteMeta('shell:'+old.value.releaseId).catch(()=>{});}
}
sw.addEventListener('fetch',event=>{const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==sw.location.origin||url.pathname.startsWith('/api/'))return;
 if(request.mode==='navigate'&&['/garden/','/garden/index.html','/garden'].includes(url.pathname)){
  event.respondWith((async()=>{try{return await fetch(request);}catch{try{
   const cache=await caches.open(SHELL);const markers=(await cache.keys()).filter(k=>new URL(k.url).pathname.startsWith('/garden/__complete/'));
   const candidates=await Promise.all(markers.map(async k=>({key:k,value:await (await cache.match(k))!.json() as ShellRecord})));
   for(const {value} of candidates.sort((a,b)=>b.value.at-a.value.at)){if(!value.entries)continue;let valid=true;for(const item of value.entries){const response=await cache.match(`/garden/__shell/${value.releaseId}${item.url}`);if(!response){valid=false;break;}const bytes=await response.arrayBuffer();if(bytes.byteLength!==item.bytes||await hash(bytes)!==item.sha256){valid=false;break;}}if(!valid)continue;const html=await cache.match(`/garden/__shell/${value.releaseId}/garden/index.html`);if(html)return html;}
   }catch{/* Cache failure must retain a usable offline explanation. */}
   return new Response('<!doctype html><meta charset="utf-8"><title>拼音花园</title><p>网络暂时断开，请联网后重新打开花园。存档不会因此被清除。</p><a href="/garden/">重新打开</a>',{status:503,headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store'}});
  }})());return;
 }
 if(safeStatic(url.pathname))event.respondWith((async()=>{try{
  const media=await caches.open(MEDIA),hit=await media.match(url.pathname);if(hit)return hit;
  const shell=await caches.open(SHELL);for(const key of await shell.keys())if(new URL(key.url).pathname.endsWith(url.pathname)){const r=await shell.match(key);if(r)return r;}
  }catch{/* Storage denial must not break an online page. */}
  return fetch(request);
 })());
});
