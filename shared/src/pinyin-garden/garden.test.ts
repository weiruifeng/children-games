import {describe,it,expect} from 'vitest';
import {ENTRIES,partsFor,composeParts,markTone,validateContent} from './content';
import {createGarden,startWave,placePlant,selectPlant,selectTarget,submitTask,tickGarden,starsFor,snapshot,hasSharedAmmo} from './simulation';
import {newProfile,parseProfile} from './snapshot';
function target(){const s=createGarden();startWave(s);placePlant(s,'plant_pod_slinger',1,0);s.enemies.push({id:s.nextId++,kind:'enemy_ink_blob',row:1,x:800,hp:80,armor:0,entryId:'char-1',attackTimer:0});selectPlant(s,s.plants[0].id);selectTarget(s,s.enemies[0].id);return s;}
describe('pinyin-garden content',()=>{
 it('covers all declared entries and legal decompositions',()=>{expect(ENTRIES).toHaveLength(42);expect(()=>validateContent()).not.toThrow();});
 it('marks compound vowels and keeps ü distinct',()=>{expect(markTone('niu',2)).toBe('niú');expect(markTone('shui',3)).toBe('shuǐ');expect(markTone('lü',4)).toBe('lǜ');expect(composeParts(partsFor('guā'))).toBe('guā');expect(composeParts(partsFor('yuè'))).toBe('yuè');});
 it('rejects wrong teaching split and unsupported syllables',()=>{expect(composeParts({initial:'m',medial:'',final:'ü',tone:3,whole:''})).toBeNull();expect(composeParts({initial:'g',medial:'',final:'ua',tone:1,whole:''})).toBeNull();});
});
describe('pinyin-garden combat',()=>{
 it('does not spend twice on occupied cells',()=>{const s=createGarden();startWave(s);expect(placePlant(s,'plant_pod_slinger',1,0)).toBe(true);expect(placePlant(s,'plant_pod_slinger',1,0)).toBe(false);expect(s.dew).toBe(150);});
 it('shares a correct answer and awards it once per wave',()=>{const s=target();s.task!.parts=partsFor('mǎ');expect(submitTask(s,1)).toBe(true);expect(s.score).toBe(150);tickGarden(s,.01);expect(s.projectiles).toHaveLength(1);selectTarget(s,s.enemies[0].id);expect(submitTask(s,2)).toBe(false);expect(s.score).toBe(150);});
 it('assistance and errors do not deduct hearts or dew',()=>{const s=target(),dew=s.dew;s.task!.parts=partsFor('mā');expect(submitTask(s)).toBe(false);s.task!.help=1;s.task!.parts=partsFor('mǎ');submitTask(s);expect(s.score).toBe(100);expect(s.hearts).toBe(3);expect(s.dew).toBe(dew);});
 it('pauses all simulation under help',()=>{const s=target();s.helpOpen=true;const before=JSON.stringify(s);tickGarden(s,0.1);expect(JSON.stringify(s)).toBe(before);});
 it('can study another row without selecting a shooter',()=>{const s=target();s.enemies[0].row=0;s.task=null;s.selectedPlant=null;expect(selectTarget(s,s.enemies[0].id)).toBe(true);});
 it('deducts a heart immediately without rescue or knowledge rewards',()=>{const s=target();s.rescues=[true,true,true];s.enemies[0].x=180;s.task=null;const score=s.score,dew=s.dew;tickGarden(s,0.02);expect(s.hearts).toBe(2);expect(s.score).toBe(score);expect(s.dew).toBe(dew);expect(Object.keys(s.results)).toHaveLength(0);expect(s.events.some(e=>e.type==='rescue_windbell')).toBe(false);});
 it('does not give reading star for an empty result set',()=>{const s=createGarden();s.stage='won';expect(starsFor(s)).toEqual([true,false,false]);});
 it('snapshots detach from the live state and reject corrupt imports',()=>{const s=target();const cp=snapshot(s);s.dew=0;expect(cp.dew).toBe(150);const p=newProfile('花园');p.checkpoint=cp;expect(parseProfile(p).checkpoint?.level).toBe(1);expect(()=>parseProfile({...p,unlocked:99})).toThrow();expect(()=>parseProfile({...p,checkpoint:{...cp,dew:-1}})).toThrow();});
});
describe('pinyin-garden full campaign simulation',()=>{
 for(let level=1;level<=5;level++)it(`can complete level ${level} with legal planting and answers`,()=>{
  const s=createGarden(level,173+level*71);const rows=level===1?[1]:level===2?[0,1]:[0,1,2];
  const attack=level===5?'plant_cone_launcher':'plant_pod_slinger';
  startWave(s);placePlant(s,attack,rows[0],0);
  for(let step=0;step<60000&&s.stage!=='won'&&s.stage!=='lost';step++){
   if(s.stage==='between')startWave(s);
   for(const r of rows)if(!s.plants.some(p=>p.row===r&&p.kind===attack))placePlant(s,attack,r,0);
   if(!s.task||s.task.finished){const e=[...s.enemies].sort((a,b)=>a.x-b.x).find(e=>!hasSharedAmmo(s,e.entryId));if(e)selectTarget(s,e.id);}
   if(s.task&&!s.task.finished){const t=s.task,entry=ENTRIES.find(e=>e.id===t.entryId)!;t.parts={...entry.parts[t.index]};t.choice=entry.text;submitTask(s,step);}
   tickGarden(s,.1);
  }
  expect(s.stage,`level ${level}, hearts ${s.hearts}, wave ${s.wave}, enemies ${s.enemies.length}`).toBe('won');
  expect(s.score).toBeGreaterThan(0);
 });
});

it('gives twelve seconds to deploy and makes the first target match the tutorial',()=>{const s=createGarden();startWave(s);for(let i=0;i<110;i++)tickGarden(s,.1);expect(s.enemies).toHaveLength(0);for(let i=0;i<15;i++)tickGarden(s,.1);expect(s.enemies[0]?.entryId).toBe('char-1');});
