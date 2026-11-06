import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {allowedPlants,createReview,learningFacts,collectDrop,createGarden,ENTRIES,ENTRY_MAP,LEVELS,newProfile,parseProfile,placePlant,PLANTS,PLANT_IDS,removePlant,requestHelp,selectPlant,snapshot,resumeSnapshot,starsFor,startWave,selectKnowledge,applyDemonstration,type GardenState,type Parts,type PlantKind,type Profile} from '@children-games/shared';
import {createGardenGame} from './game/createGame';
import {boardPoint,canDropPlant} from './ui/touchBoard';
import {DragCard} from './ui/DragCard';
import {acquireTarget,finishAssembly,placeAmmoPart} from './ui/quickAssembly';
import {SharedWorkbench} from './ui/SharedWorkbench';
import {PartnerGuide,PARTNER_ROLES} from './ui/PartnerGuide';
import {BattlePanel} from './ui/BattlePanel';
import {GardenModal} from './ui/GardenModal';
import {DewIcon,GardenIcon,ToneMark} from './ui/GardenIcon';
import {PartnerIcon} from './ui/PartnerIcon';
import {clearProfile,exportRawProfiles,loadProfileSlots,saveProfile,writeProfileRecovery} from './services/saveStore';

import {useGardenAudio} from './services/useGardenAudio';

