import {describe,it,expect} from 'vitest';
import {createGarden,startWave,tickGarden,waveLeaks,snapshot,resumeSnapshot} from './simulation';
import {LEVELS} from './content';
import {parseState} from './snapshot';
describe('three-heart defense without rescue',()=>{
 it('never auto-clears a row and loses on the third leak even at a wave boundary',()=>{
  const s=createGarden(2);startWave(s);s.rescues=[true,true,true];s.nextSpawn=999;s.spawned=LEVELS[1].counts[0];
  for(let i=0;i<4;i++)s.enemies.push({id:s.nextId++,kind:'enemy_ink_blob',row:0,x:180,hp:80,armor:0,entryId:'char-1',attackTimer:0});
  tickGarden(s,.02);expect(s.stage).toBe('lost');expect(s.hearts).toBe(0);expect(waveLeaks(s)).toBe(3);expect(s.enemies).toHaveLength(1);expect(s.score).toBe(0);expect(s.events.filter(e=>e.type==='base_hit')).toHaveLength(3);
 });
 it('idle play costs two hearts in wave one, then fails in wave two',()=>{
  const s=createGarden(1);startWave(s);for(let i=0;i<3000&&s.stage==='playing';i++)tickGarden(s,.1);
  expect(s.stage).toBe('between');expect(s.hearts).toBe(1);expect(waveLeaks(s)).toBe(2);expect(s.message).toContain('漏过 2');
  expect(waveLeaks(parseState(resumeSnapshot(s)))).toBe(2);
  startWave(s);const retry=snapshot(s);expect(waveLeaks(s)).toBe(0);
  for(let i=0;i<3000&&s.stage==='playing';i++)tickGarden(s,.1);
  expect(s.stage).toBe('lost');expect(s.hearts).toBe(0);expect(s.attempts).toHaveLength(0);expect(retry.hearts).toBe(1);expect(waveLeaks(retry)).toBe(0);
 });
});
