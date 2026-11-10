import {resources} from '../../resources/manager';
import {useResources} from '../../resources/useResources';
import {ResourceLoader} from '../../resources/ResourceLoader';
import {ResourceSettings,ResourceUpdateHint} from '../../resources/ResourceSettings';
import {battleImages,battleSpeech} from '../../resources/groups';
import {registerResources} from '../../resources/lifecycle';
import {assetUrl} from './assets/assetUrl';
import {GardenReception} from './ui/GardenReception';
import {Waji,WajiIcon} from '../../ui/Waji';
import {WordCollection} from './ui/WordCollection';
import {CoverageReport} from './ui/CoverageReport';
import {entryPronunciation} from './services/pronunciation';
import {AdventureHome} from './ui/AdventureHome';
import {SpellingHelp} from './ui/SpellingHelp';
import {regionName} from './ui/adventureRegions';
import {CHARACTER_LEVEL_MAP,nextAdventure,CHARACTER_PACK,createCharacterGarden,recommendedLevel,resolveAdventure,recordAudio,readingFacts,coverageSummary,type LearningAttempt} from '@children-games/shared';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {allowedPlants,LESSONS,lessonTitle,createLessonGarden,collectDrop,hasDewCollector,ENTRY_MAP,newProfile,parseProfile,placePlant,PLANTS,PLANT_IDS,removePlant,requestHelp,selectPlant,snapshot,resumeSnapshot,starsFor,startWave,selectKnowledge,type GardenState,type Parts,type PlantKind,type Profile} from '@children-games/shared';
import {createGardenGame} from './game/createGame';
import {boardPoint,canDropPlant} from './ui/touchBoard';
import {DragCard} from './ui/DragCard';
import {acquireTarget,finishAssembly,placeAmmoPart} from './ui/quickAssembly';
import {SharedWorkbench} from './ui/SharedWorkbench';
import {PartnerGuide,PARTNER_ROLES} from './ui/PartnerGuide';
import {BattlePanel} from './ui/BattlePanel';
import {GardenModal} from './ui/GardenModal';
import {DewIcon,GardenIcon} from './ui/GardenIcon';
import {PartnerIcon} from './ui/PartnerIcon';
import * as localStore from './services/saveStore';
import type {GardenRepository} from '../../site/repository';

import {useGardenAudio} from './services/useGardenAudio';

