import {Waji} from '../../../ui/Waji';
import {useState,type CSSProperties} from 'react';
import {ENTRY_MAP,type GardenState} from '@children-games/shared';
import {GardenModal} from './GardenModal';
import {ToneMark} from './GardenIcon';
import {entryPronunciation} from '../services/pronunciation';
export function SpellingHelp({state,onClose,onPronounce}:{state:GardenState;onClose:()=>void;onPronounce:(values:string[])=>void}){
 const [replay,setReplay]=useState(0);const task=state.task!;const entry=ENTRY_MAP[task.entryId];const parts=entry.parts[task.index];const pieces=[parts.initial,parts.medial,parts.final,parts.whole].filter(Boolean);
 return <GardenModal label="教我拼" className="spelling-help"><span className="home-label">伙伴帮忙时，花园暂停</span><div className="waji-help-heading"><Waji mood="think" animate/><h2>一起拼这张卡</h2></div><p className="help-context"><strong>{entry.text}</strong> {entry.context??'认清卡片，再找一样的部件'}</p><div key={replay} className="spelling-demo" aria-label={`示范 ${entry.pinyin[task.index]}`}>{pieces.map((p,i)=><span className="demo-piece" key={i} style={{'--step':i} as CSSProperties}>{p}</span>)}{!!parts.tone&&<span className="demo-piece" style={{'--step':pieces.length} as CSSProperties}><ToneMark tone={parts.tone}/><small>{['一声','二声','三声','四声','轻声'][parts.tone-1]}</small></span>}<span className="demo-arrow">→</span><strong className="demo-result" style={{'--step':pieces.length+1} as CSSProperties}>{entry.pinyin[task.index]}</strong></div><p>{entry.type==='symbol'?'看清字母的形状，找到一样的卡片。':'依次找出这些部件，再加上声调，就拼好啦。'}</p><p className="adventure-note">请伙伴帮忙也能守住花园。这张卡记为借助提示，不算独立拼写。</p><div className="panel-actions"><button onClick={()=>setReplay(n=>n+1)}>再看一次</button>{entryPronunciation(entry).length>0&&<button onClick={()=>onPronounce(entry.pinyin)}>听一听</button>}<button className="primary" onClick={onClose}>我来试试</button></div></GardenModal>;
}
