import {describe,it,expect} from 'vitest';
import {createReview,knowledgePool,reviewEntries} from './review';
import {legacyProfile as newProfile,parseLegacyProfile as parseProfile} from './snapshot';
import {selectKnowledge,snapshot,startWave,tickGarden} from './simulation';
import {ENTRIES} from './content';
import type {LearningAttempt} from './model';
const now=1700000000000;
const attempt=(i:number,correct=true,at=now):LearningAttempt=>({entryId:ENTRIES[i].id,taskId:String(i),syllable:0,correct,assisted:false,repeated:false,at});
describe('review battles',()=>{
 it('selects disjoint 50/30/20 buckets without introducing unseen words',()=>{
  const rows=Array.from({length:20},(_,i)=>attempt(i,i>=8,i>=8&&i<14?now-2*86400000:now));
  const ids=reviewEntries(rows,now,()=>.3);expect(ids).toHaveLength(10);expect(new Set(ids).size).toBe(10);
  expect(ids.filter(id=>rows.find(a=>a.entryId===id)!.correct===false)).toHaveLength(5);
  expect(ids.filter(id=>now-rows.find(a=>a.entryId===id)!.at>=86400000)).toHaveLength(3);
 });
 it('redistributes empty buckets and handles old records out of order',()=>{
  expect(reviewEntries([attempt(1),attempt(2)],now)).toHaveLength(2);
  expect(reviewEntries([],now)).toEqual([]);expect(()=>createReview([])).toThrow();
 });
 it('uses the selected knowledge for spawning, assembling and saved checkpoints',()=>{
  const s=createReview([attempt(0)],now);startWave(s);tickGarden(s,.1);for(let i=0;i<130;i++)tickGarden(s,.1);
  expect(s.enemies.length).toBeGreaterThan(0);expect(s.enemies.every(e=>knowledgePool(s).includes(e.entryId))).toBe(true);
  expect(selectKnowledge(s,ENTRIES[0].id)).toBe(true);expect(selectKnowledge(s,ENTRIES[1].id)).toBe(false);
  const p=newProfile('test');p.unlocked=5;p.attempts=[attempt(0)];p.stars['5']=[true,false,false];p.checkpoint=snapshot(s);
  expect(parseProfile(p).checkpoint?.reviewPool).toEqual([ENTRIES[0].id]);
  p.stars={};expect(()=>parseProfile(p)).toThrow('复习模式尚未解锁');
 });
 it('loads old profiles without review data',()=>{expect(parseProfile(newProfile('old')).checkpoint).toBeNull();});
});