import {parseRoute,routeHash,type Page} from './services/routes';
const slotNames=['苔芽的小花园','溪边的小花园','星叶的小花园'];
function download(data:unknown,name:string){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function repeatedReadings(attempts:LearningAttempt[]){const groups=new Map<string,LearningAttempt[]>();for(const a of attempts)if(a.readingId){const list=groups.get(a.readingId)??[];list.push(a);groups.set(a.readingId,list);}return [...groups].filter(([id,records])=>readingFacts(records,id).repeatedIndependent).length;}
export function GardenApp({store,cloudBlocked=false,onAccount}:{store?:GardenRepository;cloudBlocked?:boolean;onAccount?:()=>void}={}){

 const {clearProfile,exportRawProfiles,loadProfileSlots,saveProfile,writeProfileRecovery}=store?{clearProfile:store.clearProfile.bind(store),exportRawProfiles:store.exportRawProfiles.bind(store),loadProfileSlots:store.loadProfileSlots.bind(store),saveProfile:store.saveProfile,writeProfileRecovery:store.writeProfileRecovery}:localStore;
 const [receptionPartner,setReceptionPartner]=useState<number|null>(null);
 const [statusOpen,setStatusOpen]=useState(false);
 const [settingsOpen,setSettingsOpen]=useState(false);
 const [leaving,setLeaving]=useState(false);const [exitError,setExitError]=useState('');
 const [page,setPageState]=useState<Page>('slots');const [profiles,setProfiles]=useState<(Profile|null)[]>([null,null,null]);const [slot,setSlot]=useState(0);const [profile,setProfile]=useState<Profile|null>(null);
 const [view,setView]=useState<GardenState>(()=>createLessonGarden());const state=useRef(view);const currentProfile=useRef<Profile|null>(null);const checkpoint=useRef<GardenState|null>(null);
 const [shovel,setShovel]=useState(false);const shovelRef=useRef(false);
 const [assetError,setAssetError]=useState('');const [sceneKey,setSceneKey]=useState('');const [speechKey,setSpeechKey]=useState('');const entryReady=useRef(false);const [assetRetry,setAssetRetry]=useState(0);
 const [slotErrors,setSlotErrors]=useState<Record<number,string>>({});const [saving,setSaving]=useState(false);const saveRevision=useRef(0);
 const [notice,setNotice]=useState('');const [saveError,setSaveError]=useState('');const [loading,setLoading]=useState(true);const [guide,setGuide]=useState<'plant'|'spell'|'done'|null>(null);const [partnerHelp,setPartnerHelp]=useState(false);const [helpKind,setHelpKind]=useState<PlantKind|null>(null);const freeze=useRef(false);freeze.current=!entryReady.current||!!guide||partnerHelp||statusOpen||settingsOpen||cloudBlocked;const [tab,setTab]=useState<'partners'|'words'|'parent'>('partners');
 useEffect(()=>{if(!notice||/未完成|不存在|待完善|请先|失败/.test(notice))return;const timer=setTimeout(()=>setNotice(''),4000);return()=>clearTimeout(timer);},[notice]);
 const host=useRef<HTMLDivElement>(null);const imports=useRef<HTMLInputElement>(null);const saveQueue=useRef(Promise.resolve());const lastStage=useRef('');const onFrame=useRef(()=>{});
 const placement=useRef<{kind:PlantKind;row:number;col:number;valid:boolean}|null>(null);
 const [heartPulse,setHeartPulse]=useState(0);const [launchNotice,setLaunchNotice]=useState('');const launchUntil=useRef(0);const launchEvent=useRef(0);
 const slotRef=useRef(0);const profilesRef=useRef(profiles);profilesRef.current=profiles;
 const routeEvent=useRef(()=>{});const lastHash=useRef('');const lastSaved=useRef(0);
 const setPage=(next:Page,replace=false)=>{if(store&&next!==page)void saveQueue.current.then(()=>store.flush());const hash=routeHash({page:next,slot:slotRef.current,levelId:state.current.levelId,level:state.current.lessonId??state.current.level,review:!!state.current.reviewPool});if(location.hash!==hash)history[replace?'replaceState':'pushState'](null,'',hash);lastHash.current=hash;setPageState(next);};
 const [dewFlights,setDewFlights]=useState<{id:number;x:number;y:number;dx:number;dy:number}[]>([]);const dewEvent=useRef(0);const dewHint=useRef(false);
 const actorPixels=()=>Number.parseFloat(getComputedStyle(host.current?.closest('.garden-app')??document.documentElement).getPropertyValue('--actor-size'))||64;
 const notify=(message:string)=>{setLaunchNotice(message);launchUntil.current=Date.now()+2600;};
 const audio=useGardenAudio(page,state.current,profile?.settings);
 const speechEnabled=!!profile?.settings.speech&&(profile?.settings.speechVolume??0)>0&&!audio.muted;
 const entryKey=[page,slot,state.current.runId??'',assetRetry,page==='battle'?speechEnabled:''].join(':');
 const speechFiles=page==='battle'&&speechEnabled?battleSpeech(state.current):[];
 const entryFiles=page==='battle'?[...battleImages(state.current),...speechFiles]:resources.group(page==='slots'?'garden-shell':page==='collection'?'collection':'garden-home');
 const resourceProgress=useResources(entryFiles,entryKey,assetRetry);
 const filesReady=resourceProgress.phase==='ready';
 const speechReady=!speechEnabled||speechKey===entryKey&&audio.ready;
 const canPlay=filesReady&&sceneKey===entryKey&&speechReady&&!assetError;
 entryReady.current=page==='battle'?canPlay:filesReady;
 freeze.current=!entryReady.current||!!guide||partnerHelp||statusOpen||settingsOpen||cloudBlocked;
 useEffect(()=>{void registerResources();},[]);
 useEffect(()=>{resources.setBattleActive(page==='battle');return()=>resources.setBattleActive(false);},[page]);
 useEffect(()=>{if(!canPlay||page!=='battle')return;const timer=requestAnimationFrame(()=>{const button=document.querySelector<HTMLButtonElement>('.wave-start,.garden-panel .primary');if(document.activeElement===document.body)button?.focus();});return()=>cancelAnimationFrame(timer);},[canPlay,page]);
 useEffect(()=>{if(filesReady)document.documentElement.style.setProperty('--garden-background-image',`url("${assetUrl(page==='battle'&&state.current.level>=4?'backgrounds/bg_battle_evening.png':'backgrounds/bg_battle_day.png')}")`);},[filesReady,entryKey]);
 useEffect(()=>{if(page==='battle'||!filesReady)return;const timer=setTimeout(()=>void resources.prefetchAll(),1500);void resources.checkUpdate();return()=>clearTimeout(timer);},[page,filesReady]);
 useEffect(()=>{if(page!=='battle'||!filesReady||!speechEnabled)return;let cancelled=false;
  if(!audio.ready)return;
  void audio.prepareSpeech(speechFiles).then(()=>{if(!cancelled)setSpeechKey(entryKey);},()=>{if(!cancelled)setAssetError('有几段读音还没准备好，请重试或暂时关闭朗读。');});
  return()=>{cancelled=true;};
 },[entryKey,filesReady,audio.ready]);
 useEffect(()=>{if(page==='battle'&&speechEnabled&&!audio.ready&&state.current.stage==='playing'){state.current.paused=true;entryReady.current=false;setView({...state.current});recordProgress();}},[audio.ready,speechEnabled,page]);
 useEffect(()=>{if(page==='battle'&&audio.speechError&&speechEnabled){state.current.paused=state.current.stage==='playing';entryReady.current=false;setAssetError(audio.speechError);}},[audio.speechError,speechEnabled,page]);
 const retryAssets=()=>{setAssetError('');setAssetRetry(n=>n+1);};
 const dragSize=()=>({width:actorPixels(),height:actorPixels()});
 const pointAt=(x:number,y:number)=>{const r=host.current?.querySelector('canvas')?.getBoundingClientRect();return r?boardPoint(x,y,r):null;};
 const movePartner=(kind:PlantKind,x:number,y:number)=>{if(shovelRef.current){shovelRef.current=false;setShovel(false);}const p=pointAt(x,y);placement.current=p?{kind,row:p.row,col:p.col,valid:canDropPlant(state.current,kind,p.row,p.col)}:null;};
 const dropPartner=(kind:PlantKind,x:number,y:number)=>{if(!entryReady.current)return;const p=pointAt(x,y),s=state.current;
  if(p&&canDropPlant(s,kind,p.row,p.col)){placePlant(s,kind,p.row,p.col);notify(kind==='plant_dew_collector'?'收集器到位！放后排，保护好':kind==='plant_vine_guard'?'盾卫到位！站前排保护伙伴':'伙伴到位！拼好卡片，自动攻击本行目标');}
  else notify(s.dew<PLANTS[kind].cost?'露珠不够，先收一些水滴':s.cooldowns[kind]>0?'伙伴还在准备，稍等一下':p&&s.plants.some(v=>v.row===p.row&&v.col===p.col)?'这里已经有伙伴，换一块空地':'拖到亮着的空地再松手');
  placement.current=null;update();
 };
 const update=(save=true)=>{setView({...state.current});if(save&&page==='battle')recordProgress();};
 const persist=(p:Profile)=>{
  const saveSlot=slotRef.current;try{writeProfileRecovery(saveSlot,p);}catch(e){setSaveError(`刷新备份失败：${String(e)}`);}
  profilesRef.current=profilesRef.current.map((v,i)=>i===saveSlot?p:v);
  currentProfile.current=p;setProfile(p);setProfiles(old=>old.map((v,i)=>i===saveSlot?p:v));
  const revision=++saveRevision.current;setSaving(true);
  saveQueue.current=saveQueue.current.catch(()=>{}).then(()=>saveProfile(saveSlot,p));saveQueue.current.then(()=>{if(store&&['between','won','lost'].includes(state.current.stage))void store.flush();if(revision===saveRevision.current){setSaveError('');setExitError('');setSaving(false);}},e=>{if(revision===saveRevision.current){setSaveError(`保存失败：${String(e)}。可导出备份后重试。`);setSaving(false);}});
 };
 const mergeAttempts=(p:Profile)=>{const map=new Map([...p.attempts,...state.current.attempts].map(a=>[`${a.taskId}:${a.entryId}:${a.at}:${a.correct}:${a.repeated}`,a]));return [...map.values()].slice(-45000);};
 const recordProgress=()=>{
  const p=currentProfile.current;if(!p)return;lastSaved.current=Date.now();const s=state.current;let next:Profile={...p,selectedLevel:s.levelId??p.selectedLevel,attempts:mergeAttempts(p),checkpoint:resumeSnapshot(s),waveStart:checkpoint.current};
  if(s.stage==='won'){
   const earned=starsFor(s),old=p.stars[String(s.level)]??[false,false,false];
   const key=`${s.levelId??(s.reviewPool?'review':s.lessonId)}:battle-${s.level}:${CHARACTER_PACK}:${s.slow?'slow':'normal'}:shared-2`;
   const lesson=s.lessonId??1,oldLesson=p.lessonStars[String(lesson)]??[false,false,false];
   next={...next,unlocked:Math.min(5,Math.max(p.unlocked,s.level+1)),best:{...p.best,[key]:Math.max(p.best[key]??0,s.score)},checkpoint:null,waveStart:null};
   if(s.levelId)next={...next,levelStars:{...p.levelStars,[s.levelId]:(p.levelStars[s.levelId]??[false,false,false]).map((v,i)=>v||earned[i])},stars:{...p.stars,[s.level]:old.map((v,i)=>v||earned[i])}};
   else if(!s.reviewPool)next={...next,lessonUnlocked:Math.min(14,Math.max(p.lessonUnlocked,lesson+1)),selectedLesson:Math.min(lesson+1,p.lessonLimit,14),stars:{...p.stars,[s.level]:old.map((v,i)=>v||earned[i])},lessonStars:{...p.lessonStars,[lesson]:oldLesson.map((v,i)=>v||earned[i])}};
  }
  persist(next);
 };
 const beginWave=()=>{if(!entryReady.current)return;const first=state.current.stage==='ready'&&state.current.levelId==='foundation-01'&&state.current.level===1&&!currentProfile.current?.attempts.length;if(startWave(state.current)){if(first){freeze.current=true;setGuide('plant');}checkpoint.current=snapshot(state.current);lastStage.current='playing';recordProgress();update();}};
 onFrame.current=()=>{if(!entryReady.current)return;
  const s=state.current;
  if(s.stage!==lastStage.current){lastStage.current=s.stage;if(['between','won','lost'].includes(s.stage))recordProgress();}
  
  const launched=[...s.events].reverse().find(e=>e.type==='ammo_shared'&&e.id>launchEvent.current);
  if(launched){launchEvent.current=launched.id;launchUntil.current=Date.now()+1800;setLaunchNotice(`${launched.value} ✓ 已准备 · 伙伴自动攻击本行目标`);}
  const collected=s.events.filter(e=>e.type==='dew_collect'&&e.id>dewEvent.current);
  if(collected.length){const canvas=host.current?.querySelector('canvas')?.getBoundingClientRect(),balance=document.querySelector('.dew-count')?.getBoundingClientRect();if(canvas&&balance&&!currentProfile.current?.settings.reducedMotion)setDewFlights(old=>[...old.slice(-8),...collected.map(e=>{const x=canvas.x+e.x*canvas.width/1280,y=canvas.y+e.y*canvas.height/640;return {id:e.id,x,y,dx:balance.x+12-x,dy:balance.y+12-y};})]);notify(`露珠 +${collected.reduce((sum,e)=>sum+Number(e.value??25),0)}`);}
  const hits=s.events.filter(e=>e.type==='base_hit'&&e.id>dewEvent.current);if(hits.length){setHeartPulse(hits[hits.length-1].id);notify(`墨团进来了！爱心 −${hits.length} · 剩 ${s.hearts} 颗`);}
  dewEvent.current=s.eventId;
  if(!dewHint.current&&s.drops.length){dewHint.current=true;notify(hasDewCollector(s)?'点水滴，收露珠 · 忙着拼音也会自动收集':'先种露珠收集器，才能收集水滴');}
  if(Date.now()>launchUntil.current){setLaunchNotice('');}
  if(!s.paused&&!s.helpOpen&&guide==='plant'&&s.plants.some(p=>p.kind==='plant_pod_slinger')){selectKnowledge(s,s.learningPlan?.waves[0].entries[0]??'symbol-a');setGuide('spell');}
  if(guide==='spell'&&s.sharedAmmo.includes(s.learningPlan?.waves[0].entries[0]??'symbol-a'))setGuide('done');
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
   const cp=p.checkpoint;const matches=cp&&(route.review?!!cp.reviewPool:!cp.reviewPool&&(route.levelId?cp.levelId===route.levelId:cp.levelId===recommendedLevel(route.level??1)));
   if(!matches){const id=resolveAdventure(route.levelId??'')??recommendedLevel(route.level??1);if(CHARACTER_LEVEL_MAP[id]?.published){enterLevel(id);return;}setNotice('这一关内容待完善或不存在，请选择已发布关卡。');setPage('home',true);return;}
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
 useEffect(()=>{document.documentElement.dataset.reducedMotion=String(!!profile?.settings.reducedMotion);},[profile?.settings.reducedMotion]);
 useEffect(()=>{if(cloudBlocked&&page==='battle'){state.current.paused=true;setView({...state.current});}},[cloudBlocked]);
 useEffect(()=>{
  if(page!=='battle'||!filesReady||!host.current)return;
  const sceneStarted=performance.now();let alive=true,sceneDone=false,waitMs=0;setAssetError('');
  const timer=setInterval(()=>{if(!alive||sceneDone||document.hidden)return;waitMs+=250;if(waitMs>=10000){setAssetError('画板还没准备好，请重新准备。');clearInterval(timer);}},250);
  const game=createGardenGame(host.current,{actorPixels,inputBlocked:()=>freeze.current,feedback:notify,shovel:()=>shovelRef.current,freeze:()=>freeze.current,ready:()=>{sceneDone=true;clearInterval(timer);resources.diagnostic('scene-first-render',{ms:Math.round(performance.now()-sceneStarted)});if(alive)setSceneKey(entryKey);},assetError:message=>{if(alive){entryReady.current=false;setAssetError(message);state.current.paused=state.current.stage==='playing';update(false);}},state:()=>state.current,placement:()=>placement.current,change:()=>onFrame.current(),
   cell:()=>{notify('把伙伴卡拖到这块空地');},
   plant:id=>{if(shovelRef.current){const plant=state.current.plants.find(p=>p.id===id);removePlant(state.current,id);if(plant&&!state.current.plants.some(p=>p.id===id)){notify('伙伴收回了');shovelRef.current=false;setShovel(false);}}else {selectPlant(state.current,id);const p=state.current.plants.find(p=>p.id===id);if(p){setHelpKind(p.kind);setPartnerHelp(true);}}update();},
   enemy:id=>{acquireTarget(state.current,id);const t=state.current.task;if(t)pronounceTarget(ENTRY_MAP[t.entryId].pinyin);update();},drop:id=>{const s=state.current;if(collectDrop(s,id))update();else if(!hasDewCollector(s)&&s.drops.some(d=>d.id===id))notify('先种露珠收集器，才能收集露珠');}},()=>!!currentProfile.current?.settings.reducedMotion||window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  return ()=>{alive=false;clearInterval(timer);entryReady.current=false;game.destroy(true);};
 },[page,assetRetry,filesReady,entryKey]);
 useEffect(()=>{const hidden=()=>{if(document.hidden&&page==='battle'){state.current.paused=true;recordProgress();update();}};const leave=()=>{if(page==='battle')recordProgress();if(store)void saveQueue.current.then(()=>store.flush());};document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',leave);return ()=>{document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',leave);};});
 const openSlot=(index:number)=>{if(store&&slotErrors[index]){setNotice('请先在设置 → 账号与进度中处理存档问题');return;}if(slotErrors[index]?.startsWith('迁移')){setNotice(slotErrors[index]);void loadProfileSlots().then(result=>{setProfiles(result.profiles);profilesRef.current=result.profiles;setSlotErrors(result.errors);setNotice(result.errors[index]??'迁移完成，可以进入花园。');}).catch(e=>setSaveError(String(e)));return;}if(slotErrors[index]){void exportRawProfiles().then(async data=>{download(data,'garden-recovery-backup.json');if(!window.confirm('原始备份已导出。确定清空这个损坏存档并重新开始？其他花园不受影响。'))return;await clearProfile(index);const result=await loadProfileSlots();setProfiles(result.profiles);setSlotErrors(result.errors);}).catch(e=>setSaveError(String(e)));return;}const enter=(p:Profile)=>{slotRef.current=index;setSlot(index);persist(p);setPage('home');setNotice('');};if(store){setLoading(true);void store.openProfile(index).then(p=>enter(p??newProfile(slotNames[index]))).catch(e=>setSaveError(String(e))).finally(()=>setLoading(false));}else enter(profiles[index]??newProfile(slotNames[index]));};
 const enterLevel=(level:string|number,resume=false)=>{
  const p=currentProfile.current!;const id=typeof level==='number'?recommendedLevel(level):level;if(!CHARACTER_LEVEL_MAP[id]?.published&&!resume){setNotice('这一关内容待完善。');return;}
  const s=resume&&p.checkpoint?JSON.parse(JSON.stringify(p.checkpoint)) as GardenState:createCharacterGarden(id,p.battleStage,p.attempts);
  if(s.task)s.drafts[s.task.entryId]=s.task;s.slow=p.settings.slow;s.paused=resume&&s.stage==='playing';s.helpOpen=false;state.current=s;checkpoint.current=resume?(p.waveStart??snapshot(s)):snapshot(s);lastStage.current=s.stage;
  entryReady.current=false;setAssetError('');setShovel(false);launchEvent.current=0;dewEvent.current=0;dewHint.current=false;setDewFlights([]);launchUntil.current=0;setLaunchNotice('');setGuide(null);setPartnerHelp(false);setView({...s});recordProgress();setAssetRetry(n=>n+1);setPage('battle');
 };
 const enterReview=()=>{const p=currentProfile.current;if(p)enterLevel(p.selectedLevel);};
 const retry=()=>{if(!entryReady.current||!checkpoint.current)return;setGuide(null);setPartnerHelp(false);const revealed=state.current.revealed;const audioUsed=state.current.audioUsed;const attempts=state.current.attempts;const retries=(state.current.retryCount??0)+1;state.current=JSON.parse(JSON.stringify(checkpoint.current));state.current.attempts=attempts;state.current.revealed=revealed;state.current.audioUsed=audioUsed;state.current.retryCount=retries;state.current.paused=false;lastStage.current=state.current.stage;update();};
 const home=()=>{recordProgress();setPage('home');setGuide(null);setPartnerHelp(false);};
 const cloudSummary=store?.summaries.get(slot);
 const totalStars=profile?Object.values(profile.stars).flat().filter(Boolean).length:0;
 const act=(fn:()=>void)=>{fn();update();};
 const changeSetting=(key:keyof Profile['settings'],value:number|boolean)=>{if(page==='battle'&&(key==='speech'||key==='speechVolume')){if(state.current.stage==='playing')state.current.paused=true;entryReady.current=false;setView({...state.current});}const p=currentProfile.current;if(!p)return;const next={...p,settings:{...p.settings,[key]:value}};persist(next);if(key==='slow')state.current.slow=!!value;};
 const doImport=async(file:File)=>{try{if(store){if(!window.confirm('导入备份并归档当前花园？'))return;await store.importFile(slot,file);const loaded=await loadProfileSlots();setProfiles(loaded.profiles);setProfile(loaded.profiles[slot]);currentProfile.current=loaded.profiles[slot];setNotice('备份已导入');return;}if(file.size>128_000_000)throw new Error('文件超过128MB');const p=parseProfile(JSON.parse(await file.text()));if(!window.confirm(`用备份「${p.name}」替换当前花园？`))return;await saveQueue.current.catch(()=>{});await saveProfile(slot,p);currentProfile.current=p;setProfile(p);const loaded=await loadProfileSlots();setProfiles(loaded.profiles);setSlotErrors(loaded.errors);setNotice('备份已导入。');}catch(e){setNotice(`导入未完成：${String(e)}`);}};
 const task=view.task;const entry=task?ENTRY_MAP[task.entryId]:null;
 const putPart=(key:keyof Parts,value:string|number)=>{if(!entryReady.current||!task)return;const index=task.index,wasFinished=task.finished;const e=ENTRY_MAP[task.entryId];
  placeAmmoPart(state.current,key,value,`${task.key}:${index}`);
  if(!wasFinished&&(task.finished||task.index>index)){audio.pronounce(state.current.levelId?entryPronunciation(e):[e.pinyin[index]]);}
  else if(key!=='tone'&&key!=='whole')audio.pronounce([String(value)]);
  update();
 };
 const pronounceTarget=(pinyin:string[])=>{if(!entryReady.current)return;const values=state.current.levelId&&state.current.task?entryPronunciation(ENTRY_MAP[state.current.task.entryId]):pinyin;if(values.length&&currentProfile.current?.settings.speech&&!audio.muted){recordAudio(state.current);audio.pronounce(values);}update();};
 const selectCard=(id:string)=>{if(!entryReady.current)return;selectKnowledge(state.current,id);update();};
 const chooseScope=(limit:number)=>{const p=currentProfile.current;if(!p)return;persist({...p,lessonLimit:limit,lessonUnlocked:Math.max(p.lessonUnlocked,limit),selectedLesson:limit,selectedLevel:recommendedLevel(limit)});setNotice('推荐位置已更新；所有已发布课程仍可尝试。');};
 const chooseBattle=(battleStage:number)=>{const p=currentProfile.current;if(p&&Number.isInteger(battleStage)&&battleStage>=1&&battleStage<=5)persist({...p,unlocked:5,battleStage});};
 const leaveForLearningHome=async()=>{if(leaving)return;setLeaving(true);setExitError('');if(page==='battle'){state.current.paused=true;recordProgress();}try{await saveQueue.current;window.location.assign('/');}catch{setLeaving(false);setExitError('尚未保存，请重试；你的进度仍留在当前页。');}};
 const statusButton=(saveError||notice||audio.speechError)?<button className={`garden-status-button ${saveError?'needs-attention':''}`} aria-label="查看花园提示" onClick={()=>{if(page==='battle'){state.current.paused=true;setView({...state.current});}setStatusOpen(true);}}><span role="status">{saveError?'待保存':notice||audio.speechError?'有提示':'提示'}</span></button>:null;
 const openSettings=()=>{if(page==='battle'){state.current.paused=true;setView({...state.current});}setSettingsOpen(true);};
 if(!filesReady)return <div className={`garden-loading-page ${profile?.settings.reducedMotion?'reduced-motion':''}`}><ResourceLoader key={entryKey} progress={resourceProgress} onRetry={retryAssets} onBack={page==='battle'?home:()=>{window.location.assign('/');}}>{page==='battle'&&resourceProgress.phase==='failed'&&speechEnabled&&<button onClick={()=>changeSetting('speech',false)}>暂时关闭朗读</button>}{onAccount&&<button onClick={()=>{resources.pausePrefetch();onAccount();}}>账号与进度</button>}</ResourceLoader></div>;
 return <div className={`garden-app ${page==='battle'?'battle-screen':page==='home'?'adventure-screen':page==='slots'?'slots-screen':''} ${profile?.settings.reducedMotion?'reduced-motion':''} ${totalStars>=6?'creek-palette':''}`}>
  {page==='battle'&&!canPlay&&<ResourceLoader overlay message={speechEnabled&&!audio.ready?'图片已准备好，点一下开启声音。':undefined} progress={assetError?{...resourceProgress,phase:'failed',error:assetError}:{...resourceProgress,phase:'preparing-scene'}} onRetry={retryAssets} onBack={home}>{speechEnabled&&!audio.ready&&<button onClick={audio.unlock}>点一下开启声音</button>}{speechEnabled&&<button onClick={()=>changeSetting('speech',false)}>暂时关闭朗读</button>}</ResourceLoader>}
  <ResourceUpdateHint onOpen={()=>{if(page==='battle'){state.current.paused=true;update(false);}setPage('settings');}}/><header className="garden-topbar"><a className="learning-world-link" href="/" aria-disabled={leaving} onClick={e=>{e.preventDefault();void leaveForLearningHome();}}>← 学习首页</a><button onClick={()=>setPage(profile?'home':'slots')} className="brand"><WajiIcon/><span>拼音花园<small>种下勇气，拼出力量</small></span></button><nav><button onClick={audio.toggle} aria-label={audio.muted?'开启声音':audio.ready?'关闭声音':'点击开启声音'}><GardenIcon name={audio.muted?'muted':'sound'}/></button>{page!=='slots'&&<><button onClick={()=>{if(page==='battle')home();else setPage('home');}}>我的花园</button><button onClick={()=>{if(page==='battle')recordProgress();setPage('collection');}}><GardenIcon name="book"/> 伙伴图鉴</button></>}{statusButton}<button className="garden-settings-trigger" aria-label="设置" onClick={openSettings}><GardenIcon name="settings"/></button></nav></header>
  {settingsOpen&&<GardenModal label="设置" className="garden-menu"><h2>设置</h2><div className="garden-menu-actions"><button onClick={audio.toggle}><GardenIcon name={audio.muted?'muted':'sound'}/>声音{audio.muted?'关':'开'}</button>{profile&&<><label>慢速战斗<input type="checkbox" checked={profile.settings.slow} onChange={e=>changeSetting('slow',e.target.checked)}/></label><label>减少动态<input type="checkbox" checked={profile.settings.reducedMotion} onChange={e=>changeSetting('reducedMotion',e.target.checked)}/></label><button onClick={()=>{setSettingsOpen(false);if(page==='battle')recordProgress();setPage('settings');}}>更多游戏设置</button></>}{onAccount&&<button onClick={()=>{setSettingsOpen(false);onAccount();}}>账号与进度</button>}{profile&&<button onClick={()=>{setSettingsOpen(false);if(page==='battle')recordProgress();setPage('slots');}}>切换花园</button>}</div><button className="primary" onClick={()=>setSettingsOpen(false)}>完成</button></GardenModal>}
  {statusOpen&&<GardenModal label="花园提示" className="garden-status-modal"><h2>花园提示</h2>
   {saveError?<section><h3>进度还没保存好</h3><p>请先别刷新或关闭页面。可以重试，或请家长导出当前进度备份。</p><details><summary>给家长看的详细信息</summary><p>{saveError}</p></details><div className="panel-actions"><button disabled={saving} onClick={()=>{if(currentProfile.current)persist(currentProfile.current);else{setLoading(true);void loadProfileSlots().then(result=>{setProfiles(result.profiles);profilesRef.current=result.profiles;setSlotErrors(result.errors);restoreRoute(result.profiles);setSaveError('');},e=>setSaveError(String(e))).finally(()=>setLoading(false));}}}>{saving?'正在保存…':'重试'}</button><button onClick={()=>{if(currentProfile.current)download(currentProfile.current,'pinyin-garden-backup.json');else void exportRawProfiles().then(data=>download(data,'garden-raw-backup.json')).catch(e=>setSaveError(`备份未完成：${String(e)}`));}}>导出备份</button></div></section>:<p>{saving?'正在保存进度…':'目前没有存档提醒。'}</p>}
   {audio.speechError&&<section><h3>声音小提示</h3><p>{audio.speechError}</p></section>}
   {notice&&<section><p>{notice}</p><button onClick={()=>setNotice('')}>清除这条提示</button></section>}
   <button className="primary" onClick={()=>setStatusOpen(false)}>知道了</button>
  </GardenModal>}
  {page==='slots'&&<main className="garden-landing"><div className="garden-landing-intro"><div><div className="eyebrow">欢迎来到挖机的小苗圃</div><h1>今天，<br/>去哪个<em>花园？</em></h1><p>带上熟悉的伙伴，<br/>一起发现新的拼音种子。</p></div><GardenReception partner={receptionPartner}/></div><div className="slot-grid">{profiles.map((p,i)=><button className="slot-card" onFocus={()=>setReceptionPartner(slotErrors[i]?null:i)} onBlur={()=>setReceptionPartner(null)} onPointerEnter={e=>{if(e.pointerType==='mouse')setReceptionPartner(slotErrors[i]?null:i);}} onPointerLeave={()=>setReceptionPartner(null)} disabled={loading} key={i} onClick={()=>openSlot(i)}><PartnerIcon kind={PLANT_IDS[i]} size={104}/><span>花园 {String(i+1).padStart(2,'0')}</span><strong>{p?.name??slotNames[i]}</strong><small>{slotErrors[i]?(slotErrors[i].startsWith('迁移')?'迁移待重试':'存档需要修复'):loading?'正在打开存档…':p?`战场 ${p.battleStage} · 随时继续守护`:'从一颗种子开始'}</small><b>{slotErrors[i]?(slotErrors[i].startsWith('迁移')?'重试迁移':'导出备份并修复'):'进入花园 ↗'}</b></button>)}</div></main>}
  {page==='home'&&profile&&<AdventureHome profile={profile} onSelect={id=>persist({...currentProfile.current!,selectedLevel:id})} onEnter={enterLevel} onBattle={chooseBattle} onCollection={next=>{setTab(next);setPage('collection');}} onSlots={()=>setPage('slots')}/>}
  {page==='battle'&&<main className="battle-main"><div className="portrait-notice">把设备横过来，能更清楚地看见花园和拼音工坊。</div><div className="battle-heading"><button className="battle-home" aria-label="保存并返回花园" onClick={home}><GardenIcon name="home"/></button><h1>{view.levelId?regionName(CHARACTER_LEVEL_MAP[view.levelId].chapter):lessonTitle(view)}</h1><div className="battle-stats">{statusButton}<span className="dew-count" aria-label={`露珠 ${view.dew}`}><DewIcon/> {view.dew}</span><span key={heartPulse} className={`hearts ${heartPulse?'heart-hit':''}`} aria-label={`爱心 ${view.hearts}`}>{[0,1,2].map(i=><GardenIcon name="heart" className={i<view.hearts?'':'empty-heart'} key={i}/>)}</span><span className="wave-count">{view.wave+1} / 3 波</span><button aria-label="伙伴图鉴" onClick={()=>{setHelpKind(null);setPartnerHelp(true);}}><GardenIcon name="book"/></button><button disabled={!canPlay} aria-label={view.paused?'继续':'暂停'} onClick={()=>act(()=>{state.current.paused=!state.current.paused;})}><GardenIcon name={view.paused?'play':'pause'}/></button></div></div>
   <div className="battle-layout" aria-busy={!canPlay}><aside className="partner-rack" style={{'--partner-rows':Math.ceil(allowedPlants(view.level).length/2)} as CSSProperties}><span className="rack-title">花园伙伴</span>{allowedPlants(view.level).map(kind=><DragCard key={kind} className="partner-card" dragContent={<PartnerIcon kind={kind}/>} getDragSize={dragSize} onDragMove={(x,y)=>movePartner(kind,x,y)} onDragEnd={()=>{placement.current=null;}} onDrop={(x,y)=>dropPartner(kind,x,y)} disabled={!canPlay||view.stage!=='playing'||guide==='spell'||guide==='done'||guide==='plant'&&kind!=='plant_pod_slinger'||!allowedPlants(view.level).includes(kind)||view.paused||view.helpOpen} blockedReason={view.cooldowns[kind]>0?'伙伴正在准备，稍等一下':view.dew<PLANTS[kind].cost?'露珠不够，先收一些水滴':undefined} onBlocked={notify} onPlace={()=>{setHelpKind(kind);setPartnerHelp(true);setShovel(false);shovelRef.current=false;}}><PartnerIcon kind={kind}/><strong>{PLANTS[kind].name}</strong><em>{PARTNER_ROLES[kind]}</em><span className="partner-price"><DewIcon/>{PLANTS[kind].cost}</span>{view.cooldowns[kind]>0?<small className="card-reason">准备 {Math.ceil(view.cooldowns[kind])} 秒</small>:view.dew<PLANTS[kind].cost?<small className="card-reason">露珠不够</small>:null}</DragCard>)}<button aria-label="铲除：挖走伙伴" aria-pressed={shovel} disabled={!canPlay||view.stage!=='playing'||view.paused||!!guide} className={`shovel ${shovel?'selected':''}`} onClick={()=>{shovelRef.current=!shovel;setShovel(!shovel);}}><img src={assetUrl('/assets/pinyin-garden/props/tool_shovel.png')} alt="" draggable={false}/><strong>铲除</strong><small>挖走伙伴</small></button></aside>
    <div className="field-frame">{shovel&&<div className="shovel-hint" role="status"><strong>点一下要挖走的伙伴</strong><button onClick={()=>{setShovel(false);shovelRef.current=false;}}>取消</button></div>}{guide&&!view.paused&&!partnerHelp&&<div className="battle-coach" role="status"><strong>{guide==='plant'?'① 拖一个弹弓手到中间小路':guide==='spell'?'② 看目标字母，点一样的卡片':'③ 卡片准备好，全队自动打！'}</strong><button onClick={()=>{setGuide(null);freeze.current=false;}}>{guide==='done'?'一起守护 →':'跳过引导'}</button></div>}{!guide&&view.stage==='playing'&&!view.paused&&view.spawned===0&&<div className="deployment-countdown">拖伙伴到空地 · {Math.max(0,Math.ceil(view.nextSpawn-view.waveTime))} 秒后墨团来啦</div>}{launchNotice&&<div className="launch-notice" role="status">{launchNotice}</div>}<div ref={host} className="game-canvas"/>{canPlay&&!settingsOpen&&!statusOpen&&!assetError&&!partnerHelp&&(view.paused||['ready','between','won','lost'].includes(view.stage))&&!view.helpOpen&&<GardenModal label={view.paused?'休息一下':'花园进度'}><BattlePanel onSettings={openSettings} onLearningHome={()=>void leaveForLearningHome()} leaving={leaving} exitError={exitError} state={view} onStart={beginWave} onResume={()=>{if(entryReady.current)act(()=>{state.current.paused=false;});}} onHome={home} onRetry={retry} onNext={()=>{const next=nextAdventure(view.levelId??'');if(next)enterLevel(next);else home();}} onReplay={()=>view.reviewPool?enterReview():enterLevel(view.levelId??recommendedLevel(1))} onSound={audio.toggle} muted={audio.muted} onPronounce={audio.pronounce}/></GardenModal>}</div></div>
   <SharedWorkbench interactionLocked={!canPlay||partnerHelp||guide==='plant'||guide==='done'} lockedEntry={guide?(view.learningPlan?.waves[0].entries[0]??'symbol-a'):undefined} state={view} onSelect={selectCard} onPronounce={profile?.settings.speech?pronounceTarget:undefined} onPart={putPart} onChoice={text=>act(()=>{if(entryReady.current&&state.current.task){state.current.task.choice=text;finishAssembly(state.current);}})} onHelp={()=>{if(entryReady.current)act(()=>requestHelp(state.current));}}/>
   {partnerHelp&&<GardenModal label="伙伴图鉴" className="partner-modal"><h2>{helpKind?PLANTS[helpKind].name:'花园伙伴图鉴'}</h2><PartnerGuide kinds={helpKind?[helpKind]:allowedPlants(view.level)}/><button className="primary" onClick={()=>setPartnerHelp(false)}>知道啦，回到花园</button></GardenModal>}
   {view.helpOpen&&task&&entry&&<SpellingHelp state={view} onClose={()=>act(()=>{state.current.helpOpen=false;})} onPronounce={pronounceTarget}/>}


  </main>}
  {page==='collection'&&profile&&<main className="collection-page"><div className="eyebrow">每一个发现，都值得收藏</div><h1>花园收藏册</h1><Waji className="collection-waji" mood="happy"/><div className="tabs">{(['partners','words','parent'] as const).map((t,i)=><button className={tab===t?'active':''} key={t} onClick={()=>setTab(t)}>{['花园伙伴','字词收藏','给家长'][i]}</button>)}</div>
   {tab==='partners'?<><div className="partner-collection">{PLANT_IDS.map(k=><article key={k}><PartnerIcon kind={k} size={130}/><h2>{PLANTS[k].name}</h2><p>{PLANTS[k].description}</p><span>{allowedPlants(profile.unlocked).includes(k)?'已经加入花园':'继续探险，认识新伙伴'}</span></article>)}</div><h2>花园的礼物</h2><div className="decoration-list">{['小旗帜','溪谷配色','园丁名牌','温室灯光','守护者徽章'].map((name,i)=><div className={totalStars>=(i+1)*3?'unlocked':''} key={name}>✦<strong>{name}</strong><small>{(i+1)*3} 颗花园星</small></div>)}</div></>:
    tab==='words'?<WordCollection attempts={profile.attempts} summary={cloudSummary}/>:<section className="parent-notes"><h2>看见进步，不急着下结论。</h2><p>这里记录实际尝试，不把一次答对当成“已经掌握”。本版练习字形、拼音组合和声调标记，可点击听示范，但不考听音、朗读或实际发音。汉字挑战隐藏答案；看过示范、提示或重试不会算作独立拼写。</p><p>候选 {coverageSummary().total} 项 · 已发布 {coverageSummary().published} 项 · 实际尝试 {cloudSummary?Object.keys(cloudSummary.readings).length:new Set(profile.attempts.filter(a=>a.levelId&&a.readingId).map(a=>a.readingId)).size} 项 · 多次独立完成 {cloudSummary?Object.values(cloudSummary.readings).filter(r=>r.repeatedIndependent).length:repeatedReadings(profile.attempts)} 项</p><div className="parent-stats"><span><strong>{cloudSummary?.total??profile.attempts.length}</strong>次尝试</span><span><strong>{cloudSummary?.independent??profile.attempts.filter(a=>a.correct&&!a.assisted&&!a.repeated&&a.firstTryCorrect===true&&!!a.levelId&&!a.referenceVisible&&!a.retry&&(a.optionCount??0)>1).length}</strong>次独立完成</span><span><strong>{cloudSummary?.assisted??profile.attempts.filter(a=>a.assisted).length}</strong>次借助提示</span></div><p>其中 {cloudSummary?.reviewed??profile.attempts.filter(a=>a.mode==='review').length} 次来自复习，{cloudSummary?.retried??profile.attempts.filter(a=>a.retry).length} 次来自失败后重试。旧版本未记录的来源不做推断。</p><CoverageReport attempts={profile.attempts} summary={cloudSummary}/><p>{store?'云端保存已同步的学习记录；完整历史请使用设置 → 账号与进度 → 备份与恢复中的完整导出。':'进度只保存在当前浏览器。更换设备或清理浏览器前，请导出备份。'}</p></section>}
  </main>}
  {page==='settings'&&profile&&<main className="settings-page"><div className="eyebrow">按照自己的节奏</div><h1>游戏设置</h1><section className="settings-paper"><label>课堂学到哪课<select aria-label="课堂范围" value={profile.lessonLimit} onChange={e=>chooseScope(Number(e.target.value))}>{LESSONS.map(l=><option key={l.id} value={l.id}>第 {l.id} 课 · {l.name}</option>)}</select></label><p>课堂进度只调整推荐位置，不限制手动选择课程。</p><label>点击拼音发音<input type="checkbox" checked={profile.settings.speech} onChange={e=>changeSetting('speech',e.target.checked)}/></label><label>拼音音量<input aria-label="拼音音量" type="range" min="0" max="1" step="0.05" value={profile.settings.speechVolume} onChange={e=>changeSetting('speechVolume',Number(e.target.value))}/></label><label>慢速战斗<input type="checkbox" checked={profile.settings.slow} onChange={e=>changeSetting('slow',e.target.checked)}/></label><label>减少动态效果<input type="checkbox" checked={profile.settings.reducedMotion} onChange={e=>changeSetting('reducedMotion',e.target.checked)}/></label><label>音乐音量<input aria-label="音乐音量" type="range" min="0" max="1" step="0.05" value={profile.settings.music} onChange={e=>changeSetting('music',Number(e.target.value))}/></label><label>音效音量<input aria-label="音效音量" type="range" min="0" max="1" step="0.05" value={profile.settings.sfx} onChange={e=>changeSetting('sfx',Number(e.target.value))}/></label><button onClick={audio.preview}>试听音效 ♪</button><hr/><ResourceSettings beforeUpdate={async()=>{if(currentProfile.current)recordProgress();await saveQueue.current;if(store){await store.flush();if(['error','auth-required','conflict'].includes(store.status))throw Error('请先处理存档问题，再更新花园。');}}}/><hr/><button onClick={()=>{setTab('parent');setPage('collection');}}>看看学习记录</button><details className="garden-advanced"><summary>高级管理</summary>{!!profile.previousArchive&&<p>路线已更新，旧成绩和原始存档已保留。旧战局已归档，新的守护从你选择的路线开始。</p>}{onAccount?<button onClick={onAccount}>账号与进度管理</button>:<><div className="settings-actions"><button onClick={()=>setPage('slots')}>切换花园</button><button onClick={()=>store?void store.exportBackup(slot).catch(e=>setSaveError(String(e))):download(profile,'pinyin-garden-backup.json')}>导出备份</button><button onClick={()=>imports.current?.click()}>导入备份</button><button className="danger-button" onClick={()=>{if(window.confirm('确定清空当前花园？建议先导出备份。'))void saveQueue.current.catch(()=>{}).then(()=>clearProfile(slot)).then(async()=>{const loaded=await loadProfileSlots();setProfiles(loaded.profiles);setSlotErrors(loaded.errors);setProfile(null);currentProfile.current=null;setPage('slots');}).catch(e=>setSaveError(`清空未完成：${String(e)}`));}}>清空当前花园</button></div></>}</details><input ref={imports} type="file" accept="application/json,.json,.ndjson" hidden onChange={e=>{const file=e.target.files?.[0];if(file)void doImport(file);e.target.value='';}}/></section></main>}
  {page==='battle'&&dewFlights.map(f=><img key={f.id} alt="" className="dew-flight" src={assetUrl('/assets/pinyin-garden/props/pickup_dew.png')} style={{left:f.x,top:f.y,'--dx':`${f.dx}px`,'--dy':`${f.dy}px`} as CSSProperties} onAnimationEnd={()=>setDewFlights(old=>old.filter(x=>x.id!==f.id))}/>)}

 </div>;
}
