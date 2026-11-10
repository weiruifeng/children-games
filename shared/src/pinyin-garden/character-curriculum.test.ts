import {describe,it,expect} from 'vitest';
import {CHARACTER_LEVELS,READING_LEDGER,readingReleased,coverageSummary,adventureMigration,LEGACY_CHARACTER_LEVEL_MAP,resolveAdventure,nextAdventure} from './characterCatalog';
import {createCharacterGarden,createLessonGarden,startWave,selectKnowledge,submitTask,tickGarden,placePlant,hasSharedAmmo,resumeSnapshot,snapshot,requestHelp} from './simulation';
import {ENTRY_MAP,LEVELS,composeParts,partsFor} from './content';
import {knowledgePool} from './review';
import {planLesson,revealWave,readingFacts} from './lessonPlanner';
import {parseState,newProfile,parseProfile} from './snapshot';
const published=CHARACTER_LEVELS.filter(l=>l.published);
const sample=published.find(l=>l.track==='main')!;
function solve(s:ReturnType<typeof createCharacterGarden>,id:string){selectKnowledge(s,id);s.task!.parts={...ENTRY_MAP[id].parts[0]};expect(submitTask(s)).toBe(true);}
describe('character curriculum v3',()=>{
 it('accounts for every candidate and gates audio independently',()=>{
  expect(coverageSummary().total).toBe(1294);expect(CHARACTER_LEVELS).toHaveLength(226);
  expect(new Set(READING_LEDGER.map(r=>r.id)).size).toBe(1294);
  for(const r of READING_LEDGER)if(readingReleased(r)){expect(r.entries.some(e=>e.verification.status==='source-verified'||e.review.status==='reviewed')).toBe(true);if(r.track==='main')expect(r.entries.some(e=>e.common)).toBe(true);}
  expect(()=>createCharacterGarden('missing-level')).toThrow('待完善');
 });
 it('opens late published courses without a learning lock and round trips v3',()=>{
  const p=newProfile('测试');p.selectedLevel=sample.id;p.checkpoint=resumeSnapshot(createCharacterGarden(sample.id));p.waveStart=snapshot(p.checkpoint);
  expect(parseProfile(JSON.parse(JSON.stringify(p))).selectedLevel).toBe(sample.id);
 });
 it('has deterministic complete plans independent of combat RNG and corrupt imports fail',()=>{
  const s=createCharacterGarden(sample.id,1,[],'same');expect(s.learningPlan).toEqual(planLesson(sample.id,'same'));
  startWave(s);const before=JSON.stringify(s.learningPlan);for(let i=0;i<200;i++)tickGarden(s,.1);
  expect(JSON.stringify(parseState(resumeSnapshot(s)).learningPlan)).toBe(before);
  const bad=resumeSnapshot(s);bad.learningPlan!.waves[0].entries=['char-1'];expect(()=>parseState(bad)).toThrow();
 });
 it('does not turn demonstration, closed help or a retry into independent evidence',()=>{
  const s=createCharacterGarden(sample.id);revealWave(s);startWave(s);const id=knowledgePool(s)[0];solve(s,id);
  expect(s.attempts[0]).toMatchObject({assisted:true,referenceVisible:true,firstTryCorrect:false});
  const other=createCharacterGarden(sample.id);startWave(other);selectKnowledge(other,knowledgePool(other)[0]);requestHelp(other);other.helpOpen=false;
  const restored=parseState(resumeSnapshot(other));solve(restored,restored.task!.entryId);expect(restored.attempts[0].assisted).toBe(true);
  const retry=createCharacterGarden(sample.id);retry.retryCount=1;startWave(retry);solve(retry,knowledgePool(retry)[0]);expect(retry.attempts[0].firstTryCorrect).toBe(false);
 });
 it('requires an explicit neutral tone and keeps symbols separate',()=>{
  const p=partsFor('ba');expect(p.tone).toBe(5);expect(composeParts({...p,tone:null})).toBeNull();expect(composeParts(p)).toBe('ba');expect(composeParts({...p,tone:1})).toBe('bā');
 });
 it('does not count shared ammunition or a single day as repeated independent completion',()=>{
  const s=createCharacterGarden(sample.id);startWave(s);const id=knowledgePool(s)[0];solve(s,id);const n=s.attempts.length;selectKnowledge(s,id);expect(submitTask(s)).toBe(false);expect(s.attempts).toHaveLength(n);
  expect(readingFacts(s.attempts,ENTRY_MAP[id].readingId!).repeatedIndependent).toBe(false);
 });
 for(const lesson of published)for(const battle of [1,2,3,4,5])it(`${lesson.id} battlefield ${battle}: all new targets spawn and three waves finish`,()=>{
  const s=createCharacterGarden(lesson.id,battle,[],'campaign');startWave(s);const seen=new Set<string>();
  placePlant(s,'plant_dew_collector',LEVELS[battle-1].rows[0],1);
  for(let step=0;step<30000&&s.stage!=='won'&&s.stage!=='lost';step++){
   if(s.stage==='between')startWave(s);
   const attack=battle>=3?'plant_cone_launcher':'plant_pod_slinger';
   for(const row of LEVELS[battle-1].rows)if(!s.plants.some(p=>p.row===row&&p.kind===attack))placePlant(s,attack,row,0);
   for(const e of s.enemies){seen.add(`${s.wave}:${e.entryId}`);if(!hasSharedAmmo(s,e.entryId))solve(s,e.entryId);}
   tickGarden(s,.1);
  }
  expect(s.stage).toBe('won');s.learningPlan!.waves.forEach((w,i)=>w.newEntries.forEach(id=>expect(seen.has(`${i}:${id}`)).toBe(true)));
  expect(()=>parseState(resumeSnapshot(s))).not.toThrow();
 });
});

