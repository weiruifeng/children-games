import {useEffect,useRef,useState} from 'react';
import type {GardenState,Profile} from '@children-games/shared';
import {EventCursor,GardenAudio,musicFor} from './gardenAudio';
export function useGardenAudio(page:string,run:GardenState,settings:Profile['settings']|undefined){
 const [speechError,setSpeechError]=useState('');const [ready,setReady]=useState(false);const [muted,setMuted]=useState(false);
 const audio=useRef<GardenAudio>();const cursor=useRef(new EventCursor());
 useEffect(()=>{
  const player=new GardenAudio(setReady);audio.current=player;player.setSpeechFailure(()=>setSpeechError('这段声音暂不可用，可以继续拼卡片。'));
  const unlock=()=>player.unlock();
  const key=(e:KeyboardEvent)=>{if(e.key==='Enter'||e.key===' ')unlock();};
  const visibility=()=>player.visibility(document.hidden);
  const hide=()=>player.visibility(true);
  document.addEventListener('pointerup',unlock);document.addEventListener('keydown',key);
  document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',hide);window.addEventListener('pageshow',visibility);
  visibility();
  return()=>{document.removeEventListener('pointerup',unlock);document.removeEventListener('keydown',key);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',hide);window.removeEventListener('pageshow',visibility);player.dispose();};
 },[]);
 useEffect(()=>{
  const player=audio.current!;
  player.configure(musicFor(page,run),page==='battle'&&(run.paused||run.helpOpen),settings?.music??.35,settings?.sfx??.6,muted);
  player.configureSpeech(settings?.speech??true,settings?.speechVolume??.8);
  const events=cursor.current.take(run);if(page==='battle')for(const event of events)player.play(event);
 });
 useEffect(()=>{audio.current?.stopSpeech();},[page,run]);
 return {ready,muted,speechError,pronounce:(pinyin:string[])=>{setSpeechError('');audio.current?.pronounce(pinyin);},toggle:()=>{if(muted){setMuted(false);audio.current?.unlock();}else if(!ready)audio.current?.unlock();else setMuted(true);},preview:()=>audio.current?.play('ui_select')};
}
