import catalog from 'virtual:garden-resources';
import type {Catalog,Diagnostic,Progress,Resource} from './types';
import {RESOURCE_CACHE,SHELL_CACHE,allMeta,putMeta,deleteMeta,protectedUrls,type Lease} from './storage';
export {catalog};
export const abortError=()=>new DOMException('操作已取消','AbortError');
export async function sha256(data:ArrayBuffer|Uint8Array){const bytes=data instanceof Uint8Array?data:new Uint8Array(data);return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource)),n=>n.toString(16).padStart(2,'0')).join('');}
export async function verify(resource:Pick<Resource,'bytes'|'sha256'>,data:Uint8Array){if(data.length!==resource.bytes||await sha256(data)!==resource.sha256)throw Error('素材校验未通过');}
export function abortable<T>(promise:Promise<T>,signal?:AbortSignal):Promise<T>{if(!signal)return promise;if(signal.aborted)return Promise.reject(abortError());return new Promise((resolve,reject)=>{const cancel=()=>{cleanup();reject(abortError());};const cleanup=()=>signal.removeEventListener('abort',cancel);signal.addEventListener('abort',cancel,{once:true});promise.then(v=>{cleanup();resolve(v);},e=>{cleanup();reject(e);});});}
export async function fetchTimed(url:string,init:RequestInit={},ms=15000){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{return await fetch(url,{...init,signal:c.signal});}finally{clearTimeout(t);}}
const delay=(ms:number,signal:AbortSignal)=>abortable(new Promise<void>(r=>setTimeout(r,ms)),signal);
class Scheduler {
 private active=0;private background=0;private queue:Array<{priority:number;run:()=>Promise<unknown>;resolve:(v:unknown)=>void;reject:(e:unknown)=>void}>=[];
 schedule<T>(priority:number,run:()=>Promise<T>):Promise<T>{return new Promise((resolve,reject)=>{this.queue.push({priority,run,resolve:resolve as (v:unknown)=>void,reject});this.queue.sort((a,b)=>a.priority-b.priority);this.pump();});}
 private pump(){while(this.active<4){const i=this.queue.findIndex(t=>t.priority===0||this.background===0);if(i<0)return;const task=this.queue.splice(i,1)[0];this.active++;if(task.priority)this.background++;void task.run().then(task.resolve,task.reject).finally(()=>{this.active--;if(task.priority)this.background--;this.pump();});}}
}
const sharedScheduler=new Scheduler();
interface Entry {url:string;refs:number;data?:Uint8Array;src?:string;image?:HTMLImageElement;pending?:Promise<void>;controller?:AbortController;priority:number}
const sharedEntries=new Map<string,Entry>();
const imageDecoder:{queue:Promise<unknown>}={queue:Promise.resolve()};
export class ResourceManager {
 readonly catalog:Catalog;private entries=sharedEntries;private scheduler=sharedScheduler;
 private listeners=new Set<()=>void>();private sequence=0;private log:Diagnostic[]=[];private persistent:'stored'|'memory-only'|'unavailable'='stored';
 private tab=typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Math.random().toString(36);private backgroundController:AbortController|null=null;private lastCheck=0;
 private newer:Catalog|null=null;private checking:Promise<void>|null=null;private cacheBusy=false;private prefetchProgress:Progress={completed:0,total:0,phase:'ready'};private booted=false;private battling=false;
 constructor(value:Catalog=catalog){this.catalog=value;}
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 snapshot=()=>this.sequence;
 private changed(){this.sequence++;this.listeners.forEach(fn=>fn());}
 diagnostic(phase:string,detail:Omit<Diagnostic,'at'|'phase'>={}){this.log.push({at:new Date().toISOString(),phase,...detail});if(this.log.length>100)this.log.shift();}
 diagnostics(){return {releaseId:this.catalog.releaseId,appBuildId:this.catalog.appBuildId,persistence:this.persistent,memory:{entries:this.entries.size,blobs:[...this.entries.values()].filter(e=>e.src).length,bytes:[...this.entries.values()].reduce((n,e)=>n+(e.data?.byteLength??0),0)},records:this.log.slice()};}
 setBattleActive(value:boolean){this.battling=value;if(value)this.pausePrefetch();}
 status(){return {releaseId:this.catalog.releaseId,persistence:this.persistent,newer:this.newer?.releaseId??null,prefetch:this.prefetchProgress,busy:this.cacheBusy};}
 resource(id:string):Resource {const full=id.startsWith('/')?id:'/assets/pinyin-garden/'+id;const direct=this.catalog.resources[full];if(direct)return direct;const hash=[...this.entries].find(([,e])=>e.src===id)?.[0];const r=this.catalog.resources[full]??Object.values(this.catalog.resources).find(r=>r.url===id||r.sha256===hash);if(!r)throw Error('未登记的游戏素材');return r;}
 url(id:string){const r=this.resource(id);return this.entries.get(r.sha256)?.src??r.url;}
 group(id:string){const group=this.catalog.groups[id];if(!group)throw Error('资源组不存在');return group;}
 private failedStorage(){if(this.persistent!=='memory-only'){this.persistent='memory-only';this.changed();}}
 private async cache(){try{if(typeof caches==='undefined')throw Error('Cache API unavailable');return await caches.open(RESOURCE_CACHE);}catch{this.persistent='unavailable';this.changed();return null;}}
 private networkUrl(url:string){const base=import.meta.env.VITE_GARDEN_ASSET_BASE_URL as string|undefined;return base?base.replace(/\/$/,'')+url:url;}
 private async fetchFile(r:Resource,signal:AbortSignal,force=false):Promise<Uint8Array>{
  const cacheStarted=performance.now(),cache=await this.cache();
  if(!force&&cache){try{const hit=await cache.match(r.url);if(hit){const data=new Uint8Array(await hit.arrayBuffer());this.diagnostic('cache-read',{resource:r.id,ms:Math.round(performance.now()-cacheStarted)});const verifiedAt=performance.now();await verify(r,data);this.diagnostic('verify',{resource:r.id,source:'cache',ms:Math.round(performance.now()-verifiedAt)});await putMeta('file:'+r.url,{bytes:r.bytes,url:r.url,lastAccess:Date.now(),releaseId:this.catalog.releaseId}).catch(()=>this.failedStorage());this.diagnostic('file',{resource:r.id,source:'cache'});return data;}}catch{await cache.delete(r.url).catch(()=>{});this.diagnostic('cache-invalid',{resource:r.id});}}
  for(let attempt=0;;attempt++){
   if(signal.aborted)throw abortError();const controller=new AbortController(),cancel=()=>controller.abort();signal.addEventListener('abort',cancel,{once:true});
   let stalled=setTimeout(cancel,20000);const total=setTimeout(cancel,60000),started=performance.now();
   let retry=true,retryAfter=0;
   try{
    if(typeof navigator!=='undefined'&&navigator.onLine===false)throw Error('网络已断开，请联网后重试');
    const response=await fetch(this.networkUrl(r.url),{signal:controller.signal,credentials:'omit',cache:attempt||force?'reload':'default'});
    if(!response.ok){retry=[408,429].includes(response.status)||response.status>=500;retryAfter=Math.min(30000,Math.max(0,Number(response.headers.get('Retry-After'))*1000||0));throw Error(`素材请求失败 (${response.status})`);}
    if(response.type==='opaque'||!response.headers.get('Content-Type')?.split(';')[0].startsWith(r.type==='image'?'image/':'audio/')){retry=false;throw Error('素材格式不正确');}
    const chunks:Uint8Array[]=[];let size=0;
    if(response.body){const reader=response.body.getReader();for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>r.bytes){await reader.cancel();retry=false;throw Error('素材大小不正确');}chunks.push(value);clearTimeout(stalled);stalled=setTimeout(cancel,20000);}}
    else {const b=new Uint8Array(await response.arrayBuffer());chunks.push(b);size=b.length;}
    const data=new Uint8Array(size);let pos=0;for(const chunk of chunks){data.set(chunk,pos);pos+=chunk.length;}
    const verifiedAt=performance.now();try{await verify(r,data);this.diagnostic('verify',{resource:r.id,source:'network',ms:Math.round(performance.now()-verifiedAt)});}catch(e){retry=attempt===0;throw e;}
    if(cache){try{await this.makeSpace(data.length);await cache.put(r.url,new Response(data.slice() as BodyInit,{headers:{'Content-Type':r.mime,'Content-Length':String(data.length)}}));await putMeta('file:'+r.url,{bytes:r.bytes,url:r.url,lastAccess:Date.now(),releaseId:this.catalog.releaseId});}catch{this.failedStorage();}}
    this.diagnostic('file',{resource:r.id,source:'network',ms:Math.round(performance.now()-started)});return data;
   }catch(e){if(signal.aborted)throw abortError();if(!retry||attempt>=2||typeof navigator!=='undefined'&&!navigator.onLine){this.diagnostic('file-failed',{resource:r.id,error:e instanceof Error?e.message:'素材请求失败'});if(controller.signal.aborted)throw Error('网络有些慢，请重试或回花园');throw e;}await delay(Math.max(retryAfter,(attempt?3000:1000)+Math.random()*200),signal);}
   finally{clearTimeout(stalled);clearTimeout(total);signal.removeEventListener('abort',cancel);}
  }
 }
 private async ensure(r:Resource,priority:number){
  let entry=this.entries.get(r.sha256);if(!entry){entry={url:r.url,refs:0,priority};this.entries.set(r.sha256,entry);}
  entry.priority=Math.min(entry.priority,priority);
  if(!entry.pending&&!entry.data){const current=entry;current.controller=new AbortController();current.pending=this.scheduler.schedule(priority,async()=>{current.data=await this.fetchFile(r,current.controller!.signal);}).finally(()=>{current.pending=undefined;current.controller=undefined;if(!current.refs)this.discard(r.sha256,current);});}
  await entry.pending;return entry;
 }
 private discard(key:string,entry:Entry){if(entry.refs||this.entries.get(key)!==entry)return;entry.controller?.abort();if(entry.src)URL.revokeObjectURL(entry.src);this.entries.delete(key);entry.data=undefined;entry.image=undefined;entry.src=undefined;}
 private async prepareImage(r:Resource,entry:Entry){if(entry.image)return;if(!entry.src)entry.src=URL.createObjectURL(new Blob([entry.data!.slice() as BlobPart],{type:r.mime}));
  const run=imageDecoder.queue.catch(()=>{}).then(async()=>{if(entry.image)return;const started=performance.now(),image=new Image();image.src=entry.src!;let timer:ReturnType<typeof setTimeout>|undefined;
   try{await Promise.race([image.decode(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('图片准备超时')),20000);})]);if(!image.naturalWidth)throw Error('图片无法解码');entry.image=image;this.diagnostic('image-decode',{resource:r.id,ms:Math.round(performance.now()-started)});}finally{clearTimeout(timer);}
  });
  imageDecoder.queue=run;await run;
 }
 async prepare(ids:string[],options:{signal?:AbortSignal;priority?:number;onProgress?:(progress:Progress)=>void}={}):Promise<()=>void>{
  const list=[...new Map(ids.map(id=>{const r=this.resource(id);return [r.sha256,r];})).values()],held:Resource[]=[];
  let released=false;const release=()=>{if(released)return;released=true;for(const r of held){const e=this.entries.get(r.sha256);if(e){e.refs--;if(!e.refs)this.discard(r.sha256,e);}}void this.lease();};
  try{
   for(const r of list){let e=this.entries.get(r.sha256);if(!e){e={url:r.url,refs:0,priority:options.priority??0};this.entries.set(r.sha256,e);}e.refs++;held.push(r);}
   let completed=0;options.onProgress?.({completed,total:list.length,phase:'loading'});void this.lease();
   await abortable(Promise.all(list.map(async r=>{const e=await this.ensure(r,options.priority??0);if(r.type==='image')await this.prepareImage(r,e);if(released||options.signal?.aborted)throw abortError();completed++;options.onProgress?.({completed,total:list.length,phase:'loading'});})),options.signal);
   return release;
  }catch(e){release();throw e;}
 }
 async bytes(id:string){const r=this.resource(id);let e=this.entries.get(r.sha256);if(!e){e={url:r.url,refs:0,priority:0};this.entries.set(r.sha256,e);}e.refs++;try{return (await this.ensure(r,0)).data!.slice().buffer as ArrayBuffer;}finally{e.refs--;if(!e.refs)this.discard(r.sha256,e);}}
 async lease(){try{const urls=[...this.entries].filter(([,e])=>e.refs>0).map(([,e])=>e.url);await putMeta('lease:'+this.tab,{urls,releaseId:this.catalog.releaseId,expires:Date.now()+86400000} satisfies Lease);}catch{this.failedStorage();}}
 private async makeSpace(incoming=0){
  const shells=await allMeta<{bytes:number}>('shell:');const shellBytes=shells.reduce((n,s)=>n+s.value.bytes,0);
  const files=await allMeta<{url:string;bytes:number;lastAccess:number}>('file:');let total=files.reduce((n,f)=>n+f.value.bytes,0),budget=150*1024**2;
  try{const estimate=await navigator.storage?.estimate();if(estimate?.quota&&estimate.usage!==undefined)budget=Math.min(budget,Math.max(0,estimate.quota-estimate.usage-5*1024**2+total));}catch{}
  if(total+shellBytes+incoming<=budget)return;const protectedSet=await protectedUrls(),cache=await this.cache();
  const releases=(await allMeta<{complete:boolean;at:number;urls:string[]}>('release:')).filter(r=>r.value.complete).sort((a,b)=>b.value.at-a.value.at);for(const r of releases.slice(0,2))r.value.urls?.forEach(url=>protectedSet.add(url));
  for(const item of files.sort((a,b)=>a.value.lastAccess-b.value.lastAccess)){if(protectedSet.has(item.value.url))continue;await cache?.delete(item.value.url);await deleteMeta(item.key);total-=item.value.bytes;if(total+shellBytes+incoming<=budget)return;}
  if(total+shellBytes+incoming>budget)throw Error('素材缓存空间不足');
 }
 async inspect(){const cache=await this.cache();let bytes=0,count=0;const currentUrls=new Set(Object.values(this.catalog.resources).map(r=>r.url));if(cache)for(const key of await cache.keys()){const hit=await cache.match(key);if(hit){bytes+=(await hit.arrayBuffer()).byteLength;if(currentUrls.has(new URL(key.url).pathname))count++;}}return {bytes,count,total:new Set(Object.values(this.catalog.resources).map(r=>r.url)).size};}
 async clear(){this.pausePrefetch();const protectedSet=await protectedUrls(),cache=await this.cache();let kept=0;if(cache)for(const key of await cache.keys()){const url=new URL(key.url).pathname;if(protectedSet.has(url)){kept++;continue;}await cache.delete(key);await deleteMeta('file:'+url).catch(()=>{});}try{const active=new Set((await allMeta<Lease>('lease:')).filter(r=>r.value.expires>Date.now()).map(r=>r.value.releaseId));active.add(this.catalog.releaseId);const shell=await caches.open(SHELL_CACHE);for(const marker of (await shell.keys()).filter(k=>new URL(k.url).pathname.startsWith('/garden/__complete/'))){const record=await (await shell.match(marker))!.json();if(active.has(record.releaseId))continue;for(const key of record.keys)await shell.delete(key);await shell.delete(marker);await deleteMeta('shell:'+record.releaseId);}}catch{this.failedStorage();}this.diagnostic('cache-cleared');this.changed();return kept;}
 pausePrefetch(){this.backgroundController?.abort();this.backgroundController=null;}
 async prefetchAll(explicit=false){
  if(this.backgroundController)return;const connection=(navigator as Navigator&{connection?:{saveData?:boolean;effectiveType?:string}}).connection;
  if(!explicit&&(this.battling||document.hidden||!navigator.onLine||connection?.saveData||/^(slow-)?2g$/.test(connection?.effectiveType??'')))return;
  const controller=new AbortController();this.backgroundController=controller;this.cacheBusy=true;const list=[...new Map([...this.group('garden-home'),...this.group('collection'),...this.group('all')].map(id=>[this.resource(id).sha256,id])).values()];
  this.prefetchProgress={completed:0,total:list.length,phase:'loading'};this.changed();
  try{for(let i=0;i<list.length;i++){if(controller.signal.aborted)throw abortError();if(!explicit&&document.hidden)throw abortError();const release=await this.prepare([list[i]],{priority:1,signal:controller.signal});release();this.prefetchProgress={completed:i+1,total:list.length,phase:'loading'};this.changed();if(this.persistent!=='stored')throw Error('缓存不可用，已暂停后台下载');}await putMeta('release:'+this.catalog.releaseId,{complete:true,at:Date.now(),urls:Object.values(this.catalog.resources).map(r=>r.url)}).catch(()=>this.failedStorage());this.prefetchProgress={...this.prefetchProgress,phase:'ready'};}
  catch(e){if((e as Error).name!=='AbortError')this.prefetchProgress={...this.prefetchProgress,phase:'failed',error:(e as Error).message};}
  finally{if(this.backgroundController===controller)this.backgroundController=null;this.cacheBusy=false;this.changed();}
 }
 async checkUpdate(force=false){if(this.checking)return this.checking;if(!force&&Date.now()-this.lastCheck<300000)return;this.lastCheck=Date.now();return this.checking=(async()=>{try{
  const response=await fetchTimed('/resource-release.json',{cache:'no-cache',credentials:'omit'});if(!response.ok)throw Error('更新信息暂不可用');const p=await response.json();if(p.schemaVersion!==1||!/^\/[a-zA-Z0-9/._-]+$/.test(p.url)||!/^([a-f0-9]{64})$/.test(p.sha256))throw Error('更新清单不兼容');if(p.releaseId===this.catalog.releaseId){this.newer=null;return;}
  const r=await fetchTimed(p.url,{cache:'no-cache',credentials:'omit'});if(!r.ok)throw Error('更新清单暂不可用');const data=await r.arrayBuffer();if(await sha256(data)!==p.sha256)throw Error('更新清单校验未通过');const next=JSON.parse(new TextDecoder().decode(data)) as Catalog;
  if(next.schemaVersion!==1||next.releaseId!==p.releaseId||!next.resources||!next.groups||!next.appBuildId)throw Error('更新清单不兼容');
  // Validate the complete declared publication without downloading every file.
  for(const file of Object.values(next.resources)){if(!/^\/assets\/garden\/files\/[a-f0-9]{64}\.(webp|png|mp3|wav)$/.test(file.url)||!file.url.includes(file.sha256))throw Error('更新素材地址不正确');}
  this.newer=next;this.diagnostic('update-available');const connection=(navigator as Navigator&{connection?:{saveData?:boolean;effectiveType?:string}}).connection;if(!this.battling&&!document.hidden&&navigator.onLine&&!connection?.saveData&&!/^(slow-)?2g$/.test(connection?.effectiveType??'')&&!this.backgroundController){const controller=new AbortController();this.backgroundController=controller;void this.stageUpdate(undefined,controller.signal,1).catch(()=>{}).finally(()=>{if(this.backgroundController===controller)this.backgroundController=null;});}
 }catch(e){this.diagnostic('update-check',{error:(e as Error).message});if(force)throw e;}finally{this.checking=null;this.changed();}})();}
 async stageUpdate(onProgress?:(p:Progress)=>void,signal?:AbortSignal,priority=0){if(!this.newer)throw Error('没有待更新的花园');const publication=this.newer;const next=new ResourceManager(publication);const release=await next.prepare(next.group('all'),{onProgress,signal,priority});release();await putMeta('release:'+publication.releaseId,{complete:true,at:Date.now(),urls:Object.values(publication.resources).map(r=>r.url)}).catch(()=>{});}
 boot(){if(this.booted||typeof window==='undefined')return;this.booted=true;const visibility=()=>{if(document.hidden)this.pausePrefetch();else{void this.checkUpdate();}};document.addEventListener('visibilitychange',visibility);window.addEventListener('online',()=>{void this.checkUpdate();});window.addEventListener('pagehide',()=>{this.pausePrefetch();void deleteMeta('lease:'+this.tab).catch(()=>{});});setInterval(()=>void this.lease(),60000);void this.checkUpdate();}
}
export const resources=new ResourceManager();