import {parseRoute,routeHash,type Page} from './services/routes';
const slotNames=['苔芽的小花园','溪边的小花园','星叶的小花园'];
function download(data:unknown,name:string){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function GardenApp(){
 const [page,setPageState]=useState<Page>('slots');const [profiles,setProfiles]=useState<(Profile|null)[]>([null,null,null]);const [slot,setSlot]=useState(0);const [profile,setProfile]=useState<Profile|null>(null);
 const [view,setView]=useState<GardenState>(()=>createGarden());const state=useRef(view);const currentProfile=useRef<Profile|null>(null);const checkpoint=useRef<GardenState|null>(null);
 const [shovel,setShovel]=useState(false);const shovelRef=useRef(false);
 const [assetError,setAssetError]=useState(false);const [assetRetry,setAssetRetry]=useState(0);
 const [slotErrors,setSlotErrors]=useState<Record<number,string>>({});const [saving,setSaving]=useState(false);const saveRevision=useRef(0);
 const [notice,setNotice]=useState('');const [saveError,setSaveError]=useState('');const [loading,setLoading]=useState(true);const [guide,setGuide]=useState<'plant'|'spell'|'done'|null>(null);const [partnerHelp,setPartnerHelp]=useState(false);const [helpKind,setHelpKind]=useState<PlantKind|null>(null);const freeze=useRef(false);freeze.current=!!guide||partnerHelp;const [tab,setTab]=useState<'partners'|'words'|'parent'>('partners');
 const host=useRef<HTMLDivElement>(null);const imports=useRef<HTMLInputElement>(null);const saveQueue=useRef(Promise.resolve());const lastStage=useRef('');const onFrame=useRef(()=>{});
 const placement=useRef<{kind:PlantKind;row:number;col:number;valid:boolean}|null>(null);
 const [heartPulse,setHeartPulse]=useState(0);const [launchNotice,setLaunchNotice]=useState('');const launchUntil=useRef(0);const launchEvent=useRef(0);
 const slotRef=useRef(0);const profilesRef=useRef(profiles);profilesRef.current=profiles;
 const routeEvent=useRef(()=>{});const lastHash=useRef('');const lastSaved=useRef(0);
 const setPage=(next:Page,replace=false)=>{const hash=routeHash({page:next,slot:slotRef.current,level:state.current.level,review:!!state.current.reviewPool});if(location.hash!==hash)history[replace?'replaceState':'pushState'](null,'',hash);lastHash.current=hash;setPageState(next);};
 const [dewFlights,setDewFlights]=useState<{id:number;x:number;y:number;dx:number;dy:number}[]>([]);const dewEvent=useRef(0);const dewHint=useRef(false);
 const actorPixels=()=>Number.parseFloat(getComputedStyle(host.current?.closest('.garden-app')??document.documentElement).getPropertyValue('--actor-size'))||64;
 const notify=(message:string)=>{setLaunchNotice(message);launchUntil.current=Date.now()+2600;};
 const audio=useGardenAudio(page,state.current,profile?.settings);
 const dragSize=()=>({width:actorPixels(),height:actorPixels()});
 const pointAt=(x:number,y:number)=>{const r=host.current?.querySelector('canvas')?.getBoundingClientRect();return r?boardPoint(x,y,r):null;};
 const movePartner=(kind:PlantKind,x:number,y:number)=>{if(shovelRef.current){shovelRef.current=false;setShovel(false);}const p=pointAt(x,y);placement.current=p?{kind,row:p.row,col:p.col,valid:canDropPlant(state.current,kind,p.row,p.col)}:null;};
 const dropPartner=(kind:PlantKind,x:number,y:number)=>{const p=pointAt(x,y),s=state.current;
  if(p&&canDropPlant(s,kind,p.row,p.col)){placePlant(s,kind,p.row,p.col);notify(kind==='plant_dew_collector'?'收集器到位！放后排，保护好':kind==='plant_vine_guard'?'盾卫到位！站前排保护伙伴':'伙伴到位！拼好读音，自动攻击本行目标');}
  else notify(s.dew<PLANTS[kind].cost?'露珠不够，先收一些水滴':s.cooldowns[kind]>0?'伙伴还在准备，稍等一下':p&&s.plants.some(v=>v.row===p.row&&v.col===p.col)?'这里已经有伙伴，换一块空地':'拖到亮着的空地再松手');
  placement.current=null;update();
 };
 const update=(save=true)=>{setView({...state.current});if(save&&page==='battle')recordProgress();};
 const persist=(p:Profile)=>{
  const saveSlot=slotRef.current;try{writeProfileRecovery(saveSlot,p);}catch(e){setSaveError(`刷新备份失败：${String(e)}`);}
  profilesRef.current=profilesRef.current.map((v,i)=>i===saveSlot?p:v);
  currentProfile.current=p;setProfile(p);setProfiles(old=>old.map((v,i)=>i===saveSlot?p:v));
  const revision=++saveRevision.current;setSaving(true);
  saveQueue.current=saveQueue.current.catch(()=>{}).then(()=>saveProfile(saveSlot,p,true));saveQueue.current.then(()=>{if(revision===saveRevision.current){setSaveError('');setSaving(false);}},e=>{if(revision===saveRevision.current){setSaveError(`保存失败：${String(e)}。可导出备份后重试。`);setSaving(false);}});
 };
 const mergeAttempts=(p:Profile)=>{const map=new Map([...p.attempts,...state.current.attempts].map(a=>[`${a.taskId}:${a.entryId}:${a.at}:${a.correct}:${a.repeated}`,a]));return [...map.values()].slice(-45000);};
 const recordProgress=()=>{
  const p=currentProfile.current;if(!p)return;lastSaved.current=Date.now();const s=state.current;let next:Profile={...p,attempts:mergeAttempts(p),checkpoint:resumeSnapshot(s),waveStart:checkpoint.current};
  if(s.stage==='won'){
   const earned=starsFor(s),old=p.stars[String(s.level)]??[false,false,false];
   const key=`${s.reviewPool?'review':s.level}:garden-1:${s.slow?'slow':'normal'}:shared-2`;
   next=s.reviewPool?{...next,best:{...p.best,[key]:Math.max(p.best[key]??0,s.score)},checkpoint:null,waveStart:null}:{...next,unlocked:Math.min(5,Math.max(p.unlocked,s.level+1)),stars:{...p.stars,[s.level]:old.map((v,i)=>v||earned[i])},best:{...p.best,[key]:Math.max(p.best[key]??0,s.score)},checkpoint:null,waveStart:null};
  }
  persist(next);
 };
 const beginWave=()=>{const first=state.current.stage==='ready'&&state.current.level===1&&!currentProfile.current?.attempts.length;if(startWave(state.current)){if(first){freeze.current=true;setGuide('plant');}checkpoint.current=snapshot(state.current);lastStage.current='playing';recordProgress();update();}};
 onFrame.current=()=>{
  const s=state.current;
  if(s.stage!==lastStage.current){lastStage.current=s.stage;if(['between','won','lost'].includes(s.stage))recordProgress();}
  
  const launched=[...s.events].reverse().find(e=>e.type==='ammo_shared'&&e.id>launchEvent.current);
  if(launched){launchEvent.current=launched.id;launchUntil.current=Date.now()+1800;setLaunchNotice(`${launched.value} ✓ 已准备 · 伙伴自动攻击本行目标`);}
  const collected=s.events.filter(e=>e.type==='dew_collect'&&e.id>dewEvent.current);
  if(collected.length){const canvas=host.current?.querySelector('canvas')?.getBoundingClientRect(),balance=document.querySelector('.dew-count')?.getBoundingClientRect();if(canvas&&balance&&!currentProfile.current?.settings.reducedMotion)setDewFlights(old=>[...old.slice(-8),...collected.map(e=>{const x=canvas.x+e.x*canvas.width/1280,y=canvas.y+e.y*canvas.height/640;return {id:e.id,x,y,dx:balance.x+12-x,dy:balance.y+12-y};})]);notify(`露珠 +${collected.reduce((sum,e)=>sum+Number(e.value??25),0)}`);}
  const hits=s.events.filter(e=>e.type==='base_hit'&&e.id>dewEvent.current);if(hits.length){setHeartPulse(hits[hits.length-1].id);notify(`墨团进来了！爱心 −${hits.length} · 剩 ${s.hearts} 颗`);}
  dewEvent.current=s.eventId;
  if(!dewHint.current&&s.drops.length&&s.plants.some(p=>p.kind==='plant_dew_collector')){dewHint.current=true;notify('点水滴，收露珠 · 忙着拼音也会自动收集');}
  if(Date.now()>launchUntil.current){setLaunchNotice('');}
  if(!s.paused&&!s.helpOpen&&guide==='plant'&&s.plants.some(p=>p.kind==='plant_pod_slinger')){selectKnowledge(s,'char-1');setGuide('spell');}
  if(guide==='spell'&&s.sharedAmmo.includes('char-1'))setGuide('done');
  if(!s.task&&!s.paused&&!s.helpOpen&&!guide)acquireTarget(s);
  if(Date.now()-lastSaved.current>1000)recordProgress();
  update(false);
 };
 const restoreRoute=(saved=profilesRef.current)=>{
  const route=parseRoute(location.hash);const p=saved[route.slot];
  setGuide(null);setPartnerHelp(false);freeze.current=false;setShovel(false);shovelRef.current=false;placement.current=null;
  if(route.page==='slots'||!p){setPage('slots',true);return;}
  slotRef.current=route.slot;setSlot(route.slot);currentProfile.current=p;setProfile(p);
  if(route.page==='battle'){
   const cp=p.checkpoint;const matches=cp&&(route.review?!!cp.reviewPool:!cp.reviewPool&&cp.level===route.level);
   if(!matches){setPage('home',true);return;}
   const restored=JSON.parse(JSON.stringify(cp)) as GardenState;if(restored.task)restored.drafts[restored.task.entryId]=restored.task;
   restored.paused=restored.stage==='playing';restored.helpOpen=false;state.current=restored;checkpoint.current=p.waveStart??snapshot(restored);lastStage.current=restored.stage;if(restored.stage==='won')recordProgress();
   launchEvent.current=restored.eventId;dewEvent.current=restored.eventId;setDewFlights([]);setLaunchNotice('');setView({...restored});setAssetRetry(n=>n+1);
  }
  setPage(route.page,true);
 };
 routeEvent.current=()=>{if(location.hash===lastHash.current)return;if(page==='battle')recordProgress();restoreRoute();};
 useEffect(()=>{const navigate=()=>routeEvent.current();window.addEventListener('popstate',navigate);window.addEventListener('hashchange',navigate);return()=>{window.removeEventListener('popstate',navigate);window.removeEventListener('hashchange',navigate);};},[]);
 useEffect(()=>{loadProfileSlots().then(result=>{setProfiles(result.profiles);profilesRef.current=result.profiles;setSlotErrors(result.errors);restoreRoute(result.profiles);},e=>setSaveError(String(e))).finally(()=>setLoading(false));},[]);
 useEffect(()=>{shovelRef.current=shovel;},[shovel]);
 useEffect(()=>{
  if(page!=='battle'||!host.current)return;
  const game=createGardenGame(host.current,{actorPixels,inputBlocked:()=>freeze.current,feedback:notify,shovel:()=>shovelRef.current,freeze:()=>freeze.current,assetError:failed=>{setAssetError(failed);if(failed){state.current.paused=true;update();}},state:()=>state.current,placement:()=>placement.current,change:()=>onFrame.current(),
   cell:()=>{notify('把伙伴卡拖到这块空地');},
   plant:id=>{if(shovelRef.current){const plant=state.current.plants.find(p=>p.id===id);removePlant(state.current,id);if(plant&&!state.current.plants.some(p=>p.id===id)){notify('伙伴收回了');shovelRef.current=false;setShovel(false);}}else {selectPlant(state.current,id);const p=state.current.plants.find(p=>p.id===id);if(p){setHelpKind(p.kind);setPartnerHelp(true);}}update();},
   enemy:id=>{acquireTarget(state.current,id);update();},drop:id=>{collectDrop(state.current,id);update();}},()=>currentProfile.current?.settings.reducedMotion??false);
  return ()=>{game.destroy(true);};
 },[page,assetRetry]);
 useEffect(()=>{const hidden=()=>{if(document.hidden&&page==='battle'){state.current.paused=true;recordProgress();update();}};const leave=()=>{if(page==='battle')recordProgress();};document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',leave);return ()=>{document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',leave);};});
 const openSlot=(index:number)=>{if(slotErrors[index]){void exportRawProfiles().then(async data=>{download(data,'garden-recovery-backup.json');if(!window.confirm('原始备份已导出。确定清空这个损坏存档并重新开始？其他花园不受影响。'))return;await clearProfile(index);const result=await loadProfileSlots();setProfiles(result.profiles);setSlotErrors(result.errors);}).catch(e=>setSaveError(String(e)));return;}const p=profiles[index]??newProfile(slotNames[index]);slotRef.current=index;setSlot(index);persist(p);setPage('home');setNotice('');};
 const enterLevel=(level:number,resume=false)=>{
  const p=currentProfile.current!;if(level>p.unlocked)return;
  const s=resume&&p.checkpoint?JSON.parse(JSON.stringify(p.checkpoint)) as GardenState:createGarden(level,173+level*71);
  if(s.task)s.drafts[s.task.entryId]=s.task;s.slow=p.settings.slow;s.paused=false;s.helpOpen=false;state.current=s;checkpoint.current=resume?(p.waveStart??snapshot(s)):snapshot(s);lastStage.current=s.stage;
  setShovel(false);launchEvent.current=0;dewEvent.current=0;dewHint.current=false;setDewFlights([]);launchUntil.current=0;setLaunchNotice('');setGuide(null);setPartnerHelp(false);setView({...s});recordProgress();setAssetRetry(n=>n+1);setPage('battle');
 };
 const enterReview=()=>{const p=currentProfile.current;if(!p?.stars['5']?.[0])return;const s=createReview(p.attempts);s.slow=p.settings.slow;state.current=s;checkpoint.current=snapshot(s);lastStage.current=s.stage;launchEvent.current=0;dewEvent.current=0;dewHint.current=false;setDewFlights([]);setLaunchNotice('');setShovel(false);setGuide(null);setPartnerHelp(false);update(false);recordProgress();setAssetRetry(n=>n+1);setPage('battle');};
 const retry=()=>{if(!checkpoint.current)return;setGuide(null);setPartnerHelp(false);const attempts=state.current.attempts;const retries=(state.current.retryCount??0)+1;state.current=JSON.parse(JSON.stringify(checkpoint.current));state.current.attempts=attempts;state.current.retryCount=retries;state.current.paused=false;lastStage.current=state.current.stage;update();};
 const home=()=>{recordProgress();setPage('home');setGuide(null);setPartnerHelp(false);};
 const totalStars=profile?Object.values(profile.stars).flat().filter(Boolean).length:0;
 const act=(fn:()=>void)=>{fn();update();};
 const changeSetting=(key:keyof Profile['settings'],value:number|boolean)=>{const p=currentProfile.current;if(!p)return;const next={...p,settings:{...p.settings,[key]:value}};persist(next);if(key==='slow')state.current.slow=!!value;};
 const doImport=async(file:File)=>{try{if(file.size>5_000_000)throw new Error('文件超过 5MB');const p=parseProfile(JSON.parse(await file.text()));if(!window.confirm(`用备份「${p.name}」替换当前花园？`))return;await saveQueue.current.catch(()=>{});await saveProfile(slot,p);currentProfile.current=p;setProfile(p);const loaded=await loadProfileSlots();setProfiles(loaded.profiles);setSlotErrors(loaded.errors);setNotice('备份已导入。');}catch(e){setNotice(`导入未完成：${String(e)}`);}};
 const task=view.task;const entry=task?ENTRY_MAP[task.entryId]:null;const answer=task?entry!.parts[task.index]:null;
 const putPart=(key:keyof Parts,value:string|number)=>{if(task)act(()=>placeAmmoPart(state.current,key,value,`${task.key}:${task.index}`));};
 return <div className={`garden-app ${page==='battle'?'battle-screen':''} ${totalStars>=6?'creek-palette':''}`}>
  <header className="garden-topbar"><button onClick={()=>setPage(profile?'home':'slots')} className="brand"><span className="brand-seed">✦</span><span>拼音花园<small>种下勇气，拼出力量</small></span></button><nav><button onClick={audio.toggle} aria-label={audio.muted?'开启声音':audio.ready?'关闭声音':'点击开启声音'}><GardenIcon name={audio.muted?'muted':'sound'}/></button>{page!=='slots'&&<><button onClick={()=>{if(page==='battle')home();else setPage('home');}}>我的花园</button><button onClick={()=>{if(page==='battle')recordProgress();setPage('collection');}}><GardenIcon name="book"/> 伙伴图鉴</button><button onClick={()=>{if(page==='battle')recordProgress();setPage('settings');}}>家长设置</button></>}<span className="version-tag" role="status">{saving?'保存中…':saveError?'尚未保存':'本地花园'}</span></nav></header>
  {saveError&&<div className="save-warning" role="alert">{saveError}<button onClick={()=>currentProfile.current&&persist(currentProfile.current)}>重试保存</button><button onClick={()=>void exportRawProfiles().then(data=>download(data,'garden-raw-backup.json'))}>导出原始备份</button></div>}
  {notice&&<div className="notice" role="status">{notice}<button onClick={()=>setNotice('')}>关闭</button></div>}
  {page==='slots'&&<main className="garden-landing"><div className="eyebrow">给每一个好奇的小园丁</div><h1>选一个花园，<br/><em>一起出发。</em></h1><p>拼好声母、韵母和声调，和花园伙伴一起<br/>守住溪谷里的小小苗圃。</p><div className="slot-grid">{profiles.map((p,i)=><button className="slot-card" disabled={loading} key={i} onClick={()=>openSlot(i)}><PartnerIcon kind={PLANT_IDS[i]} size={104}/><span>花园 {String(i+1).padStart(2,'0')}</span><strong>{p?.name??slotNames[i]}</strong><small>{slotErrors[i]?'存档需要修复':loading?'正在打开存档…':p?`已开启 ${p.unlocked} / 5 个关卡`:'从一颗种子开始'}</small><b>{slotErrors[i]?'导出备份并修复':'进入花园 ↗'}</b></button>)}</div><p className="local-note">进度保存在这台设备 · 不需要注册 · 暂无学习读音</p></main>}
  {page==='home'&&profile&&<main className="garden-home"><div className="home-label">{profile.name}</div><h1>今天，守护哪片花园？</h1><section className="home-hero"><PartnerIcon kind="plant_pod_slinger" size={110}/><div><h2>伙伴在等你</h2><div className="hero-actions">{profile.checkpoint?<button className="primary" onClick={()=>enterLevel(profile.checkpoint!.level,true)}><GardenIcon name="play"/> 继续玩</button>:<button className="primary" onClick={()=>enterLevel(profile.unlocked)}><GardenIcon name="play"/> 开始探险</button>}{profile.stars['5']?.[0]&&profile.attempts.length>0&&<button onClick={enterReview}>字词复习</button>}</div></div><span className="star-total"><GardenIcon name="star"/> {totalStars} / 15</span></section>
   <div className="level-grid">{LEVELS.map(l=><button className={`level-card ${l.id>profile.unlocked?'locked':''}`} key={l.id} onClick={()=>l.id>profile.unlocked?setNotice('走完前一关，就能来到这里'):enterLevel(l.id)} aria-label={`${l.name}${l.id>profile.unlocked?'，待开启':''}`}><span className="level-number">{l.id>profile.unlocked?<GardenIcon name="lock"/>:l.id}</span><strong>{l.name}</strong><span className="level-stars">{(profile.stars[String(l.id)]??[false,false,false]).map((earned,i)=><GardenIcon name="star" className={earned?'earned':''} key={i}/>)}</span><small>{l.id>profile.unlocked?'待开启':l.id===profile.unlocked?'正在探险':'再来一次'}</small></button>)}</div><div className="home-footer">{totalStars>=3&&<span className="home-rewards"><GardenIcon name="star"/>{totalStars>=15?'花园守护者':totalStars>=9?'小小园丁':'花园小旗帜'}{totalStars>=12&&' · 温室灯光已点亮'}</span>}<button onClick={()=>{setTab('partners');setPage('collection');}}><GardenIcon name="book"/> 认识伙伴</button><button onClick={()=>setPage('slots')}>切换花园</button></div></main>}
  {page==='battle'&&<main className="battle-main"><div className="portrait-notice">把设备横过来，能更清楚地看见花园和拼音工坊。</div><div className="battle-heading"><button className="battle-home" aria-label="保存并返回花园" onClick={home}><GardenIcon name="home"/></button><h1>{view.reviewPool?'字词复习':LEVELS[view.level-1].name}</h1><div className="battle-stats"><span className="dew-count" aria-label={`露珠 ${view.dew}`}><DewIcon/> {view.dew}</span><span key={heartPulse} className={`hearts ${heartPulse?'heart-hit':''}`} aria-label={`爱心 ${view.hearts}`}>{[0,1,2].map(i=><GardenIcon name="heart" className={i<view.hearts?'':'empty-heart'} key={i}/>)}</span><span className="wave-count">{view.wave+1} / 3 波</span><button aria-label="伙伴图鉴" onClick={()=>{setHelpKind(null);setPartnerHelp(true);}}><GardenIcon name="book"/></button><button aria-label={view.paused?'继续':'暂停'} onClick={()=>act(()=>{state.current.paused=!state.current.paused;})}><GardenIcon name={view.paused?'play':'pause'}/></button></div></div>
   <div className="battle-layout"><aside className="partner-rack" style={{'--partner-rows':Math.ceil(allowedPlants(view.level).length/2)} as CSSProperties}><span className="rack-title">花园伙伴</span>{allowedPlants(view.level).map(kind=><DragCard key={kind} className="partner-card" dragContent={<PartnerIcon kind={kind}/>} getDragSize={dragSize} onDragMove={(x,y)=>movePartner(kind,x,y)} onDragEnd={()=>{placement.current=null;}} onDrop={(x,y)=>dropPartner(kind,x,y)} disabled={view.stage!=='playing'||guide==='spell'||guide==='done'||guide==='plant'&&kind!=='plant_pod_slinger'||!allowedPlants(view.level).includes(kind)||view.paused||view.helpOpen} blockedReason={view.cooldowns[kind]>0?'伙伴正在准备，稍等一下':view.dew<PLANTS[kind].cost?'露珠不够，先收一些水滴':undefined} onBlocked={notify} onPlace={()=>{setHelpKind(kind);setPartnerHelp(true);setShovel(false);shovelRef.current=false;}}><PartnerIcon kind={kind}/><strong>{PLANTS[kind].name}</strong><em>{PARTNER_ROLES[kind]}</em><span className="partner-price"><DewIcon/>{PLANTS[kind].cost}</span>{view.cooldowns[kind]>0?<small className="card-reason">准备 {Math.ceil(view.cooldowns[kind])} 秒</small>:view.dew<PLANTS[kind].cost?<small className="card-reason">露珠不够</small>:null}</DragCard>)}<button aria-label="铲除：挖走伙伴" aria-pressed={shovel} disabled={view.stage!=='playing'||view.paused||!!guide} className={`shovel ${shovel?'selected':''}`} onClick={()=>{shovelRef.current=!shovel;setShovel(!shovel);}}><img src="/assets/pinyin-garden/props/tool_shovel.png" alt="" draggable={false}/><strong>铲除</strong><small>挖走伙伴</small></button></aside>
    <div className="field-frame">{shovel&&<div className="shovel-hint" role="status"><strong>点一下要挖走的伙伴</strong><button onClick={()=>{setShovel(false);shovelRef.current=false;}}>取消</button></div>}{guide&&!view.paused&&!partnerHelp&&<div className="battle-coach" role="status"><strong>{guide==='plant'?'① 拖一个弹弓手到中间小路':guide==='spell'?'② 点上面的 m、a、三声':'③ 拼好啦！同读音的目标，全队自动打'}</strong><button onClick={()=>{setGuide(null);freeze.current=false;}}>{guide==='done'?'一起守护 →':'跳过引导'}</button></div>}{!guide&&view.stage==='playing'&&!view.paused&&view.spawned===0&&<div className="deployment-countdown">拖伙伴到空地 · {Math.max(0,Math.ceil(view.nextSpawn-view.waveTime))} 秒后墨团来啦</div>}{launchNotice&&<div className="launch-notice" role="status">{launchNotice}</div>}<div ref={host} className="game-canvas"/>{assetError&&<GardenModal label="图片加载暂停"><h2>花园图片还没准备好</h2><p>进度已暂停，检查网络后再试一次。</p><button className="primary" onClick={()=>{setAssetError(false);setAssetRetry(n=>n+1);}}>重新加载图片</button><button onClick={home}>回花园</button></GardenModal>}{!assetError&&!partnerHelp&&(view.paused||['ready','between','won','lost'].includes(view.stage))&&!view.helpOpen&&<GardenModal label={view.paused?'休息一下':'花园进度'}><BattlePanel state={view} onStart={beginWave} onResume={()=>act(()=>{state.current.paused=false;})} onHome={home} onRetry={retry} onNext={()=>!view.reviewPool&&view.level<5?enterLevel(view.level+1):home()} onReplay={()=>view.reviewPool?enterReview():enterLevel(view.level)} onSound={audio.toggle} muted={audio.muted}/></GardenModal>}</div></div>
   <SharedWorkbench interactionLocked={partnerHelp||guide==='plant'||guide==='done'} lockedEntry={guide?'char-1':undefined} state={view} onSelect={id=>act(()=>{selectKnowledge(state.current,id);})} onPart={putPart} onChoice={text=>act(()=>{if(state.current.task){state.current.task.choice=text;finishAssembly(state.current);}})} onHelp={()=>act(()=>requestHelp(state.current))}/>
   {partnerHelp&&<GardenModal label="伙伴图鉴" className="partner-modal"><h2>{helpKind?PLANTS[helpKind].name:'花园伙伴图鉴'}</h2><PartnerGuide kinds={helpKind?[helpKind]:allowedPlants(view.level)}/><button className="primary" onClick={()=>setPartnerHelp(false)}>知道啦，回到花园</button></GardenModal>}
   {view.helpOpen&&task&&entry&&<GardenModal label="拼音提示" className="help-modal"><span className="home-label">提示期间，花园暂停</span><h2>{entry.text[task.index]}</h2><div className="help-pinyin">{entry.pinyin[task.index]}</div><div className="demo-parts">{[answer?.initial,answer?.medial,answer?.final,answer?.whole].filter(Boolean).map((v,i)=><span key={i}>{v}</span>)}<span><ToneMark tone={answer?.tone??0}/></span></div><p>看一看，再自己拼一拼</p><button className="primary" onClick={()=>act(()=>{state.current.helpOpen=false;})}>回去试试</button><div className="panel-actions"><button onClick={()=>act(()=>{const t=state.current.task!;t.help=Math.max(2,t.help);t.parts={...ENTRY_MAP[t.entryId].parts[t.index],tone:0};state.current.helpOpen=false;})}>{task.mode==='choose'?'帮我缩小选择':'帮我留住部件'}</button>{task.help>=2&&<button onClick={()=>act(()=>{state.current.task!.help=3;applyDemonstration(state.current);finishAssembly(state.current);})}>一起拼好</button>}</div></GardenModal>}

  </main>}
  {page==='collection'&&profile&&<main className="collection-page"><div className="eyebrow">每一个发现，都值得收藏</div><h1>花园收藏册</h1><div className="tabs">{(['partners','words','parent'] as const).map((t,i)=><button className={tab===t?'active':''} key={t} onClick={()=>setTab(t)}>{['花园伙伴','字词收藏','给家长'][i]}</button>)}</div>
   {tab==='partners'?<><div className="partner-collection">{PLANT_IDS.map(k=><article key={k}><PartnerIcon kind={k} size={130}/><h2>{PLANTS[k].name}</h2><p>{PLANTS[k].description}</p><span>{allowedPlants(profile.unlocked).includes(k)?'已经加入花园':'继续探险，认识新伙伴'}</span></article>)}</div><h2>花园的礼物</h2><div className="decoration-list">{['小旗帜','溪谷配色','园丁名牌','温室灯光','守护者徽章'].map((name,i)=><div className={totalStars>=(i+1)*3?'unlocked':''} key={name}>✦<strong>{name}</strong><small>{(i+1)*3} 颗花园星</small></div>)}</div></>:
    tab==='words'?<div className="word-collection">{ENTRIES.map(e=>{const records=profile.attempts.filter(a=>a.entryId===e.id);const facts=learningFacts(profile.attempts,e.id);return <article key={e.id}><small>{e.pinyin.join(' ')}</small><strong>{e.text}</strong><span>{records.some(a=>a.correct&&!a.assisted&&!a.repeated)?'独立完成过':records.some(a=>a.correct)?'提示后完成过':'等待相遇'}</span>{facts.attempts>0&&<small>尝试 {facts.attempts} 次 · 独立完成 {facts.independent} 次 · {facts.days} 天</small>}</article>;})}</div>:<section className="parent-notes"><h2>看见进步，不急着下结论。</h2><p>这里记录实际尝试，不把一次答对当成“已经掌握”。本版练习字形、拼音组合和声调标记，暂不包含发音示范或听音训练。</p><div className="parent-stats"><span><strong>{profile.attempts.length}</strong>次尝试</span><span><strong>{profile.attempts.filter(a=>a.correct&&!a.assisted&&!a.repeated).length}</strong>次独立完成</span><span><strong>{profile.attempts.filter(a=>a.assisted).length}</strong>次借助提示</span></div><p>其中 {profile.attempts.filter(a=>a.mode==='review').length} 次来自复习，{profile.attempts.filter(a=>a.retry).length} 次来自失败后重试。旧版本未记录的来源不做推断。</p><p>进度只保存在当前浏览器。更换设备或清理浏览器前，请导出备份。</p><button onClick={()=>download(profile,'pinyin-garden-backup.json')}>导出学习与存档备份</button></section>}
  </main>}
  {page==='settings'&&profile&&<main className="settings-page"><div className="eyebrow">按照自己的节奏</div><h1>家长设置</h1><section className="settings-paper"><label>慢速战斗<input type="checkbox" checked={profile.settings.slow} onChange={e=>changeSetting('slow',e.target.checked)}/></label><label>减少动态效果<input type="checkbox" checked={profile.settings.reducedMotion} onChange={e=>changeSetting('reducedMotion',e.target.checked)}/></label><label>音乐音量<input aria-label="音乐音量" type="range" min="0" max="1" step="0.05" value={profile.settings.music} onChange={e=>changeSetting('music',Number(e.target.value))}/></label><label>音效音量<input aria-label="音效音量" type="range" min="0" max="1" step="0.05" value={profile.settings.sfx} onChange={e=>changeSetting('sfx',Number(e.target.value))}/></label><button onClick={audio.preview}>试听音效 ♪</button><p className="local-note">已接入原创合成试听版音乐与音效，可分别调节音量。学习语音后续逐步补充。</p><hr/><button onClick={()=>{setTab('parent');setPage('collection');}}>看看学习记录</button><h2>保管好你的小花园</h2><p>备份可以带到另一台设备。导入前会检查内容，替换前会再次确认。</p><div className="settings-actions"><button onClick={()=>download(profile,'pinyin-garden-backup.json')}>导出备份</button><button onClick={()=>imports.current?.click()}>导入备份</button><button className="danger-button" onClick={()=>{if(window.confirm('确定清空当前花园？建议先导出备份。'))void saveQueue.current.catch(()=>{}).then(()=>clearProfile(slot)).then(async()=>{const loaded=await loadProfileSlots();setProfiles(loaded.profiles);setSlotErrors(loaded.errors);setProfile(null);currentProfile.current=null;setPage('slots');});}}>清空当前花园</button></div><input ref={imports} type="file" accept="application/json,.json" hidden onChange={e=>{const file=e.target.files?.[0];if(file)void doImport(file);e.target.value='';}}/></section></main>}
  {page==='battle'&&dewFlights.map(f=><img key={f.id} alt="" className="dew-flight" src="/assets/pinyin-garden/props/pickup_dew.png" style={{left:f.x,top:f.y,'--dx':`${f.dx}px`,'--dy':`${f.dy}px`} as CSSProperties} onAnimationEnd={()=>setDewFlights(old=>old.filter(x=>x.id!==f.id))}/>)}
  <footer className="garden-footer"><span>拼音花园 · 一点好奇，一点勇气。</span><span>原创玩法实验 / 本地保存</span></footer>
 </div>;
}
