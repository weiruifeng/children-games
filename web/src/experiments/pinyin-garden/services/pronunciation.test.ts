import {describe,it,expect,vi} from 'vitest';
import {ENTRIES} from '@children-games/shared';
import {SpeechChannel,canPronounce,pronunciationUrls} from './pronunciation';
import manifest from '../assets/pronunciation-manifest.json';
import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const deferred=<T>()=>{let resolve!:(v:T)=>void;let reject!:(e:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function rig(){const pending=new Map<string,ReturnType<typeof deferred<string>>>(),voices:{value:string;stop:ReturnType<typeof vi.fn>;done:()=>void}[]=[];let enabled=true;
 const mix=vi.fn(),failed=vi.fn();const player=new SpeechChannel<string>({load:url=>{const d=deferred<string>();pending.set(url,d);return d.promise;},enabled:()=>enabled,mix,start:value=>{const d=deferred<void>();const stop=vi.fn(()=>d.resolve());voices.push({value,stop,done:()=>d.resolve()});return {stop,finished:d.promise};}},failed);
 return {player,pending,voices,mix,failed,disable:()=>{enabled=false;player.stop();}};
}
describe('click pronunciation',()=>{
 it('maps umlaut, compound vowels and whole syllables to existing files',()=>{
  expect(pronunciationUrls(['mǎ','shuǐ','niú','lǜ','nüè','jū','yǔ']).map(s=>s.split('/').pop())).toEqual(['ma3.mp3','shui3.mp3','niu2.mp3','lv4.mp3','nve4.mp3','ju1.mp3','yu3.mp3']);
  for(const e of ENTRIES.filter(e=>!e.readingId))expect(canPronounce(e.pinyin),e.pinyin.join(' ')).toBe(true);
  for(const item of Object.values(manifest)){const p=resolve('public',item.url.slice(1));expect(existsSync(p),p).toBe(true);expect(createHash('sha256').update(readFileSync(p)).digest('hex')).toBe(item.sha256);}
 });
 it('discards an old fetch after a newer click',async()=>{
  const r=rig();const a=r.player.play(['a'],0),b=r.player.play(['b'],200);r.pending.get('a')!.resolve('a');await a;expect(r.voices).toHaveLength(0);r.pending.get('b')!.resolve('b');await Promise.resolve();expect(r.voices[0].value).toBe('b');r.voices[0].done();await b;
 });
 it('interrupts rather than queues rapid clicks and stops when hidden/muted',async()=>{
  const r=rig(),a=r.player.play(['a'],0);r.pending.get('a')!.resolve('a');await Promise.resolve();const b=r.player.play(['b'],200);expect(r.voices[0].stop).toHaveBeenCalledOnce();r.disable();r.pending.get('b')!.resolve('b');await Promise.all([a,b]);expect(r.voices).toHaveLength(1);
 });
 it('deduplicates accidental double taps without swallowing later replay',async()=>{
  const r=rig(),a=r.player.play(['a'],0);r.pending.get('a')!.resolve('a');await Promise.resolve();await r.player.play(['a'],100);expect(r.voices).toHaveLength(1);r.voices[0].done();await a;const b=r.player.play(['a'],250);r.pending.get('a')!.resolve('a');await Promise.resolve();expect(r.voices).toHaveLength(2);r.voices[1].done();await b;
 });
 it('fails softly and restores music, and cancellation rejects pending word segments',async()=>{
  const r=rig(),a=r.player.play(['bad'],0);r.pending.get('bad')!.reject(Error('404'));await a;expect(r.failed).toHaveBeenCalledOnce();expect(r.mix).toHaveBeenLastCalledWith(false);
  const b=r.player.play(['one','two'],200);r.pending.get('one')!.resolve('one');await Promise.resolve();r.player.stop();await b;expect(r.pending.has('two')).toBe(false);
 });
});
