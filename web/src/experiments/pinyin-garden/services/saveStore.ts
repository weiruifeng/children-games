import {parseProfile,type Profile} from '@children-games/shared';
const recoveryKey=(slot:number)=>`pinyin-garden-recovery-${slot}`;
export function writeProfileRecovery(slot:number,p:Profile){localStorage.setItem(recoveryKey(slot),JSON.stringify(p));}
let database:Promise<IDBDatabase>|null=null;
function db():Promise<IDBDatabase>{return database??=new Promise((resolve,reject)=>{const req=indexedDB.open('pinyin-garden',1);req.onupgradeneeded=()=>req.result.createObjectStore('profiles');req.onsuccess=()=>resolve(req.result);req.onerror=()=>{database=null;reject(req.error);};req.onblocked=()=>{database=null;reject(new Error('存档被另一个页面占用，请关闭后重试。'));};});}
export async function loadProfileSlots():Promise<{profiles:(Profile|null)[];errors:Record<number,string>}>{
 const rows=await exportRawProfiles();const errors:Record<number,string>={};
 const profiles=rows.map((raw,i)=>{if(raw===null)return null;try{return parseProfile(raw);}catch{errors[i]='存档需要修复，请先导出备份';return null;}});
 return {profiles,errors};
}
export async function loadProfiles():Promise<(Profile|null)[]>{const result=await loadProfileSlots();if(Object.keys(result.errors).length)throw new Error('部分存档无法读取，请先导出备份');return result.profiles;}
export async function saveProfile(slot:number,profile:Profile,journalWritten=false):Promise<void>{const parsed=parseProfile(profile);if(!journalWritten)writeProfileRecovery(slot,parsed);const saved=JSON.stringify(profile);const store=await db();return new Promise((resolve,reject)=>{const tx=store.transaction('profiles','readwrite');tx.objectStore('profiles').put(parsed,slot);tx.oncomplete=()=>{if(localStorage.getItem(recoveryKey(slot))===saved)localStorage.removeItem(recoveryKey(slot));resolve();};tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??new Error('保存中断'));});}
export async function clearProfile(slot:number):Promise<void>{const store=await db();return new Promise((resolve,reject)=>{const tx=store.transaction('profiles','readwrite');tx.objectStore('profiles').delete(slot);tx.oncomplete=()=>{localStorage.removeItem(recoveryKey(slot));resolve();};tx.onerror=()=>reject(tx.error);});}
export async function exportRawProfiles():Promise<unknown[]>{const store=await db();return Promise.all([0,1,2].map(i=>new Promise((resolve,reject)=>{const req=store.transaction('profiles').objectStore('profiles').get(i);req.onsuccess=()=>{const recovery=localStorage.getItem(recoveryKey(i));if(recovery){try{resolve(JSON.parse(recovery));}catch{resolve({invalidRecovery:recovery});}}else resolve(req.result??null);};req.onerror=()=>reject(req.error);})))}
