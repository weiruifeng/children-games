import {candidates,composeParts,ENTRIES,ENTRY_MAP,FINALS,hasSharedAmmo,INITIALS,LEVELS,MEDIALS,type GardenState,type Parts} from '@children-games/shared';

export function SharedWorkbench({state:s,onSelect,onPart,onChoice,onHelp}:{state:GardenState;onSelect:(id:string)=>void;onPart:(key:keyof Parts,value:string|number)=>void;onChoice:(text:string)=>void;onHelp:()=>void}){
 const t=s.task,entry=t?ENTRY_MAP[t.entryId]:null,answer=t&&entry?entry.parts[t.index]:null;
 const blocked=s.paused||s.helpOpen||s.stage!=='playing';
 const fields:('initial'|'medial'|'final'|'whole')[]=answer?.whole?['whole']:['initial','medial','final'];
 const labels={initial:'声母',medial:'介音',final:'韵母',whole:'整体音节'};
 const pools={initial:INITIALS,medial:MEDIALS,final:FINALS,whole:['yu','yue','yun','ri','ye','shi']};
 const complete=t&&answer&&[...fields,'tone' as const].every(k=>!answer[k]||!!t.parts[k]);
 const pieceOptions=(correct:string,pool:string[])=>{const all=candidates(correct,pool,Number(entry!.id.split('-')[1])+t!.index);const keep=[correct,...all.filter(v=>v!==correct).slice(0,2)];return all.filter(v=>keep.includes(v));};
 const options=entry?[entry,...ENTRIES.filter(e=>e.type===entry.type&&e.id!==entry.id&&e.pinyin.join(' ')!==entry.pinyin.join(' ')).slice(0,2)].sort((a,b)=>a.id.localeCompare(b.id)):[];
 return <section className="workbench shared-workbench" aria-label="全队拼音弹药台">
  <div className={`shared-target ${entry&&entry.text.length>1?'word-target':''}`}><strong>{t?.mode==='choose'?'？':entry?.text??'✦'}</strong><span>{t?.finished?'已共享 ∞':entry&&entry.parts.length>1?`${t!.index+1} / ${entry.parts.length} 音节`:'拼好即共享'}</span><button className="help-button" disabled={blocked||!t||t.finished} aria-label="拼音帮助" onClick={onHelp}>?</button></div>
  <div className="shared-composer">
   {t&&entry&&answer?<>
    <div className="shared-slots" aria-label="已选拼音">{t.mode==='choose'?<strong className="shared-reading">{entry.pinyin.join(' ')}</strong>:<>{fields.filter(k=>answer[k]).map(k=><div key={k} className={`shared-slot ${complete&&t.parts[k]!==answer[k]?'needs-check':''}`}><small>{labels[k]}</small><b>{t.parts[k]||'—'}</b></div>)}<div className={`shared-slot ${complete&&t.parts.tone!==answer.tone?'needs-check':''}`}><small>声调</small><b>{['—','ˉ','ˊ','ˇ','ˋ'][t.parts.tone]}</b></div></>}
     {entry.parts.length>1&&<span className="word-progress">{entry.pinyin.slice(0,t.index).join(' ')}{t.index>0?' ✓':''}</span>}
    </div>
    {t.mode==='choose'?<div className="shared-word-options">{options.map(e=><button key={e.id} disabled={blocked||t.finished} onClick={()=>onChoice(e.text)}>{e.text}</button>)}</div>:<div className="shared-options">{fields.filter(k=>answer[k]).map(k=><div className="shared-group" key={k}><span>{labels[k]}</span><div>{(t.help>=2?[answer[k]]:pieceOptions(answer[k],pools[k])).map(v=><button key={v} className={t.parts[k]===v?'chosen':''} aria-pressed={t.parts[k]===v} disabled={blocked||t.finished} onClick={()=>onPart(k,v)}>{v}</button>)}</div></div>)}<div className="shared-group shared-tones"><span>声调</span><div>{['ˉ','ˊ','ˇ','ˋ'].map((v,i)=><button key={v} aria-label={['一声','二声','三声','四声'][i]} aria-pressed={t.parts.tone===i+1} className={t.parts.tone===i+1?'chosen':''} disabled={blocked||t.finished} onClick={()=>onPart('tone',i+1)}>{v}<small>{['一声','二声','三声','四声'][i]}</small></button>)}</div></div></div>}
    <span className="shared-status" role="status">{t.finished?`${entry.pinyin.join(' ')}，全队可用`:t.errors?s.message:composeParts(t.parts)??'点选拼音，本波全队共享'}</span>
   </>:<div className="shared-start"><strong>{s.stage==='ready'?'拖伙伴到空地':'准备下一波'}</strong><span>{s.stage==='ready'?'开始后，拼好一次，全队使用':'伙伴保留 · 弹药重新补充'}</span></div>}
  </div>
  <div className="shared-bank"><strong>全队弹药</strong><div className="shared-bank-grid">{LEVELS[s.level-1].entries.map(id=>{const e=ENTRY_MAP[id],unlocked=hasSharedAmmo(s,id),present=s.enemies.some(en=>en.entryId===id);return <button key={id} aria-label={`选择${e.text}的弹药`} aria-pressed={t?.entryId===id} className={`${unlocked?'unlocked':''} ${t?.entryId===id?'current':''} ${present?'needed':''}`} disabled={blocked} onClick={()=>onSelect(id)}><b>{unlocked?e.pinyin.join(' '):e.text}</b><span>{unlocked?'∞':present?'◉':'◌'}</span></button>;})}</div><small>本波无限用</small></div>
 </section>;
}
