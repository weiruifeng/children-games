import {it,expect} from 'vitest';
import {createGarden,placePlant} from '@children-games/shared';
import {boardPoint,canDropPlant} from './touchBoard';
it('maps touch coordinates through a scaled and offset canvas',()=>{
 expect(boardPoint(247.5,290,{left:100,top:100,width:640,height:320})).toEqual({x:295,y:380,row:1,col:0});
 expect(boardPoint(99,200,{left:100,top:100,width:640,height:320})).toBeNull();
});
it('rejects occupied, closed, unaffordable and paused placement without spending',()=>{
 const s=createGarden();expect(canDropPlant(s,'plant_pod_slinger',0,0)).toBe(false);
 expect(canDropPlant(s,'plant_pod_slinger',1,0)).toBe(true);placePlant(s,'plant_pod_slinger',1,0);
 expect(canDropPlant(s,'plant_pod_slinger',1,0)).toBe(false);s.cooldowns.plant_pod_slinger=0;s.dew=0;
 expect(canDropPlant(s,'plant_pod_slinger',1,1)).toBe(false);s.dew=1000;s.paused=true;
 expect(canDropPlant(s,'plant_pod_slinger',1,1)).toBe(false);
});
