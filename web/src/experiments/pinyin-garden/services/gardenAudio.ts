import manifest from '../../../../public/assets/pinyin-garden/audio-manifest.json';
import type {GardenState} from '@children-games/shared';
export type Music = keyof typeof manifest.music;
type Sound = keyof typeof manifest.sfx;
// Keep music behind gameplay feedback, including for existing saved volume settings.
const MUSIC_MIX_GAIN=.5;
const IMPACT_SOUNDS=new Set(['projectile_hit','cone_impact','armor_hit','armor_break','enemy_hit','vine_hit','base_hit','shield_break']);
export function musicFor(page:string,state:GardenState):Music|null {
 if(page!=='battle')return 'bgm_home';
 if(state.stage==='lost')return null;
 if(state.stage==='won')return 'bgm_result';
 return state.wave===2?'bgm_final_wave':'bgm_battle';
}
export class EventCursor {
 private run:object|null=null; private last=0;
 take(run:GardenState):string[]{
  if(this.run!==run){this.run=run;this.last=run.eventId;return [];}
  const events=run.events.filter(e=>e.id>this.last);this.last=run.eventId;
  return events.map(e=>e.type);
 }
}
export class GardenAudio {
 private context:AudioContext|null=null;
 private duckGain:GainNode|null=null;
 private musicGain:GainNode|null=null;private sfxGain:GainNode|null=null;
 private buffers=new Map<string,Promise<AudioBuffer>>();
 private source:AudioBufferSourceNode|null=null;
 private voices=new Set<AudioBufferSourceNode>();
 private wanted:Music|null=null;private offset=0;private started=0;private ended=false;
 private revision=0;private epoch=0;private disposed=false;
 private paused=false;private muted=false;private hidden=false;
 private musicVolume=.35;private sfxVolume=.6;
 private lastSounds=new Map<string,number>();private preloaded=false;
 constructor(private status:(ready:boolean)=>void){}
 private get blocked(){return this.paused||this.muted||this.hidden;}
 unlock(){
  if(this.disposed)return;
  try{
   if(!this.context){
    this.context=new AudioContext();this.musicGain=this.context.createGain();this.sfxGain=this.context.createGain();
    const compressor=this.context.createDynamicsCompressor();compressor.threshold.value=-18;compressor.ratio.value=6;
    this.duckGain=this.context.createGain();this.musicGain.connect(this.duckGain);this.duckGain.connect(compressor);this.sfxGain.connect(compressor);compressor.connect(this.context.destination);
    this.volumes();
    this.context.onstatechange=()=>this.status(this.context?.state==='running');
   }
   if(this.context.state==='running'){this.preload();this.startMusic();return;}
   // Resume within the user gesture, before loading any files.
   void this.context.resume().then(()=>{if(this.disposed)return;this.status(true);this.startMusic();
    this.preload();
   }).catch(()=>this.status(false));
  }catch{this.status(false);}
 }
 private preload(){
  if(this.preloaded)return;this.preloaded=true;
  for(const sound of Object.values(manifest.sfx))for(const url of sound.urls)void this.buffer(url).catch(()=>{});
 }
 private buffer(url:string){
  let pending=this.buffers.get(url);
  if(!pending){pending=fetch(url).then(r=>{if(!r.ok)throw Error(`Audio ${r.status}`);return r.arrayBuffer();}).then(b=>this.context!.decodeAudioData(b)).catch(e=>{this.buffers.delete(url);throw e;});this.buffers.set(url,pending);}
  return pending;
 }
 private volumes(){
  if(!this.context)return;
  this.musicGain!.gain.setTargetAtTime(this.muted?0:this.musicVolume*MUSIC_MIX_GAIN,this.context.currentTime,.03);
  this.sfxGain!.gain.setTargetAtTime(this.muted?0:this.sfxVolume,this.context.currentTime,.03);
 }
 configure(track:Music|null,paused:boolean,music:number,sfx:number,muted:boolean){
  const changed=track!==this.wanted;
  if(changed||paused!==this.paused||muted!==this.muted){this.stopMusic();this.stopEffects();}
  if(changed){this.wanted=track;this.offset=0;this.ended=false;}
  this.paused=paused;this.muted=muted;this.musicVolume=music;this.sfxVolume=sfx;this.volumes();this.startMusic();
 }
 visibility(hidden:boolean){this.hidden=hidden;if(hidden){this.stopMusic();this.stopEffects();}else this.startMusic();}
 private stopMusic(){
  this.revision++;
  if(this.source){this.offset+=this.context!.currentTime-this.started;this.source.onended=null;this.source.stop();this.source.disconnect();this.source=null;}
 }
 private startMusic(){
  if(this.disposed||this.blocked||!this.wanted||this.source||this.ended||this.context?.state!=='running')return;
  const revision=++this.revision;const track=this.wanted;const asset=manifest.music[track];
  void this.buffer(asset.url).then(buffer=>{
   if(revision!==this.revision||this.disposed||this.blocked||this.source)return;
   if(!asset.loop&&this.offset>=buffer.duration){this.ended=true;return;}
   const source=this.context!.createBufferSource();source.buffer=buffer;source.loop=asset.loop;source.connect(this.musicGain!);
   source.onended=()=>{if(this.source===source){this.source=null;this.ended=true;}source.disconnect();};
   this.offset=asset.loop?this.offset%buffer.duration:this.offset;this.started=this.context!.currentTime;this.source=source;source.start(0,this.offset);this.status(true);
  }).catch(()=>{if(revision===this.revision)this.status(false);});
 }
 play(event:string){
  const name=event==='ammo_shared'?'unlock':event;
  if(!(name in manifest.sfx)||this.blocked||this.sfxVolume===0||this.context?.state!=='running')return;
  const now=performance.now();const gap=name==='needs_edit'?450:100;
  if(now-(this.lastSounds.get(name)??-Infinity)<gap)return;
  this.lastSounds.set(name,now);
  const urls=manifest.sfx[name as Sound].urls;const epoch=this.epoch;
  void this.buffer(urls[Math.floor(Math.random()*urls.length)]).then(buffer=>{
   if(this.disposed||this.blocked||epoch!==this.epoch||performance.now()-now>350)return;
   if(this.voices.size>=8){const oldest=this.voices.values().next().value!;oldest.stop();oldest.disconnect();this.voices.delete(oldest);}
   const source=this.context!.createBufferSource();source.buffer=buffer;source.connect(this.sfxGain!);this.voices.add(source);
   source.onended=()=>{this.voices.delete(source);source.disconnect();};source.start();
   if(IMPACT_SOUNDS.has(name))this.duckMusic();
  }).catch(()=>{});
 }
 private duckMusic(){
  if(!this.context||!this.duckGain)return;
  const now=this.context.currentTime;const gain=this.duckGain.gain;
  gain.cancelScheduledValues(now);
  gain.setTargetAtTime(.4,now,.015);
  gain.setTargetAtTime(1,now+.22,.16);
 }
 private stopEffects(){
  if(this.context&&this.duckGain){const now=this.context.currentTime;this.duckGain.gain.cancelScheduledValues(now);this.duckGain.gain.setValueAtTime(1,now);}
  this.epoch++;for(const voice of this.voices){voice.stop();voice.disconnect();}this.voices.clear();}
 dispose(){this.disposed=true;this.stopMusic();this.stopEffects();if(this.context){this.context.onstatechange=null;void this.context.close();}}
}
