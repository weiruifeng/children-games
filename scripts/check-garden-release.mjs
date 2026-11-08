import {readdir,readFile,stat} from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
const root=new URL('../web/dist-garden/',import.meta.url);
for(const file of ['index.html','garden/index.html','admin/index.html','assets/waji/characters.png','assets/pinyin-garden/characters/plant_pod_slinger.png','content-release.json'])await stat(new URL(file,root));
async function visit(dir){for(const e of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,e.name);assert(!/dino-rescue|\/design\//.test(file),'Unexpected public artifact '+file);if(e.isDirectory())await visit(file);else if(e.name.endsWith('.js')){const s=await readFile(file,'utf8');for(const bad of ['/api/game/generate','/api/studio/games','sourceRef','splitAudit'])assert(!s.includes(bad),'Unexpected dependency '+bad);}}}
await visit(root.pathname);console.log('Garden release whitelist and entry points verified');
