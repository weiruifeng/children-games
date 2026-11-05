import {choosePart, ENTRY_MAP, selectTarget, submitTask, hasSharedAmmo, type GardenState, type Parts} from '@children-games/shared';

export function finishAssembly(s:GardenState) {
 const t=s.task;if(!t||t.finished||s.paused||s.helpOpen||s.stage!=='playing')return;
 const required=ENTRY_MAP[t.entryId].parts[t.index];
 if(t.mode==='choose'?!t.choice:!(['initial','medial','final','whole','tone'] as const).every(k=>!required[k]||!!t.parts[k]))return;
 // Selection is stable, including after an error; changing tone never clears another piece.
 submitTask(s);
}
export function placeAmmoPart(s:GardenState,key:keyof Parts,value:string|number,token:string) {
 if(!s.task||`${s.task.key}:${s.task.index}`!==token||s.paused||s.helpOpen||s.task.finished)return;
 if(s.task.parts[key]===value)return;
 choosePart(s,key,value);finishAssembly(s);
}
export function acquireTarget(s:GardenState,id?:number) {
 if(s.task&&id===undefined||s.paused||s.helpOpen||s.stage!=='playing')return;
 const e=id===undefined?[...s.enemies].sort((a,b)=>a.x-b.x).find(e=>!hasSharedAmmo(s,e.entryId)):s.enemies.find(e=>e.id===id);
 if(e)selectTarget(s,e.id);
}
