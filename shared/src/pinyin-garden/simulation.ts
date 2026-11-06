import {knowledgePool} from './review';
import {allowedPlants,composeParts,ENTRY_MAP,LEVELS,PLANTS,signature,type PlantKind,type Parts,type EnemyKind} from './content';
import {BOARD,cellX,rowY,emptyParts,type GardenState,type Enemy,type Plant} from './model';
export function createGarden(level=1,seed=173):GardenState {
 if(!LEVELS[level-1])throw new Error('未知关卡');
 return {version:1,level,seed,stage:'ready',wave:0,time:0,waveTime:0,betweenTime:12,spawned:0,nextSpawn:0,dew:250,hearts:3,rescues:[false,false,false],plants:[],enemies:[],projectiles:[],drops:[],cooldowns:{plant_pod_slinger:0,plant_dew_collector:0,plant_vine_guard:0,plant_cone_launcher:0},sharedAmmo:[],drafts:{},selectedPlant:null,task:null,paused:false,helpOpen:false,slow:false,dropTimer:0,score:0,earned:[],results:{},attempts:[],attackedRows:[],strategy:false,nextId:1,eventId:0,events:[],message:'先种下伙伴，再开始这一波。'};
}
function event(s:GardenState,type:string,x=640,y=400,value?:string){s.events.push({id:++s.eventId,type,x,y,value});if(s.events.length>40)s.events.shift();}
function reward(s:GardenState,key:string,points:number){if(!s.earned.includes(key)){s.earned.push(key);s.score+=points;}}
function random(s:GardenState){s.seed=(Math.imul(1664525,s.seed)+1013904223)>>>0;return s.seed/4294967296;}
export function startWave(s:GardenState):boolean {
 if(!['ready','between'].includes(s.stage))return false;
 if(s.stage==='between')s.wave++;
 s.stage='playing';s.spawned=0;s.nextSpawn=12;s.waveTime=0;s.task=null;s.helpOpen=false;s.paused=false;
 s.sharedAmmo=[];s.drafts={};s.projectiles=[];for(const p of s.plants){p.ammo=0;p.signature='';p.target=null;p.firing=false;p.timer=0;}
 s.message=`第 ${s.wave+1} 波，重新补充全队弹药！`;event(s,'wave_start');return true;
}
export function placePlant(s:GardenState,kind:PlantKind,row:number,col:number):boolean {
 if(s.paused||s.helpOpen||s.stage!=='playing')return false;
 if(!allowedPlants(s.level).includes(kind)||!LEVELS[s.level-1].rows.includes(row)||col<0||col>=6||!Number.isInteger(col))return false;
 if(s.plants.some(p=>p.row===row&&p.col===col)){s.message='这块地已经有伙伴啦。';return false;}
 if(s.dew<PLANTS[kind].cost){s.message='露珠还不够，等一小会儿。';event(s,'resource_low');return false;}
 if(s.cooldowns[kind]>0){s.message='这个伙伴还在准备。';return false;}
 s.dew-=PLANTS[kind].cost;s.cooldowns[kind]=PLANTS[kind].cooldown;
 const p:Plant={id:s.nextId++,kind,row,col,hp:PLANTS[kind].hp,timer:0,ammo:0,signature:'',target:null,firing:false};s.plants.push(p);
 s.message=PLANTS[kind].description;event(s,'plant_place',cellX(col),rowY(row));return true;
}
export function removePlant(s:GardenState,id:number):void {
 if(s.paused||s.helpOpen||['won','lost'].includes(s.stage))return;
 const p=s.plants.find(p=>p.id===id);if(!p)return;
 s.dew+=Math.floor(PLANTS[p.kind].cost/2);s.plants=s.plants.filter(p=>p.id!==id);
 if(s.selectedPlant===id)s.selectedPlant=null;
 event(s,'plant_remove',cellX(p.col),rowY(p.row));
}
export function selectPlant(s:GardenState,id:number):void {
 if(s.paused||s.helpOpen||['won','lost'].includes(s.stage))return;
 const p=s.plants.find(p=>p.id===id);if(!p)return;
 s.selectedPlant=id;s.message=PLANTS[p.kind].description;
}
export function hasSharedAmmo(s:GardenState,entryId:string):boolean {
 const entry=ENTRY_MAP[entryId];return !!entry&&s.sharedAmmo.some(id=>signature(ENTRY_MAP[id])===signature(entry));
}
export function selectKnowledge(s:GardenState,entryId:string):boolean {
 if(s.paused||s.helpOpen||s.stage!=='playing'||!knowledgePool(s).includes(entryId))return false;
 if(s.task)s.drafts[s.task.entryId]=s.task;
 const entry=ENTRY_MAP[entryId];
 s.task=s.drafts[entryId]??{key:`wave-${s.wave}:ammo-${signature(entry)}`,plantId:0,enemyId:0,entryId,index:0,parts:emptyParts(),help:0,errors:0,finished:false,mode:s.level===4&&Number(entryId.split('-')[1])%2===0?'choose':'compose',choice:''};
 s.drafts[entryId]=s.task;
 if(hasSharedAmmo(s,entryId)){s.task.finished=true;s.task.index=entry.parts.length-1;s.task.parts={...entry.parts[s.task.index]};}
 s.message=s.task.finished?'本波全队无限使用':'拼好一次，全队共享。';return true;
}
export function selectTarget(s:GardenState,id:number):boolean {
 const e=s.enemies.find(e=>e.id===id);return e?selectKnowledge(s,e.entryId):false;
}
export function choosePart(s:GardenState,key:keyof Parts,value:string|number):void {
 if(!s.task||s.task.finished||s.paused||s.helpOpen)return;
 if(key==='tone'){if(typeof value!=='number'||value<1||value>4)return;s.task.parts.tone=value;}
 else if(typeof value==='string')s.task.parts[key]=value;
 event(s,key==='tone'?'slot_tone':key==='initial'?'slot_initial':'slot_final');
}
export function requestHelp(s:GardenState):void {
 if(!s.task||s.task.finished||s.paused)return;s.task.help=Math.min(3,s.task.help+1);s.helpOpen=true;
 s.message='慢慢看，花园已经暂停了。';
}
export function applyDemonstration(s:GardenState):void {
 if(!s.task||s.task.help<3)return;
 s.task.parts={...ENTRY_MAP[s.task.entryId].parts[s.task.index]};s.task.choice=ENTRY_MAP[s.task.entryId].text;s.helpOpen=false;
}
export function submitTask(s:GardenState,now=Date.now()):boolean {
 const t=s.task;if(!t||t.finished||s.paused||s.helpOpen)return false;
 if(s.stage!=='playing')return false;
 const entry=ENTRY_MAP[t.entryId];const correct=t.mode==='choose'?t.choice===entry.text:composeParts(t.parts)===entry.pinyin[t.index];
 const id=`${t.key}:${t.index}`;if(correct||t.errors===0)s.attempts.push({level:s.level,mode:s.reviewPool?'review':'battle',retry:!!s.retryCount,taskId:id,entryId:entry.id,syllable:t.index,correct,assisted:t.help>0,repeated:s.attempts.some(a=>a.taskId===id&&a.correct),at:now});
 if(!correct){t.errors=Math.max(1,t.errors);s.message=t.mode==='choose'?'再看看拼音，换一个字试试。':composeParts(t.parts)?'声母、韵母或声调还需要调整。':'这组还不能组成支持的音节。';event(s,'needs_edit');return false;}
 if(!s.results[id]){s.results[id]={independent:t.errors===0&&t.help===0};reward(s,`task:${id}`,100+(s.results[id].independent?50:0));}
 if(s.level===2&&s.enemies.some(en=>s.plants.some(pl=>pl.kind==='plant_vine_guard'&&pl.row===en.row&&Math.abs(en.x-cellX(pl.col))<65)))s.strategy=true;
 if(t.index<entry.parts.length-1){t.index++;t.parts=emptyParts();t.errors=0;t.help=0;s.message='第一个拼好了，接着拼下一个。';event(s,'syllable_ready');return true;}
 t.finished=true;if(!hasSharedAmmo(s,entry.id))s.sharedAmmo.push(entry.id);
 for(const p of s.plants)if(p.kind==='plant_pod_slinger'||p.kind==='plant_cone_launcher')p.timer=Math.max(p.timer,p.kind==='plant_cone_launcher'?3:.8);
 s.message=`${signature(entry)} · 全队可用！`;event(s,'ammo_shared',640,170,signature(entry));return true;
}
export function collectDrop(s:GardenState,id:number):void {if(s.paused||s.helpOpen)return;const d=s.drops.find(d=>d.id===id);if(!d)return;s.dew+=d.value;s.drops=s.drops.filter(d=>d.id!==id);event(s,'dew_collect',d.x,d.y,String(d.value));}
function kill(s:GardenState,e:Enemy,matched:boolean):void {
 if(!s.enemies.some(en=>en.id===e.id))return;
 reward(s,`kill:${e.id}`,e.kind==='enemy_scroll'?200:e.kind==='enemy_paper_blob'?100:50);s.dew+=e.kind==='enemy_scroll'?30:e.kind==='enemy_paper_blob'?15:10;
 if(matched&&!s.attackedRows.includes(e.row))s.attackedRows.push(e.row);
 if(s.level===4&&s.attackedRows.length>=2)s.strategy=true;
 if(s.level===5&&e.kind==='enemy_scroll'&&e.x>BOARD.left+BOARD.cellW)s.strategy=true;
 s.enemies=s.enemies.filter(en=>en.id!==e.id);event(s,'enemy_exit',e.x,rowY(e.row));
}
function damage(s:GardenState,e:Enemy,amount:number,matched:boolean):void {
 const absorbed=Math.min(e.armor,amount);const had=e.armor;e.armor-=absorbed;e.hp-=amount-absorbed;
 event(s,had>0&&e.armor===0?'armor_break':'projectile_hit',e.x,rowY(e.row));if(e.hp<=0)kill(s,e,matched);
}
function matching(s:GardenState,p:Pick<Plant,'row'|'signature'|'target'>,x:number):Enemy|undefined {
 const valid=(e:Enemy)=>e.row===p.row&&e.x>x&&signature(ENTRY_MAP[e.entryId])===p.signature;
 return s.enemies.find(e=>e.id===p.target&&valid(e))??s.enemies.filter(valid).sort((a,b)=>a.x-b.x)[0];
}
function spawn(s:GardenState):void {
 const l=LEVELS[s.level-1];const count=l.counts[s.wave];
 const captain=s.level===5&&s.wave===2&&s.spawned===count-1;
 const kind:EnemyKind=captain?'enemy_scroll':s.spawned<l.armored[s.wave]?'enemy_paper_blob':'enemy_ink_blob';
 const row=l.rows[Math.floor(random(s)*l.rows.length)];
 if(s.enemies.some(e=>e.row===row&&e.x>BOARD.spawnX-100))return;
 const sampled=knowledgePool(s)[Math.floor(random(s)*knowledgePool(s).length)];
 const entryId=s.level===1&&s.wave===0&&s.spawned===0?'char-1':sampled;
 s.enemies.push({id:s.nextId++,kind,row,x:BOARD.spawnX,hp:kind==='enemy_scroll'?240:80,armor:kind==='enemy_paper_blob'?80:0,entryId,attackTimer:0});s.spawned++;s.nextSpawn=s.waveTime+l.interval;
 if(captain)event(s,'scroll_enter');
}
export function tickGarden(s:GardenState,realDelta:number):void {
 if(s.paused||s.helpOpen||s.stage==='won'||s.stage==='lost')return;
 const dt=Math.min(Math.max(realDelta,0),0.1)*(s.slow?0.7:1);
 // Preparation lets the player arrange plants but does not generate unlimited resources.
 if(s.stage==='ready'||s.stage==='between'){for(const k of Object.keys(s.cooldowns) as PlantKind[])s.cooldowns[k]=Math.max(0,s.cooldowns[k]-dt);if(s.stage==='between')s.betweenTime=Math.max(0,s.betweenTime-dt);return;}
 s.time+=dt;s.waveTime+=dt;s.dropTimer+=dt;
 for(const k of Object.keys(s.cooldowns) as PlantKind[])s.cooldowns[k]=Math.max(0,s.cooldowns[k]-dt);
 if(s.dropTimer>=10){s.dropTimer-=10;s.drops.push({id:s.nextId++,x:350+random(s)*650,y:200+random(s)*340,age:0,value:25});event(s,'dew_spawn');}
 for(const d of [...s.drops]){d.age+=dt;if(d.age>=8)collectDrop(s,d.id);}
 if(s.spawned<LEVELS[s.level-1].counts[s.wave]&&s.waveTime>=s.nextSpawn&&s.enemies.length<6)spawn(s);
 for(const p of s.plants){
  p.timer+=dt;
  if(p.kind==='plant_dew_collector'&&p.timer>=8){p.timer=-4;s.drops.push({id:s.nextId++,x:cellX(p.col)+35,y:rowY(p.row)-28,age:0,value:25});event(s,'dew_spawn',cellX(p.col),rowY(p.row));}
  if(p.kind==='plant_pod_slinger'||p.kind==='plant_cone_launcher'){
   const target=s.enemies.filter(e=>e.row===p.row&&e.x>cellX(p.col)&&hasSharedAmmo(s,e.entryId)&&(p.kind==='plant_cone_launcher'||ENTRY_MAP[e.entryId].type==='character')).sort((a,b)=>a.x-b.x)[0];
   p.firing=!!target;p.ammo=0;
   if(target&&p.timer>=(p.kind==='plant_cone_launcher'?3:.8)){
    p.target=target.id;p.signature=signature(ENTRY_MAP[target.entryId]);p.timer=0;
    s.projectiles.push({id:s.nextId++,row:p.row,x:cellX(p.col)+15,y:rowY(p.row)-(p.kind==='plant_cone_launcher'?65:45),target:target.id,signature:p.signature,heavy:p.kind==='plant_cone_launcher'});
    event(s,p.kind==='plant_cone_launcher'?'cone_launch':'slinger_fire',cellX(p.col),rowY(p.row));
   }
  }
 }
 for(const b of [...s.projectiles]){
  const target=s.enemies.find(e=>e.id===b.target&&e.row===b.row&&signature(ENTRY_MAP[e.entryId])===b.signature)??matching(s,b,b.x-25);
  if(!target){s.projectiles=s.projectiles.filter(p=>p.id!==b.id);continue;}
  b.target=target.id;b.x+=dt*(b.heavy?340:480);
  if(b.x>=target.x){
   const center=target.x;const nearby=b.heavy?s.enemies.filter(e=>e.id!==target.id&&Math.hypot(e.x-center,rowY(e.row)-rowY(target.row))<=130):[];
   if(b.heavy&&nearby.length&&s.level===3)s.strategy=true;
   damage(s,target,b.heavy?160:40,true);for(const e of nearby)damage(s,e,60,false);
   if(b.heavy)event(s,'cone_impact',center,rowY(b.row));s.projectiles=s.projectiles.filter(p=>p.id!==b.id);
  }
 }
 for(const e of [...s.enemies]){
  const barrier=s.plants.filter(p=>p.row===e.row&&cellX(p.col)<e.x+40).sort((a,b)=>b.col-a.col)[0];
  if(barrier&&e.x-cellX(barrier.col)<=65){e.attackTimer+=dt;if(e.attackTimer>=1.2){e.attackTimer-=1.2;barrier.hp-=e.kind==='enemy_scroll'?30:20;event(s,barrier.kind==='plant_vine_guard'?'vine_hit':'enemy_attack',cellX(barrier.col),rowY(barrier.row));if(barrier.hp<=0){s.plants=s.plants.filter(p=>p.id!==barrier.id);if(s.selectedPlant===barrier.id)s.selectedPlant=null;}}}
  else {e.attackTimer=0;e.x-=dt*(e.kind==='enemy_scroll'?9:e.kind==='enemy_paper_blob'?11:14);}
  if(e.x<BOARD.left+BOARD.cellW&&!s.earned.includes(`danger:${e.id}`)){s.earned.push(`danger:${e.id}`);event(s,'danger',e.x,rowY(e.row));}
  if(e.x<=BOARD.homeX&&s.enemies.some(x=>x.id===e.id)){
   s.hearts=Math.max(0,s.hearts-1);s.enemies=s.enemies.filter(x=>x.id!==e.id);
   s.earned.push(`leak:${s.wave}:${e.id}`);event(s,'base_hit',BOARD.homeX,rowY(e.row));
   if(s.hearts===0)break;
  }
 }
 if(s.hearts<=0){s.hearts=0;s.stage='lost';s.task=null;s.message='爱心用完了，从这一波再试一次吧。';event(s,'retry');return;}
 if(s.spawned===LEVELS[s.level-1].counts[s.wave]&&!s.enemies.length){reward(s,`wave:${s.wave}`,100);s.task=null;
  if(s.wave===2){s.stage='won';reward(s,'hearts',s.hearts*100);if(s.level===1&&s.hearts===3)s.strategy=true;event(s,'victory');}
  else {s.stage='between';s.betweenTime=12;s.message=waveLeaks(s)?`这一波漏过 ${waveLeaks(s)} 只墨团，还剩 ${s.hearts} 颗爱心。`:'这一波守住了！准备好后继续。';}
 }
}
export function starsFor(s:GardenState):boolean[]{const results=Object.values(s.results);return [s.stage==='won',s.stage==='won'&&results.length>=5&&results.filter(r=>r.independent).length/results.length>=0.8,s.stage==='won'&&s.strategy];}
export function snapshot(s:GardenState):GardenState {const copy=JSON.parse(JSON.stringify(s)) as GardenState;copy.events=[];copy.task=null;copy.drafts={};copy.helpOpen=false;copy.paused=false;return copy;}

/** A resumable save keeps the unfinished assembly; wave retries use snapshot instead. */
export function resumeSnapshot(s:GardenState):GardenState {const copy=JSON.parse(JSON.stringify(s)) as GardenState;copy.events=[];copy.helpOpen=false;if(copy.task)copy.drafts[copy.task.entryId]=copy.task;return copy;}

/** Persisted wave-specific leak markers survive refresh and roll back with waveStart. */
export function waveLeaks(s:GardenState):number{return s.earned.filter(key=>key.startsWith(`leak:${s.wave}:`)).length;}
