import {readdir,readFile,stat} from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
const root=new URL('../web/dist-garden/',import.meta.url);
for(const entry of ['index.html','garden/index.html','admin/index.html']){
 const html=await readFile(new URL(entry,root),'utf8');
 const icon=html.match(/<link\b[^>]*rel="icon"[^>]*href="([^"]+)"/);
 assert(icon,`Missing favicon declaration in ${entry}`);
 const iconPath=icon[1].split('?')[0];
 assert(iconPath.startsWith('/assets/'),'Favicon must use a site asset URL');
 assert((await stat(new URL('.'+iconPath,root))).size>0,`Missing favicon asset in ${entry}`);
}
for(const file of ['index.html','garden/index.html','admin/index.html','content-release.json'])await stat(new URL(file,root));
async function visit(dir){for(const e of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,e.name);assert(!/dino-rescue|\/design\//.test(file),'Unexpected public artifact '+file);if(e.isDirectory())await visit(file);else if(e.name.endsWith('.js')){const s=await readFile(file,'utf8');for(const bad of ['/api/game/generate','/api/studio/games','sourceRef','splitAudit'])assert(!s.includes(bad),'Unexpected dependency '+bad);}}}
await visit(root.pathname);console.log('Garden release whitelist and entry points verified');
const {createHash}=await import('node:crypto');
const release=JSON.parse(await readFile(new URL('resource-release.json',root),'utf8'));
const manifestBytes=await readFile(new URL('.'+release.url,root));
assert.equal(createHash('sha256').update(manifestBytes).digest('hex'),release.sha256,'Manifest digest');
const catalog=JSON.parse(manifestBytes);
assert.equal(catalog.releaseId,release.releaseId);assert.equal(catalog.schemaVersion,1);
for(const [id,item] of Object.entries(catalog.resources)){
 const file=await readFile(new URL('.'+item.url,root));assert.equal(file.length,item.bytes,'Resource size '+id);assert.equal(createHash('sha256').update(file).digest('hex'),item.sha256,'Resource digest '+id);
 assert(item.url.includes(item.sha256),'Content-addressed URL '+id);
}
for(const [name,ids] of Object.entries(catalog.groups))for(const id of ids)assert(catalog.resources[id],'Unresolved dependency '+name+':'+id);
assert(catalog.budgets['learning-home'].bytes<=4*1024**2,'Homepage budget');assert(catalog.budgets['battle-images'].bytes+catalog.budgets.speech.bytes<=12*1024**2,'Battle budget');
const shell=JSON.parse(await readFile(new URL(`assets/garden/shells/${release.releaseId}.json`,root),'utf8'));
for(const item of shell.entries){assert(!item.url.startsWith('/api/')&&!item.url.startsWith('/admin/'),'Public shell only');const b=await readFile(new URL('.'+item.url,root));assert.equal(createHash('sha256').update(b).digest('hex'),item.sha256,'Shell digest '+item.url);}
await stat(new URL('garden/sw.js',root));
console.log(`Resource release ${release.releaseId}: ${Object.keys(catalog.resources).length} files verified, budgets and public shell verified`);
