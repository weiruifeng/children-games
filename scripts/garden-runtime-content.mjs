import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export function runtimeLedger(rows){return rows.map(r=>({id:r.id,key:r.key,base:r.base,pinyin:r.pinyin,track:r.track,textValidation:{status:r.textValidation.status,reason:r.textValidation.reason},review:{status:r.review.status},audio:{status:r.audio.status},entries:r.entries.map(e=>({id:e.id,text:e.text,context:e.context,contextRequired:e.contextRequired,guided:e.guided,common:e.common,verification:{status:e.verification?.status},review:{status:e.review.status,by:!!e.review.by,date:!!e.review.date}}))}));}
export async function loadRuntimeLedger(){const text=await readFile(new URL('../shared/src/pinyin-garden/data/candidate-ledger.ts',import.meta.url),'utf8');return runtimeLedger(JSON.parse(text.split(' = ')[1].replace(/;\s*$/,'')));}
export function contentDigest(value){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
