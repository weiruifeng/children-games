import type {historySummary} from '../../../../../shared/src/pinyin-garden/cloud-history';
import {useMemo,useState} from 'react';
import {ENTRIES,learningFacts,type LearningAttempt} from '@children-games/shared';
export function WordCollection({attempts,summary}:{attempts:LearningAttempt[];summary?:ReturnType<typeof historySummary>}){
 const [page,setPage]=useState(0);
 const entries=useMemo(()=>ENTRIES.filter(e=>!!e.readingId),[]);
 const groups=useMemo(()=>{const map=new Map<string,LearningAttempt[]>();for(const a of attempts){const list=map.get(a.entryId)??[];list.push(a);map.set(a.entryId,list);}return map;},[attempts]);
 const pages=Math.max(1,Math.ceil(entries.length/48));
 return <section><div className="word-collection">{entries.slice(page*48,page*48+48).map(e=>{const records=groups.get(e.id)??[];const facts=summary?.entries[e.id]??learningFacts(records,e.id);return <article key={e.id}><small>{e.pinyin.join(' ')}</small><strong>{e.text}</strong><span>{facts.independent>0?'独立完成过':records.some(a=>a.correct)?'提示后完成过':'等待相遇'}</span>{facts.attempts>0&&<small>尝试 {facts.attempts} 次 · 独立完成 {facts.independent} 次 · {facts.days} 天</small>}</article>;})}</div><div className="panel-actions"><button disabled={page===0} onClick={()=>setPage(page-1)}>上一页</button><span>{page+1} / {pages}</span><button disabled={page>=pages-1} onClick={()=>setPage(page+1)}>下一页</button></div></section>;
}
