import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {loadRuntimeLedger,contentDigest} from './garden-runtime-content.mjs';
const repo=fileURLToPath(new URL('../',import.meta.url));
const digest=b=>createHash('sha256').update(b).digest('hex');
async function files(dir){const out=[];for(const e of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const p=path.join(dir,e.name);if(e.isDirectory())out.push(...await files(p));else out.push(p);}return out;}
export function gardenResourcesPlugin(){
 let catalog,media=new Map(),promise;
 async function prepare(){if(promise)return promise;return promise=(async()=>{
  const resources={};
  for(const dir of ['pinyin-garden','waji'])for(const file of await files(path.join(repo,'web/public/assets',dir))){
   if(!/\.(png|mp3|wav)$/.test(file))continue;
   const id='/'+path.relative(path.join(repo,'web/public'),file).split(path.sep).join('/');
   let data=await readFile(file),width,height,type='audio',ext=path.extname(file),mime=ext==='.mp3'?'audio/mpeg':'audio/wav';
   if(ext==='.png'){
    type='image';const max=dir==='waji'?1536:id.includes('/backgrounds/')?1600:id.includes('/characters/')?384:256;
    const result=await sharp(data).resize({width:max,height:max,fit:'inside',withoutEnlargement:true}).webp({quality:88,alphaQuality:100}).toBuffer({resolveWithObject:true});
    data=result.data;width=result.info.width;height=result.info.height;ext='.webp';mime='image/webp';
   }
   const sha256=digest(data),url='/assets/garden/files/'+sha256+ext;
   media.set(url,data);resources[id]={id,url,sha256,bytes:data.length,mime,type,...(width?{width,height,decodedBytes:width*height*4}:{})};
  }
  const ids=Object.keys(resources),waji=ids.filter(s=>s.startsWith('/assets/waji/'));
  const partners=ids.filter(s=>/characters\/plant_(pod_slinger|dew_collector|vine_guard)\.png$/.test(s));
  const common=[...waji,...partners],background='/assets/pinyin-garden/backgrounds/bg_battle_day.png';
  const groups={'learning-home':common,'garden-shell':[...common,background],'garden-home':[...common,background],collection:ids.filter(s=>s.includes('/characters/')||s.startsWith('/assets/waji/')),'battle-images':ids.filter(s=>s.includes('/characters/')||s.includes('/props/')||s.includes('/backgrounds/')||s.startsWith('/assets/waji/')),'optional-audio':ids.filter(s=>/\/(music|sfx)\//.test(s)),speech:ids.filter(s=>s.includes('/pronunciation/')),all:ids};
  const sourceFiles=[...await files(path.join(repo,'web/src')),...await files(path.join(repo,'shared/src'))].filter(s=>/\.(tsx?|css)$/.test(s)&&!s.includes('.test.'));
  const sourceHash=createHash('sha256');for(const file of sourceFiles){sourceHash.update(path.relative(repo,file));sourceHash.update(await readFile(file));}
  sourceHash.update(await readFile(fileURLToPath(import.meta.url)));
  for(const name of ['package-lock.json','web/vite.config.ts','web/index.html','web/garden/index.html','web/admin/index.html'])sourceHash.update(await readFile(path.join(repo,name)));
  const contentSha256=contentDigest(await loadRuntimeLedger());sourceHash.update(contentSha256);
  const appBuildId=sourceHash.digest('hex').slice(0,20),releaseId=digest(JSON.stringify({resources,groups,appBuildId})).slice(0,24);
  const budgets={};for(const [name,group] of Object.entries(groups)){const unique=[...new Set(group.map(id=>resources[id].url))];budgets[name]={bytes:unique.reduce((n,url)=>n+media.get(url).length,0),decodedBytes:group.reduce((n,id)=>n+(resources[id].decodedBytes??0),0)};}
  if(budgets['learning-home'].bytes>4*1024**2)throw Error('Homepage asset budget exceeded');
  if(budgets['battle-images'].bytes+budgets.speech.bytes>12*1024**2)throw Error('Battle asset budget exceeded');
  if(budgets['battle-images'].decodedBytes>96*1024**2)throw Error('Decoded image budget exceeded');
  catalog={schemaVersion:1,releaseId,appBuildId,contentVersion:'garden-adventure-4',contentSha256,resources,groups,budgets};
  return catalog;
 })();}
 return {name:'garden-resources',enforce:'pre',async buildStart(){await prepare();},resolveId(id){if(id==='virtual:garden-resources')return '\0garden-resources';},async load(id){if(id==='\0garden-resources')return 'export default '+JSON.stringify(await prepare())+';';},
  async transformIndexHtml(html){await prepare();return html.replace(/\/assets\/(?:waji|pinyin-garden)\/[^"'?<> ]+\.(?:png|wav|mp3)(?:\?[^"'<> ]*)?/g,s=>catalog.resources[s.split('?')[0]]?.url??s);},
  async configureServer(server){await prepare();server.middlewares.use((req,res,next)=>{const url=req.url?.split('?')[0];if(media.has(url)){res.setHeader('Content-Type',Object.values(catalog.resources).find(r=>r.url===url).mime);res.setHeader('Cache-Control','public,max-age=31536000,immutable');res.end(media.get(url));}else if(url==='/resource-release.json'||url===`/assets/garden/manifests/${catalog.releaseId}.json`){res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-cache');res.end(JSON.stringify(url==='/resource-release.json'?{schemaVersion:1,releaseId:catalog.releaseId,appBuildId:catalog.appBuildId,url:`/assets/garden/manifests/${catalog.releaseId}.json`,sha256:digest(JSON.stringify(catalog))}:catalog));}else next();});},
  async generateBundle(_options,bundle){
   await prepare();for(const [url,data] of media)this.emitFile({type:'asset',fileName:url.slice(1),source:data});
   const manifest=JSON.stringify(catalog),url=`/assets/garden/manifests/${catalog.releaseId}.json`;
   this.emitFile({type:'asset',fileName:url.slice(1),source:manifest});
   const pointer={schemaVersion:1,releaseId:catalog.releaseId,appBuildId:catalog.appBuildId,url,sha256:digest(manifest)};
   this.emitFile({type:'asset',fileName:'resource-release.json',source:JSON.stringify(pointer)});
   this.emitFile({type:'asset',fileName:'resource-budget.json',source:JSON.stringify(catalog.budgets,null,2)});
   // The catalog embedded in JS is the immutable source of truth, including on first visit.
   for(const item of Object.values(bundle))if(item.type==='asset'&&item.fileName.endsWith('.html')&&typeof item.source==='string'){
    item.source=item.source.replace(/\/assets\/(?:waji|pinyin-garden)\/[^"'?<> ]+\.(?:png|wav|mp3)(?:\?[^"'<> ]*)?/g,s=>catalog.resources[s.split('?')[0]]?.url??s);
   }
  },async closeBundle(){media.clear();}
 };
}
export async function writeGardenWorker(out){
 const {build}=await import('esbuild');
 await build({entryPoints:[path.join(repo,'web/src/resources/service-worker.ts')],outfile:path.join(out,'garden/sw.js'),bundle:true,format:'iife',target:'es2020',minify:true});
 // A complete, immutable public shell. No account response is ever included.
 const html=await readFile(path.join(out,'garden/index.html'),'utf8'),shellFiles=new Set();
 const visit=async url=>{const target=path.resolve(out,'.'+url);if(!target.startsWith(out+path.sep)||shellFiles.has(target))return;shellFiles.add(target);if(target.endsWith('.js')){const js=await readFile(target,'utf8');for(const match of js.matchAll(/(?:from\s*|import\s*\(?)["'](\.[^"']+|\/assets\/[^"']+)["']/g)){const child=match[1].startsWith('/')?match[1]:path.posix.join(path.posix.dirname(url),match[1]);await visit(child);}}};
 for(const match of html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+\.(?:js|css))["']/g))await visit(match[1]);
 const entries=[];for(const f of [path.join(out,'garden/index.html'),...shellFiles]){const b=await readFile(f);entries.push({url:'/'+path.relative(out,f).split(path.sep).join('/'),sha256:digest(b),bytes:b.length});}
 const pointer=JSON.parse(await readFile(path.join(out,'resource-release.json'),'utf8'));
 await mkdir(path.join(out,'assets/garden/shells'),{recursive:true});
 await writeFile(path.join(out,`assets/garden/shells/${pointer.releaseId}.json`),JSON.stringify({releaseId:pointer.releaseId,entries}));
}
