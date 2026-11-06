import {entryAllowed,lessonPool} from './curriculum';
import {ENTRY_MAP,LEVELS} from './content';
import {createGarden,createLessonGarden} from './simulation';
import type {GardenState,LearningAttempt} from './model';

/** Disjoint buckets, then redistribute unused slots; no unseen entries. */
export function reviewEntries(attempts:LearningAttempt[],now=Date.now(),random:()=>number=Math.random):string[]{
 const latest=new Map<string,LearningAttempt>();
 for(const a of attempts)if(ENTRY_MAP[a.entryId]&&(!latest.has(a.entryId)||a.at>=latest.get(a.entryId)!.at))latest.set(a.entryId,a);
 const syllables=new Map<string,LearningAttempt>();for(const a of attempts){const key=`${a.entryId}:${a.syllable}`;if(!syllables.has(key)||a.at>=syllables.get(key)!.at)syllables.set(key,a);}
 const isWeak=(id:string)=>ENTRY_MAP[id].parts.some((_,i)=>{const a=syllables.get(`${id}:${i}`);return !a||!a.correct||a.assisted||a.firstTryCorrect===false;});
 const shuffle=(ids:string[])=>{const result=[...ids];for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.max(0,Math.min(.999999,random()))*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;};
 const weak=[...latest].filter(([id])=>isWeak(id)).sort((a,b)=>b[1].at-a[1].at).map(([id])=>id);
 const due=[...latest].filter(([id,a])=>!weak.includes(id)&&now-a.at>=86400000).sort((a,b)=>a[1].at-b[1].at).map(([id])=>id);
 const familiar=shuffle([...latest.keys()].filter(id=>!weak.includes(id)&&!due.includes(id)));
 const selected=[...weak.slice(0,5),...due.slice(0,3),...familiar.slice(0,2)];
 for(const id of [...weak,...due,...familiar])if(selected.length<10&&!selected.includes(id))selected.push(id);
 return selected;
}
export function knowledgePool(s:GardenState):string[]{return s.learningPlan?s.learningPlan.waves[s.wave].entries:s.reviewPool?.length?s.reviewPool:s.lessonId?lessonPool(s.lessonId,s.wave,s.level):LEVELS[s.level-1].entries;}
export function createReview(attempts:LearningAttempt[],now=Date.now(),lessonId?:number,battleStage=1):GardenState {
 if(lessonId)attempts=attempts.filter(a=>a.lessonId&&entryAllowed(a.entryId,lessonId)&& (battleStage>=3||ENTRY_MAP[a.entryId].type!=='word'));
 const pool=reviewEntries(attempts,now);if(!pool.length)throw new Error('还没有可复习的字词');
 const s=lessonId?createLessonGarden(lessonId,battleStage,(now>>>0)||173):createGarden(5,(now>>>0)||173);s.reviewPool=pool;s.message='熟悉的字词又来啦！拼好一次，全队共享。';return s;
}
export function learningFacts(attempts:LearningAttempt[],entryId:string){
 const rows=attempts.filter(a=>a.entryId===entryId);
 const independent=rows.filter(a=>a.correct&&!a.assisted&&!a.repeated&&a.firstTryCorrect===true&&!!a.levelId&&!a.referenceVisible&&!a.retry&&(a.optionCount??0)>1);
 const days=new Set(independent.map(a=>new Date(a.at).toLocaleDateString('en-CA')));
 return {attempts:rows.length,independent:independent.length,assisted:rows.filter(a=>a.assisted).length,days:days.size,last:rows.reduce((n,a)=>Math.max(n,a.at),0)};
}