it('rejects out-of-scope distractors and changed answer snapshots',()=>{
 const s=createCharacterGarden(sample.id);const id=knowledgePool(s)[0];
 const changed=resumeSnapshot(s);changed.learningPlan!.waves[0].answers[id]='modified';expect(()=>parseState(changed)).toThrow();
 const extra=resumeSnapshot(s);extra.learningPlan!.waves[0].scope.push('initial:invented');expect(()=>parseState(extra)).toThrow();
 const missing=resumeSnapshot(s);missing.learningPlan!.waves.forEach(w=>w.newEntries=[]);expect(()=>parseState(missing)).toThrow();
});
it('normalizes Unicode and rejects noncanonical written tones',()=>{
 expect(partsFor('SHUǏ')).toEqual(partsFor('shuǐ'));
 expect(partsFor('nu\u0308\u0300')).toEqual(partsFor('nǜ'));
 expect(()=>partsFor('shǔǐ')).toThrow();expect(composeParts({...partsFor('ba'),tone:6})).toBeNull();
});
it('archives a v2 active run and wave start without promoting its visible-answer evidence',()=>{
 const legacy={...newProfile('旧版'),version:2,packVersion:'garden-curriculum-2'} as Record<string,unknown>;delete legacy.selectedLevel;delete legacy.levelStars;
 const oldRun=createLessonGarden(3);startWave(oldRun);legacy.lessonUnlocked=3;legacy.selectedLesson=3;legacy.checkpoint=resumeSnapshot(oldRun);legacy.waveStart=snapshot(oldRun);
 const migrated=parseProfile(legacy);expect(migrated.version).toBe(3);expect(migrated.previousArchive).toEqual(legacy);expect(migrated.levelStars).toEqual({});expect(migrated.checkpoint).toBeNull();
 expect(()=>parseProfile({...migrated,packVersion:'unknown'})).toThrow();
});

