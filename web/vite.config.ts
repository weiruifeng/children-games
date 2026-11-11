import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
import {fileURLToPath,URL} from 'node:url';
import {cp,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
// @ts-ignore build-only ESM helper
import {loadRuntimeLedger,contentDigest} from '../scripts/garden-runtime-content.mjs';
// @ts-ignore build-only resource pipeline
import {gardenResourcesPlugin,writeGardenWorker} from '../scripts/garden-resource-build.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
export default defineConfig(({command,mode})=>({plugins:[gardenResourcesPlugin(),{name:'garden-runtime-content',enforce:'pre',async transform(_code,id){if(mode!=='test'&&id.endsWith('/pinyin-garden/data/candidate-ledger.ts'))return {code:'export const candidateLedger = '+JSON.stringify(await loadRuntimeLedger())+';',map:null};}},react(),{name:'garden-public-whitelist',async closeBundle(){
 const out=path.join(root,'dist-garden');
 const ledger=await loadRuntimeLedger();await writeFile(path.join(out,'content-release.json'),JSON.stringify({version:'garden-adventure-4',schema:1,sha256:contentDigest(ledger)}));
 await mkdir(path.join(out,'credits'),{recursive:true});await cp(path.join(root,'../docs/specs/pinyin-garden/content-inventory/pinyin-data-LICENSE.txt'),path.join(out,'credits/pinyin-data-LICENSE.txt'));
 await writeGardenWorker(out);
 const legacy=path.join(out,'experiments/pinyin-garden');await mkdir(legacy,{recursive:true});await writeFile(path.join(legacy,'index.html'),'<!doctype html><meta charset="utf-8"><title>拼音花园</title><script>location.replace("/garden/"+location.search+location.hash)</script><a href="/garden/">进入花园</a>');
}}],cacheDir:path.join(root,'node_modules/.vite-garden'),publicDir:command==='serve'?'public':false,define:{'import.meta.env.VITE_GARDEN_SITE':'true'},test:{environment:'node',include:['src/**/*.test.ts','../shared/src/**/*.test.ts']},resolve:{alias:{'@children-games/shared':fileURLToPath(new URL('../shared/src/index.ts',import.meta.url))}},build:{outDir:'dist-garden',rollupOptions:{input:{home:path.join(root,'index.html'),garden:path.join(root,'garden/index.html'),admin:path.join(root,'admin/index.html')}}},server:{host:'127.0.0.1',port:5173,proxy:{'/api':process.env.GARDEN_API_TARGET??'http://127.0.0.1:3009'}}}));
