import {describe,it,expect} from 'vitest';
import {createGarden} from '@children-games/shared';
import {EventCursor,musicFor} from './gardenAudio';
describe('garden audio routing',()=>{
 it('switches music for the final wave and results',()=>{
  const s=createGarden();expect(musicFor('home',s)).toBe('bgm_home');
  expect(musicFor('battle',s)).toBe('bgm_battle');s.wave=2;
  expect(musicFor('battle',s)).toBe('bgm_final_wave');s.stage='won';
  expect(musicFor('battle',s)).toBe('bgm_result');s.stage='lost';expect(musicFor('battle',s)).toBeNull();
 });
 it('consumes each event once and skips historical events after resume or retry',()=>{
  const s=createGarden();const cursor=new EventCursor();expect(cursor.take(s)).toEqual([]);
  s.events.push({id:++s.eventId,type:'slinger_fire',x:0,y:0});expect(cursor.take(s)).toEqual(['slinger_fire']);expect(cursor.take(s)).toEqual([]);
  const retry=structuredClone(s);expect(cursor.take(retry)).toEqual([]);
  retry.events.push({id:++retry.eventId,type:'ammo_shared',x:0,y:0});expect(cursor.take(retry)).toEqual(['ammo_shared']);
 });
});
