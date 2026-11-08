import type {historySummary} from '../../../../../shared/src/pinyin-garden/cloud-history';
import {useMemo,useState} from 'react';
import {READING_LEDGER,readingReleased,readingFacts,coverageSummary,type LearningAttempt} from '@children-games/shared';
const labels:Record<string,string>={main:'常用字主线',supplement:'常用字补充',challenge:'挑战附加'};
export function CoverageReport({attempts,summary:history}:{attempts:LearningAttempt[];summary?:ReturnType<typeof historySummary>}){
 const [query,setQuery]=useState('');const [status,setStatus]=useState('all');const [page,setPage]=useState(0);
 const summary=coverageSummary();
 const groups=useMemo(()=>{const m=new Map<string,LearningAttempt[]>();for(const a of attempts)if(a.readingId){const list=m.get(a.readingId)??[];list.push(a);m.set(a.readingId,list);}return m;},[attempts]);
 const rows=READING_LEDGER.filter(r=>(status==='all'||status==='released'&&readingReleased(r)||status==='excluded'&&r.textValidation.status==='excluded')&&`${r.key} ${r.pinyin} ${r.entries.map(e=>e.text+' '+e.context).join(' ')}`.includes(query.trim()));
 const pages=Math.max(1,Math.ceil(rows.length/30));const current=Math.min(page,pages-1);
 return <section className="coverage-report"><h2>读音覆盖清单</h2><p>原始清单 {summary.total} 项 · 可练 {summary.published} 项 · 本版不采用 {summary.excluded} 项 · 待完善 {summary.pending} 项。字音资料验证不等于逐条录音听审；点读未就绪不影响文字练习。</p>
 <div className="coverage-controls"><label>查字或拼音<input aria-label="查字或拼音" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/></label><label>内容状态<select aria-label="内容状态" value={status} onChange={e=>{setStatus(e.target.value);setPage(0);}}><option value="all">全部</option><option value="released">可练内容</option><option value="excluded">本版不采用及原因</option></select></label></div>
 <ul className="coverage-list">{rows.slice(current*30,current*30+30).map(r=>{const facts=history?.readings[r.id]??readingFacts(groups.get(r.id)??[],r.id);return <li key={r.id}><strong>{r.pinyin} · {r.entries.filter(e=>e.verification.status==='source-verified').map(e=>e.text).join('、')||r.entries.map(e=>e.text).join('、')}</strong><span>{labels[r.track]} · {readingReleased(r)?'可练':'本版不采用'}</span><small>{r.textValidation.status==='excluded'?r.textValidation.reason:`尝试 ${facts.attempts} · 独立完成 ${facts.independent} · ${facts.repeatedIndependent?'有多次独立记录':'继续积累记录'}`}</small>{r.entries.some(e=>e.guided)&&<small>语气读音使用示范练习，不计独立拼写。</small>}</li>;})}</ul>
 <div className="panel-actions"><button disabled={current===0} onClick={()=>setPage(current-1)}>上一页</button><span>{current+1} / {pages} · {rows.length} 项</span><button disabled={current>=pages-1} onClick={()=>setPage(current+1)}>下一页</button></div></section>;
}
