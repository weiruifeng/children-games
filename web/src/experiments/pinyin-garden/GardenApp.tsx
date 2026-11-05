import {useEffect,useRef,useState} from 'react';
import {allowedPlants,collectDrop,createGarden,ENTRIES,ENTRY_MAP,LEVELS,newProfile,parseProfile,placePlant,PLANTS,PLANT_IDS,removePlant,requestHelp,selectPlant,snapshot,starsFor,startWave,selectKnowledge,applyDemonstration,type GardenState,type Parts,type PlantKind,type Profile} from '@children-games/shared';
import {createGardenGame} from './game/createGame';
import {boardPoint,canDropPlant} from './ui/touchBoard';
import {DragCard} from './ui/DragCard';
import {acquireTarget,finishAssembly,placeAmmoPart} from './ui/quickAssembly';
import {SharedWorkbench} from './ui/SharedWorkbench';
import {PartnerIcon} from './ui/PartnerIcon';
import {clearProfile,exportRawProfiles,loadProfiles,saveProfile} from './services/saveStore';

import {useGardenAudio} from './services/useGardenAudio';

type Page='slots'|'home'|'battle'|'collection'|'settings';
const slotNames=['苔芽的小花园','溪边的小花园','星叶的小花园'];
function download(data:unknown,name:string){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function GardenApp(){
 const [page,setPage]=useState<Page>('slots');const [profiles,setProfiles]=useState<(Profile|null)[]>([null,null,null]);const [slot,setSlot]=useState(0);const [profile,setProfile]=useState<Profile|null>(null);
 const [view,setView]=useState<GardenState>(()=>createGarden());const state=useRef(view);const currentProfile=useRef<Profile|null>(null);const checkpoint=useRef<GardenState|null>(null);
 const [selected,setSelected]=useState<PlantKind|null>(null);const selectedRef=useRef(selected);const [shovel,setShovel]=useState(false);const shovelRef=useRef(false);
 const [notice,setNotice]=useState('');const [saveError,setSaveError]=useState('');const [loading,setLoading]=useState(true);const [intro,setIntro]=useState(false);const [tab,setTab]=useState<'partners'|'words'|'parent'>('partners');
 const host=useRef<HTMLDivElement>(null);const imports=useRef<HTMLInputElement>(null);const saveQueue=useRef(Promise.resolve());const lastStage=useRef('');const onFrame=useRef(()=>{});
 const placement=useRef<{kind:PlantKind;row:number;col:number;valid:boolean}|null>(null);
 const [launchNotice,setLaunchNotice]=useState('');const launchUntil=useRef(0);const launchEvent=useRef(0);
 const audio=useGardenAudio(page,state.current,profile?.settings);
 const pointAt=(x:number,y:number)=>{const r=host.current?.querySelector('canvas')?.getBoundingClientRect();return r?boardPoint(x,y,r):null;};
 const movePartner=(kind:PlantKind,x:number,y:number)=>{const p=pointAt(x,y);placement.current=p?{kind,row:p.row,col:p.col,valid:canDropPlant(state.current,kind,p.row,p.col)}:null;};
 const dropPartner=(kind:PlantKind,x:number,y:number)=>{const p=pointAt(x,y);if(p&&canDropPlant(state.current,kind,p.row,p.col)){placePlant(state.current,kind,p.row,p.col);setSelected(null);selectedRef.current=null;state.current.message='伙伴到位！拼好弹药，全队自动攻击。';}else state.current.message='拖到亮着的空地再松手，不会扣露珠。';placement.current=null;update();};
 const update=()=>setView({...state.current});
 const persist=(p:Profile)=>{
  currentProfile.current=p;setProfile(p);setProfiles(old=>old.map((v,i)=>i===slot?p:v));
  saveQueue.current=saveQueue.current.catch(()=>{}).then(()=>saveProfile(slot,p));saveQueue.current.then(()=>setSaveError(''),e=>setSaveError(`保存失败：${String(e)}。可导出备份后重试。`));
 };
 const mergeAttempts=(p:Profile)=>{const map=new Map([...p.attempts,...state.current.attempts].map(a=>[`${a.taskId}:${a.entryId}:${a.at}:${a.correct}:${a.repeated}`,a]));return [...map.values()].slice(-45000);};
 const recordProgress=()=>{
  const p=currentProfile.current;if(!p)return;const s=state.current;let next={...p,attempts:mergeAttempts(p),checkpoint:s.stage==='lost'?checkpoint.current:snapshot(s),waveStart:checkpoint.current};
  if(s.stage==='won'){
   const earned=starsFor(s),old=p.stars[String(s.level)]??[false,false,false];
   const key=`${s.level}:garden-1:${s.slow?'slow':'normal'}:shared-2`;
   next={...next,unlocked:Math.min(5,Math.max(p.unlocked,s.level+1)),stars:{...p.stars,[s.level]:old.map((v,i)=>v||earned[i])},best:{...p.best,[key]:Math.max(p.best[key]??0,s.score)},checkpoint:null,waveStart:null};
  }
  persist(next);
 };
 const beginWave=()=>{if(startWave(state.current)){checkpoint.current=snapshot(state.current);lastStage.current='playing';recordProgress();update();}};
 onFrame.current=()=>{
  const s=state.current;
  if(s.stage!==lastStage.current){lastStage.current=s.stage;if(['between','won','lost'].includes(s.stage))recordProgress();}
  
  const launched=[...s.events].reverse().find(e=>e.type==='ammo_shared'&&e.id>launchEvent.current);
  if(launched){launchEvent.current=launched.id;launchUntil.current=Date.now()+1800;setLaunchNotice(`${launched.value} · 全队可用！`);}
  if(Date.now()>launchUntil.current){setLaunchNotice('');}
  if(!s.task&&!s.paused&&!s.helpOpen)acquireTarget(s);
  update();
 };
 useEffect(()=>{loadProfiles().then(setProfiles,e=>setSaveError(String(e))).finally(()=>setLoading(false));},[]);
 useEffect(()=>{selectedRef.current=selected;},[selected]);useEffect(()=>{shovelRef.current=shovel;},[shovel]);
 useEffect(()=>{
  if(page!=='battle'||!host.current)return;
  const game=createGardenGame(host.current,{state:()=>state.current,placement:()=>placement.current,change:()=>onFrame.current(),
   cell:(row,col)=>{if(selectedRef.current){if(placePlant(state.current,selectedRef.current,row,col)){selectedRef.current=null;setSelected(null);}}else state.current.message='先从左边选一位伙伴。';update();},
   plant:id=>{if(shovelRef.current)removePlant(state.current,id);else {selectPlant(state.current,id);setSelected(null);}update();},
   enemy:id=>{acquireTarget(state.current,id);setSelected(null);selectedRef.current=null;update();},drop:id=>{collectDrop(state.current,id);update();}},()=>currentProfile.current?.settings.reducedMotion??false);
  return ()=>{game.destroy(true);};
 },[page]);
 useEffect(()=>{const hidden=()=>{if(document.hidden&&page==='battle'){state.current.paused=true;recordProgress();update();}};document.addEventListener('visibilitychange',hidden);return ()=>document.removeEventListener('visibilitychange',hidden);});
 const openSlot=(index:number)=>{const p=profiles[index]??newProfile(slotNames[index]);setSlot(index);currentProfile.current=p;setProfile(p);setPage('home');setNotice('');};
 const enterLevel=(level:number,resume=false)=>{
  const p=currentProfile.current!;if(level>p.unlocked)return;
  const s=resume&&p.checkpoint?JSON.parse(JSON.stringify(p.checkpoint)) as GardenState:createGarden(level,173+level*71);
  s.slow=p.settings.slow;s.paused=false;s.helpOpen=false;state.current=s;checkpoint.current=resume?(p.waveStart??snapshot(s)):snapshot(s);lastStage.current=s.stage;
  setSelected(null);setShovel(false);launchEvent.current=0;launchUntil.current=0;setLaunchNotice('');setIntro(!resume);setView({...s});setPage('battle');
 };
 const retry=()=>{if(!checkpoint.current)return;const attempts=state.current.attempts;state.current=JSON.parse(JSON.stringify(checkpoint.current));state.current.attempts=attempts;state.current.paused=false;lastStage.current=state.current.stage;update();};
 const home=()=>{recordProgress();setPage('home');setIntro(false);setSelected(null);};
 const totalStars=profile?Object.values(profile.stars).flat().filter(Boolean).length:0;
 const act=(fn:()=>void)=>{fn();update();};
 const changeSetting=(key:keyof Profile['settings'],value:number|boolean)=>{const p=currentProfile.current;if(!p)return;const next={...p,settings:{...p.settings,[key]:value}};persist(next);if(key==='slow')state.current.slow=!!value;};
 const doImport=async(file:File)=>{try{if(file.size>5_000_000)throw new Error('文件超过 5MB');const p=parseProfile(JSON.parse(await file.text()));if(!window.confirm(`用备份「${p.name}」替换当前花园？`))return;await saveProfile(slot,p);currentProfile.current=p;setProfile(p);setProfiles(await loadProfiles());setNotice('备份已导入。');}catch(e){setNotice(`导入未完成：${String(e)}`);}};
 const task=view.task;const entry=task?ENTRY_MAP[task.entryId]:null;const answer=task?entry!.parts[task.index]:null;
 const putPart=(key:keyof Parts,value:string|number)=>{if(task)act(()=>placeAmmoPart(state.current,key,value,`${task.key}:${task.index}`));};
 return <div className={`garden-app ${page==='battle'?'battle-screen':''}`}>
  <header className="garden-topbar"><a href="/" className="brand"><span className="brand-seed">✦</span><span>拼音花园<small>种下勇气，拼出力量</small></span></a><nav><button onClick={audio.toggle} aria-label={audio.muted?'开启声音':audio.ready?'关闭声音':'点击开启声音'}>{audio.muted?'🔇':audio.ready?'🔊':'开启声音'}</button>{page!=='slots'&&<><button onClick={()=>{if(page==='battle')home();else setPage('home');}}>我的花园</button><button onClick={()=>{if(page==='battle')recordProgress();setPage('collection');}}>伙伴与知识</button><button onClick={()=>{if(page==='battle')recordProgress();setPage('settings');}}>设置</button></>}<span className="version-tag">开发试玩 · 01</span></nav></header>
  {saveError&&<div className="save-warning" role="alert">{saveError}<button onClick={()=>currentProfile.current&&persist(currentProfile.current)}>重试保存</button><button onClick={()=>void exportRawProfiles().then(data=>download(data,'garden-raw-backup.json'))}>导出原始备份</button></div>}
  {notice&&<div className="notice" role="status">{notice}<button onClick={()=>setNotice('')}>关闭</button></div>}
  {page==='slots'&&<main className="garden-landing"><div className="eyebrow">给每一个好奇的小园丁</div><h1>一颗种子，<br/><em>一个新的发现。</em></h1><p>拼好声母、韵母和声调，和花园伙伴一起<br/>守住溪谷里的小小苗圃。</p><div className="slot-grid">{profiles.map((p,i)=><button className="slot-card" disabled={loading} key={i} onClick={()=>openSlot(i)}><PartnerIcon kind={PLANT_IDS[i]} size={104}/><span>花园 {String(i+1).padStart(2,'0')}</span><strong>{p?.name??slotNames[i]}</strong><small>{loading?'正在打开存档…':p?`已开启 ${p.unlocked} / 5 个关卡`:'从一颗种子开始'}</small><b>进入花园 ↗</b></button>)}</div><p className="local-note">进度保存在这台设备 · 不需要注册 · 暂无学习读音</p></main>}
  {page==='home'&&profile&&<main className="garden-home"><section className="home-hero"><div><div className="eyebrow">溪谷苗圃 / 第一章</div><h1>今天，也来<br/><em>守护一点美好。</em></h1><p>墨团带着字词来啦。选好伙伴，把拼音变成力量。</p><div className="hero-actions">{profile.checkpoint?<button className="primary" onClick={()=>enterLevel(profile.checkpoint!.level,true)}>继续第 {profile.checkpoint.level} 关 · 第 {profile.checkpoint.wave+1} 波 →</button>:<button className="primary" onClick={()=>enterLevel(profile.unlocked)}>开始探险 →</button>}<span className="star-total">✦ {totalStars} / 15 花园星</span></div></div><div className="hero-illustration"><div className="orbit one"/><div className="orbit two"/><PartnerIcon kind="plant_pod_slinger" size={200}/><div className="hero-dew"><PartnerIcon kind="plant_dew_collector" size={120}/></div><span className="paper-label">m + a + ˇ = mǎ</span></div></section>
   <div className="section-title"><h2>沿着小路，一起出发</h2><span>每关三波 · 可以随时暂停</span></div><div className="level-grid">{LEVELS.map((l,i)=><button className={`level-card ${l.id>profile.unlocked?'locked':''}`} disabled={l.id>profile.unlocked} key={l.id} onClick={()=>enterLevel(l.id)}><span className="level-number">0{l.id}</span><span className="level-art"><PartnerIcon kind={PLANT_IDS[Math.min(i,3)]} size={76}/></span><strong>{l.name}</strong><small>{l.subtitle}</small><span className="level-stars">{(profile.stars[String(l.id)]??[false,false,false]).map((s,i)=><b className={s?'earned':''} key={i}>✦</b>)}</span><span className="level-link">{l.id>profile.unlocked?'完成前一关解锁':'走这条小路 →'}</span></button>)}</div><div className="home-footer"><span>今日花园 · {profile.name}</span><button onClick={()=>setPage('slots')}>切换花园</button><button onClick={()=>{setTab('parent');setPage('collection');}}>看看学习记录</button></div></main>}
  {page==='battle'&&<main className="battle-main"><div className="portrait-notice">把设备横过来，能更清楚地看见花园和拼音工坊。</div><div className="battle-heading"><div><span className="eyebrow">溪谷苗圃 / 0{view.level}</span><h1>{LEVELS[view.level-1].name}</h1></div><div className="battle-stats"><span className="dew-count">♦ {view.dew}<small>露珠</small></span><span className="hearts">{'♥'.repeat(view.hearts)}{'♡'.repeat(3-view.hearts)}</span><span>第 {view.wave+1} / 3 波</span><span>{view.score}<small>得分</small></span><button onClick={()=>act(()=>{state.current.paused=!state.current.paused;})}>{view.paused?'继续':'暂停'}</button></div></div>
   <div className="battle-layout"><aside className="partner-rack"><span className="rack-title">花园伙伴</span>{PLANT_IDS.map(kind=><DragCard key={kind} className="partner-card" chosen={selected===kind} onDragMove={(x,y)=>movePartner(kind,x,y)} onDragEnd={()=>{placement.current=null;}} onDrop={(x,y)=>dropPartner(kind,x,y)} disabled={intro||!allowedPlants(view.level).includes(kind)||view.paused||view.helpOpen||view.cooldowns[kind]>0||view.dew<PLANTS[kind].cost} onPlace={()=>{setSelected(kind);setShovel(false);state.current.message='把伙伴卡拖到空地就能种下，也可以点空地。';update();}}><PartnerIcon kind={kind}/><strong>{PLANTS[kind].name}</strong><span>{allowedPlants(view.level).includes(kind)?`♦ ${PLANTS[kind].cost}`:'尚未解锁'}</span>{view.cooldowns[kind]>0&&<small>准备 {Math.ceil(view.cooldowns[kind])} 秒</small>}</DragCard>)}<button className={`shovel ${shovel?'selected':''}`} onClick={()=>{setShovel(!shovel);setSelected(null);}}>移植工具<small>收回伙伴 · 返还一半露珠</small></button></aside>
    <div className="field-frame">{launchNotice&&<div className="launch-notice" role="status">{launchNotice}</div>}<div ref={host} className="game-canvas"/>{(intro||view.paused||['won','lost'].includes(view.stage))&&!view.helpOpen&&<div className="field-overlay"><div className="overlay-paper">
     {view.stage==='won'?<><span className="eyebrow">每一次认真，都让花园更美好</span><h2>花园守住啦！</h2><div className="result-stars">{starsFor(view).map((s,i)=><span className={s?'earned':''} key={i}>✦<small>{['守护','拼读','策略'][i]}</small></span>)}</div><p>本关 {view.score} 分 · 独立完成 {Object.values(view.results).filter(r=>r.independent).length} 个任务</p><button className="primary" onClick={()=>view.level<5?enterLevel(view.level+1):home()}>{view.level<5?'下一条小路 →':'回到花园 →'}</button><button onClick={()=>enterLevel(view.level)}>再挑战一次</button></>:
     view.stage==='lost'?<><span className="eyebrow">没关系，我们还有办法</span><h2>从这一波，再来一次。</h2><p>伙伴、露珠和分数会回到本波开始，练习记录会保留。</p><button className="primary" onClick={retry}>重试第 {view.wave+1} 波</button><button onClick={home}>先回花园</button></>:
     view.paused?<><h2>花园休息一下。</h2><p>准备好以后，再一起出发。</p><button className="primary" onClick={()=>act(()=>{state.current.paused=false;})}>继续守护 →</button><button onClick={home}>保存并回到花园</button></>:
     <><span className="eyebrow">{view.stage==='between'?'这一波，守住了':'今天的字词伙伴'}</span><h2>{view.stage==='between'?'准备好迎接下一波？':LEVELS[view.level-1].subtitle}</h2><div className="intro-words">{LEVELS[view.level-1].entries.map(id=><span key={id}><small>{ENTRY_MAP[id].pinyin.join(' ')}</small>{ENTRY_MAP[id].text}</span>)}</div><p>拖伙伴种植；拼好一次，全队本波无限使用。</p><small className="strategy-note">策略星：{LEVELS[view.level-1].strategy}</small>{intro?<button className="primary" onClick={()=>setIntro(false)}>认识啦，布置花园 →</button>:<button className="primary" onClick={beginWave}>{view.stage==='between'?`开始下一波（${Math.ceil(view.betweenTime)}秒）`:'开始第一波 →'}</button>}<button onClick={()=>{setIntro(false);if(view.stage==='between')act(()=>{state.current.paused=true;});}}>先布置伙伴</button></>}
    </div></div>}</div></div>
   <SharedWorkbench state={view} onSelect={id=>act(()=>{selectKnowledge(state.current,id);})} onPart={putPart} onChoice={text=>act(()=>{if(state.current.task){state.current.task.choice=text;finishAssembly(state.current);}})} onHelp={()=>act(()=>requestHelp(state.current))}/>
   <div className="battle-footnote">{['ready','between'].includes(view.stage)&&<button className="primary" onClick={beginWave}>{view.stage==='ready'?'开始第一波 →':'开始下一波 →'}</button>}<span>策略星：{LEVELS[view.level-1].strategy}</span><button onClick={()=>{changeSetting('slow',!view.slow);update();}}>{view.slow?'慢速战斗已开':'切换慢速战斗'}</button><button onClick={home}>保存并离开</button></div>
   {view.helpOpen&&task&&entry&&<div className="modal-shade"><div className="help-paper"><span className="eyebrow">慢慢来，花园已暂停</span><h2>{entry.text[task.index]}</h2><div className="help-pinyin">{entry.pinyin[task.index]}</div><p>{task.help===1?'看看完整拼音，再回去组合。':task.help===2?'正确的部件已经留在工坊里了。':'按下面的顺序，把部件放在一起。'}</p><div className="demo-parts">{[answer?.initial,answer?.medial,answer?.final,answer?.whole,['','ˉ','ˊ','ˇ','ˋ'][answer?.tone??0]].filter(Boolean).map((v,i)=><span key={i} style={{animationDelay:`${i*.4}s`}}>{v}</span>)}</div><button className="primary" onClick={()=>act(()=>{if(state.current.task!.help>=3){applyDemonstration(state.current);finishAssembly(state.current);}else state.current.helpOpen=false;})}>回去试一试 →</button>{task.help<3&&<button onClick={()=>act(()=>requestHelp(state.current))}>再帮我一点</button>}</div></div>}
  </main>}
  {page==='collection'&&profile&&<main className="collection-page"><div className="eyebrow">每一个发现，都值得收藏</div><h1>花园收藏册</h1><div className="tabs">{(['partners','words','parent'] as const).map((t,i)=><button className={tab===t?'active':''} key={t} onClick={()=>setTab(t)}>{['花园伙伴','字词收藏','给家长'][i]}</button>)}</div>
   {tab==='partners'?<><div className="partner-collection">{PLANT_IDS.map(k=><article key={k}><PartnerIcon kind={k} size={130}/><h2>{PLANTS[k].name}</h2><p>{PLANTS[k].description}</p><span>{allowedPlants(profile.unlocked).includes(k)?'已经加入花园':'继续探险，认识新伙伴'}</span></article>)}</div><h2>花园的礼物</h2><div className="decoration-list">{['小旗帜','溪谷配色','园丁名牌','温室灯光','守护者徽章'].map((name,i)=><div className={totalStars>=(i+1)*3?'unlocked':''} key={name}>✦<strong>{name}</strong><small>{(i+1)*3} 颗花园星</small></div>)}</div></>:
    tab==='words'?<div className="word-collection">{ENTRIES.map(e=>{const records=profile.attempts.filter(a=>a.entryId===e.id);return <article key={e.id}><small>{e.pinyin.join(' ')}</small><strong>{e.text}</strong><span>{records.some(a=>a.correct&&!a.assisted&&!a.repeated)?'独立完成过':records.some(a=>a.correct)?'提示后完成过':'等待相遇'}</span></article>;})}</div>:<section className="parent-notes"><h2>看见进步，不急着下结论。</h2><p>这里记录实际尝试，不把一次答对当成“已经掌握”。本版练习字形、拼音组合和声调标记，暂不包含发音示范或听音训练。</p><div className="parent-stats"><span><strong>{profile.attempts.length}</strong>次尝试</span><span><strong>{profile.attempts.filter(a=>a.correct&&!a.assisted&&!a.repeated).length}</strong>次独立完成</span><span><strong>{profile.attempts.filter(a=>a.assisted).length}</strong>次借助提示</span></div><p>进度只保存在当前浏览器。更换设备或清理浏览器前，请导出备份。</p><button onClick={()=>download(profile,'pinyin-garden-backup.json')}>导出学习与存档备份</button></section>}
  </main>}
  {page==='settings'&&profile&&<main className="settings-page"><div className="eyebrow">按照自己的节奏</div><h1>花园设置</h1><section className="settings-paper"><label>慢速战斗<input type="checkbox" checked={profile.settings.slow} onChange={e=>changeSetting('slow',e.target.checked)}/></label><label>减少动态效果<input type="checkbox" checked={profile.settings.reducedMotion} onChange={e=>changeSetting('reducedMotion',e.target.checked)}/></label><label>音乐音量<input aria-label="音乐音量" type="range" min="0" max="1" step="0.05" value={profile.settings.music} onChange={e=>changeSetting('music',Number(e.target.value))}/></label><label>音效音量<input aria-label="音效音量" type="range" min="0" max="1" step="0.05" value={profile.settings.sfx} onChange={e=>changeSetting('sfx',Number(e.target.value))}/></label><button onClick={audio.preview}>试听音效 ♪</button><p className="local-note">已接入原创合成试听版音乐与音效，可分别调节音量。学习语音后续逐步补充。</p><hr/><h2>保管好你的小花园</h2><p>备份可以带到另一台设备。导入前会检查内容，替换前会再次确认。</p><div className="settings-actions"><button onClick={()=>download(profile,'pinyin-garden-backup.json')}>导出备份</button><button onClick={()=>imports.current?.click()}>导入备份</button><button className="danger-button" onClick={()=>{if(window.confirm('确定清空当前花园？建议先导出备份。'))void clearProfile(slot).then(async()=>{setProfiles(await loadProfiles());setProfile(null);currentProfile.current=null;setPage('slots');});}}>清空当前花园</button></div><input ref={imports} type="file" accept="application/json,.json" hidden onChange={e=>{const file=e.target.files?.[0];if(file)void doImport(file);e.target.value='';}}/></section></main>}
  <footer className="garden-footer"><span>拼音花园 · 一点好奇，一点勇气。</span><span>原创玩法实验 / 本地保存</span></footer>
 </div>;
}
