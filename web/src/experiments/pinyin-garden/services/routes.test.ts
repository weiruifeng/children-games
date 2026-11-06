import {describe,it,expect} from 'vitest';
import {parseRoute,routeHash} from './routes';
import {createGarden,startWave,selectKnowledge,resumeSnapshot,parseProfile,newProfile,snapshot} from '@children-games/shared';
describe('garden navigation and resume',()=>{
 it('round trips each slot and battle and rejects invalid links',()=>{
  for(let slot=0;slot<3;slot++)for(let level=1;level<=5;level++)expect(parseRoute(routeHash({page:'battle',slot,level}))).toMatchObject({page:'battle',slot,level});
  expect(parseRoute('#/garden/2/review')).toMatchObject({page:'battle',slot:1,review:true});
  for(const hash of ['', '#/garden/4/home','#/garden/1/battle/6','#/unknown'])expect(parseRoute(hash).page).toBe('slots');
 });
 it('preserves unfinished assembly without changing the wave retry snapshot',()=>{
  const s=createGarden(3);startWave(s);selectKnowledge(s,'char-1');s.task!.parts.initial='m';
  const p=newProfile('test');p.unlocked=3;p.checkpoint=resumeSnapshot(s);p.waveStart=snapshot(s);
  const restored=parseProfile(JSON.parse(JSON.stringify(p)));
  expect(restored.checkpoint!.task!.parts.initial).toBe('m');
  expect(restored.checkpoint!.drafts['char-1']).toBe(restored.checkpoint!.task);
  expect(restored.waveStart!.task).toBeNull();
 });
});
