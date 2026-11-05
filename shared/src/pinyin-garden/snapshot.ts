import {z} from 'zod';
import {ENTRY_MAP,PLANT_IDS,ENEMY_IDS,LEVELS} from './content';
import type {GardenState,LearningAttempt} from './model';
const n=z.number().finite();const positive=n.nonnegative();const id=n.int().positive();
const row=n.int().min(0).max(2);const col=n.int().min(0).max(5);
const stateSchema=z.object({
 version:z.literal(1),level:n.int().min(1).max(5),seed:positive.int(),stage:z.enum(['ready','playing','between','won','lost']),wave:n.int().min(0).max(2),time:positive,waveTime:positive,betweenTime:positive,spawned:positive.int().max(7),nextSpawn:positive,
 dew:positive.max(1e6),hearts:n.int().min(0).max(3),rescues:z.array(z.boolean()).length(3),
 plants:z.array(z.object({id,kind:z.enum(PLANT_IDS),row,col,hp:positive.max(500),timer:n,ammo:n.int().min(0).max(3),signature:z.string().max(60),target:id.nullable(),firing:z.boolean()}).strict()).max(18),
 enemies:z.array(z.object({id,kind:z.enum(ENEMY_IDS),row,x:n.min(0).max(1300),hp:positive.max(240),armor:positive.max(80),entryId:z.string().refine(v=>!!ENTRY_MAP[v]),attackTimer:positive}).strict()).max(6),
 projectiles:z.array(z.object({id,row,x:n,y:n,target:id,signature:z.string().max(60),heavy:z.boolean()}).strict()).max(100),
 drops:z.array(z.object({id,x:n,y:n,age:positive,value:positive.max(100)}).strict()).max(100),
 cooldowns:z.object({plant_pod_slinger:positive,plant_dew_collector:positive,plant_vine_guard:positive,plant_cone_launcher:positive}).strict(),
 sharedAmmo:z.array(z.string().refine(v=>!!ENTRY_MAP[v])).max(42).default([]),drafts:z.record(z.never()).default({}),
 selectedPlant:id.nullable(),task:z.null(),paused:z.boolean(),helpOpen:z.literal(false),slow:z.boolean(),dropTimer:positive,score:positive.int().max(1e9),earned:z.array(z.string().max(100)).max(10000),
 results:z.record(z.object({independent:z.boolean()}).strict()),attempts:z.array(z.object({taskId:z.string(),entryId:z.string().refine(v=>!!ENTRY_MAP[v]),syllable:n.int().min(0).max(1),correct:z.boolean(),assisted:z.boolean(),repeated:z.boolean(),at:positive}).strict()).max(50000),
 attackedRows:z.array(row).max(3),strategy:z.boolean(),nextId:id,eventId:positive.int(),events:z.array(z.never()).length(0),message:z.string().max(500),
}).strict();
export interface Profile {version:1;packVersion:'garden-1';name:string;unlocked:number;stars:Record<string,boolean[]>;best:Record<string,number>;checkpoint:GardenState|null;waveStart:GardenState|null;attempts:LearningAttempt[];settings:{music:number;sfx:number;slow:boolean;reducedMotion:boolean};}
export function newProfile(name:string):Profile{return {version:1,packVersion:'garden-1',name,unlocked:1,stars:{},best:{},checkpoint:null,waveStart:null,attempts:[],settings:{music:0.35,sfx:0.6,slow:false,reducedMotion:false}};}
export function parseState(value:unknown):GardenState{
 const s=stateSchema.parse(value);const ids=[...s.plants,...s.enemies,...s.projectiles,...s.drops].map(e=>e.id);
 if(new Set(ids).size!==ids.length||ids.some(id=>id>=s.nextId))throw new Error('实体编号冲突');
 if(s.sharedAmmo.some(id=>!LEVELS[s.level-1].entries.includes(id)))throw new Error('弹药超出当前关卡知识池');
 if(new Set(s.plants.map(p=>`${p.row}:${p.col}`)).size!==s.plants.length)throw new Error('植物格子冲突');
 return s as GardenState;
}
export function parseProfile(input:unknown):Profile {
 const raw=z.object({version:z.literal(1),packVersion:z.literal('garden-1'),name:z.string().min(1).max(20),unlocked:n.int().min(1).max(5),stars:z.record(z.array(z.boolean()).length(3)),best:z.record(positive.int().max(1e9)),checkpoint:z.unknown(),waveStart:z.unknown().optional(),attempts:stateSchema.shape.attempts,settings:z.object({music:n.min(0).max(1),sfx:n.min(0).max(1),slow:z.boolean(),reducedMotion:z.boolean()}).strict()}).strict().parse(input);
 if(Object.keys(raw.stars).some(k=>!['1','2','3','4','5'].includes(k)))throw new Error('未知关卡成就');
 const checkpoint=raw.checkpoint===null?null:parseState(raw.checkpoint);
 const waveStart=raw.waveStart==null?null:parseState(raw.waveStart);
 if(checkpoint&&checkpoint.level>raw.unlocked)throw new Error('检查点超出解锁范围');
 if(waveStart&&(waveStart.level>raw.unlocked||checkpoint&&(waveStart.level!==checkpoint.level||waveStart.wave>checkpoint.wave)))throw new Error('重试检查点与进度不一致');
 return {...raw,checkpoint,waveStart} as Profile;
}
export function reviewEntries(attempts:LearningAttempt[],now=Date.now()):string[]{
 const learned=[...new Set(attempts.map(a=>a.entryId))];
 const last=(id:string)=>{const rows=attempts.filter(a=>a.entryId===id);return rows[rows.length-1];};
 const weak=learned.filter(id=>!last(id).correct||last(id).assisted);
 const due=learned.filter(id=>now-last(id).at>86400000);
 const take=(pool:string[],count:number)=>pool.slice(-count);
 return [...new Set([...take(weak,5),...take(due,3),...take(learned,2)])];
}
