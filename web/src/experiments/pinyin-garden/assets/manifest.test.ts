import {resources} from '../../../resources/manager';
import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {CHARACTER_IDS,characterUrl,PROP_IDS,propUrl,BACKGROUNDS} from './manifest';
import audio from './audio-manifest.json';
const read=(url:string)=>readFileSync(new URL(`../../../../public${url.startsWith('/assets/garden/')?resources.resource(url).id:url}`,import.meta.url));
describe('garden shipped assets',()=>{
 it('ships all character and prop PNGs with alpha, and both backgrounds',()=>{
  for(const url of [...CHARACTER_IDS.map(characterUrl),...PROP_IDS.map(propUrl),...Object.values(BACKGROUNDS)]){
   const b=read(url);expect(b.subarray(1,4).toString()).toBe('PNG');expect(b.readUInt32BE(16)).toBeGreaterThan(0);
   if(!Object.values(BACKGROUNDS).includes(url))expect(b[25]).toBe(6);
  }
 });
 it('ships every declared music and sound file',()=>{
  const urls=[...Object.values(audio.music).map(a=>a.url),...Object.values(audio.sfx).flatMap(a=>a.urls)];
  expect(urls).toHaveLength(54);for(const url of urls){const b=read(url);expect(b.subarray(0,4).toString()).toBe('RIFF');expect(b.length).toBeGreaterThan(44);}
 });
});
