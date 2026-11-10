import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const origin=process.argv[2];assert(origin&&/^https?:\/\//.test(origin),'Usage: node scripts/check-garden-resource-http.mjs https://garden.example');
const root=new URL(origin);const digest=b=>createHash('sha256').update(b).digest('hex');
async function get(url){const r=await fetch(new URL(url,root),{signal:AbortSignal.timeout(60000)});assert(r.ok,`${url}: HTTP ${r.status}`);return r;}
for(const url of ['/','/garden/','/garden/sw.js','/resource-release.json']){const r=await get(url);assert(/no-cache/.test(r.headers.get('Cache-Control')??''),`${url}: no-cache required`);}
const pointer=await (await get('/resource-release.json')).json(),manifestResponse=await get(pointer.url),manifestBytes=Buffer.from(await manifestResponse.arrayBuffer());assert.equal(digest(manifestBytes),pointer.sha256,'Manifest integrity');
const manifest=JSON.parse(manifestBytes.toString()),queue=[...new Map(Object.values(manifest.resources).map(r=>[r.url,r])).values()];
async function worker(){while(queue.length){const item=queue.shift();const response=await get(item.url);assert.equal(response.headers.get('Content-Type')?.split(';')[0],item.mime,item.url+' MIME');assert(/immutable/.test(response.headers.get('Cache-Control')??''),item.url+' immutable cache header');const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,item.bytes,item.url+' size');assert.equal(digest(bytes),item.sha256,item.url+' digest');}}
await Promise.all(Array.from({length:4},worker));
const missing=await fetch(new URL('/assets/garden/files/'+'0'.repeat(64)+'.webp',root));assert.equal(missing.status,404,'Missing asset must return 404');assert(!/immutable/.test(missing.headers.get('Cache-Control')??''),'Do not cache missing files forever');
const local=JSON.parse(await readFile(new URL('../web/dist-garden/resource-release.json',import.meta.url),'utf8'));assert.equal(local.releaseId,pointer.releaseId,'Remote publication must match this build');
console.log(`Verified ${Object.keys(manifest.resources).length} production resources, entry cache headers, hashes, MIME and real 404s for ${pointer.releaseId}`);