it('covers every base spelling and keeps exclusions visible instead of shrinking the denominator',()=>{
 const all=new Set(READING_LEDGER.map(r=>r.base)),active=new Set(READING_LEDGER.filter(readingReleased).map(r=>r.base));
 expect(active).toEqual(all);expect(all.size).toBe(407);
 expect(READING_LEDGER.filter(r=>r.textValidation.status==='pending')).toEqual([]);
 expect(READING_LEDGER.filter(r=>r.textValidation.status==='excluded').every(r=>r.textValidation.reason.length>10)).toBe(true);
});
it('does not turn speech intonation examples into independent spelling evidence',()=>{
 const level=published.find(l=>l.releasedTargets.includes('reading-m2'))!;
 const s=createCharacterGarden(level.id);startWave(s);const id=knowledgePool(s).find(id=>ENTRY_MAP[id].guided)!;solve(s,id);
 expect(s.attempts[0].assisted).toBe(true);expect(s.attempts[0].firstTryCorrect).toBe(false);
 expect(composeParts({...partsFor('ḿ'),tone:1})).toBeNull();expect(composeParts(partsFor('ń'))).toBe('ń');
});
it('archives the previous v3 content pack without rejecting the entire player slot',()=>{
 const p=newProfile('原有花园');p.stars['1']=[true,false,false];p.levelStars['foundation-01']=[true,true,true];
 const old={...p,packVersion:'garden-character-3',checkpoint:{oldAnswer:'preserved'},waveStart:{oldWave:'preserved'}};
 const updated=parseProfile(old);expect(updated.packVersion).toBe('garden-adventure-4');expect(updated.checkpoint).toBeNull();expect(updated.stars).toEqual(p.stars);expect(updated.previousArchive).toEqual(old);expect(updated.levelStars).toEqual({});
});
it('all released carriers round trip and every target belongs to exactly one lesson',()=>{
 for(const r of READING_LEDGER.filter(readingReleased)){
  expect(published.filter(l=>l.releasedTargets.includes(r.id))).toHaveLength(1);
  const carriers=Object.values(ENTRY_MAP).filter(e=>e.readingId===r.id);expect(carriers.length).toBeGreaterThan(0);
  for(const e of carriers){expect(composeParts(e.parts[0]),e.id).toBe(e.pinyin[0]);if(r.track!=='challenge')expect(r.entries.find(c=>c.id===e.id)?.common,e.id).toBe(true);}
 }
});
it('varied seeds keep all plans valid and never leak challenge readings into ordinary lessons',()=>{
 for(const l of published)for(const seed of ['rotation-1','rotation-2','rotation-3']){
  const s=createCharacterGarden(l.id,1,[],seed);expect(()=>parseState(resumeSnapshot(s)),l.id).not.toThrow();
  if(l.track!=='challenge')for(const wave of s.learningPlan!.waves)for(const id of wave.entries){const r=READING_LEDGER.find(r=>r.id===ENTRY_MAP[id].readingId);if(r)expect(r.track).not.toBe('challenge');}
 }
});
it('merges ordinary audio groups without singleton adventures or lost readings',()=>{
 const ordinary=CHARACTER_LEVELS.filter(l=>l.track==='main');
 expect(ordinary.every(l=>l.targets.length>=4&&l.targets.length<=6)).toBe(true);
 expect(CHARACTER_LEVELS.every(l=>l.targets.length>=2)).toBe(true);
 const missingAudio=READING_LEDGER.filter(r=>r.track==='supplement'&&readingReleased(r));
 for(const r of missingAudio)expect(ordinary.filter(l=>l.targets.includes(r.id))).toHaveLength(1);
});
it('opens all battlefields for new saves and migrates the full previous pack with history intact',()=>{
 const p=newProfile('旧版');expect(p.unlocked).toBe(5);
 const old={...p,packVersion:'garden-character-3.1',unlocked:1,selectedLevel:'supplement-sha2',levelStars:{'supplement-sha2':[true,true,true]},stars:{'1':[true,false,false]},checkpoint:{oldPlan:true},waveStart:{oldStart:true}};
 const updated=parseProfile(old);expect(updated.unlocked).toBe(5);expect(updated.selectedLevel).toMatch(/^adventure-08-/);expect(updated.levelStars).toEqual({});expect(updated.stars).toEqual(old.stars);expect(updated.previousArchive).toEqual(old);
 expect(parseProfile(JSON.parse(JSON.stringify(updated)))).toEqual(updated);
 for(const battleStage of [1,2,3,4,5])expect(parseProfile({...updated,battleStage}).battleStage).toBe(battleStage);
});
it('help reveals only the current card and keeps independent evidence for untouched cards',()=>{
 const l=CHARACTER_LEVELS.find(l=>l.chapter===3&&l.track==='main')!;const s=createCharacterGarden(l.id,1,[],'help-only-current');startWave(s);const [first,second]=knowledgePool(s);
 selectKnowledge(s,first);requestHelp(s);s.helpOpen=false;solve(s,first);solve(s,second);
 expect(s.revealed).toEqual([`0:${first}`]);expect(s.attempts.find(a=>a.entryId===first)?.assisted).toBe(true);expect(s.attempts.find(a=>a.entryId===second)?.referenceVisible).toBe(false);
});

it('maps every old lesson to the adventures containing its original surviving targets',()=>{
 for(const old of Object.values(LEGACY_CHARACTER_LEVEL_MAP)){
  const mapped=adventureMigration[old.id];expect(mapped.length).toBeGreaterThan(0);expect(resolveAdventure(old.id)).toBeDefined();
  if(old.track==='foundation')continue;
  for(const id of old.targets.filter(id=>READING_LEDGER.some(r=>r.id===id&&readingReleased(r))))expect(mapped.some(next=>CHARACTER_LEVELS.find(l=>l.id===next)!.targets.includes(id))).toBe(true);
 }
});

it('continues from letters into ordinary adventures without automatically entering rare challenges',()=>{
 expect(CHARACTER_LEVELS.find(l=>l.id===nextAdventure('foundation-06'))?.track).toBe('main');
 const last=CHARACTER_LEVELS.filter(l=>l.track==='main').at(-1)!;expect(nextAdventure(last.id)).toBeUndefined();
});
