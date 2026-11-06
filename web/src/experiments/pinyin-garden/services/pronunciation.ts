import {pronunciationKey,READING_MAP,type Entry} from '@children-games/shared';
import manifest from '../assets/pronunciation-manifest.json';
export function pronunciationUrls(pinyin:string[],neutral=false):string[]{
 return pinyin.map(p=>manifest[(neutral?pronunciationKey(p)+'5':pronunciationKey(p)) as keyof typeof manifest]?.url).filter((url):url is string=>!!url);
}
export function canPronounce(pinyin:string[]):boolean{return pinyin.length>0&&pronunciationUrls(pinyin).length===pinyin.length;}
interface Playback {stop:()=>void;finished:Promise<void>}
export interface SpeechBackend<T> {load:(url:string)=>Promise<T>;start:(buffer:T)=>Playback;enabled:()=>boolean;mix:(active:boolean)=>void}
/** One voice, latest gesture wins, including fetches that complete out of order. */
export class SpeechChannel<T> {
 private revision=0;private current:Playback|null=null;private lastKey='';private lastAt=-Infinity;
 constructor(private backend:SpeechBackend<T>,private failed:()=>void=()=>{}){}
 stop(){this.revision++;this.current?.stop();this.current=null;this.backend.mix(false);}
 async play(urls:string[],now=performance.now()):Promise<void>{
  if(!urls.length||!this.backend.enabled())return;
  const key=urls.join('|');if(key===this.lastKey&&now-this.lastAt<180)return;
  this.lastKey=key;this.lastAt=now;this.stop();const rev=this.revision;
  try{
   for(const url of urls){
    const buffer=await this.backend.load(url);
    if(rev!==this.revision||!this.backend.enabled())return;
    this.backend.mix(true);const voice=this.backend.start(buffer);this.current=voice;
    await voice.finished;
    if(rev!==this.revision)return;
    this.current=null;
   }
  }catch{if(rev===this.revision)this.failed();}
  finally{if(rev===this.revision){this.current=null;this.backend.mix(false);}}
 }
}

/** Reading identity is explicit: neutral ma5 never falls back to teaching ma. */
export function entryPronunciation(entry:Entry):string[]{if(!entry.readingId)return entry.pinyin;const reading=READING_MAP[entry.readingId];return reading?.audio.status==='reviewed'&&canPronounce([reading.key])?[reading.key]:[];}
