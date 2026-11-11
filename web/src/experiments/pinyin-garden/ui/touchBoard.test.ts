import { it, expect } from 'vitest';
import { createGarden, placePlant, startWave } from '@children-games/shared';
import { boardPoint, boardDragSize, canDropPlant } from './touchBoard';
it('maps touch coordinates through a scaled and offset canvas', () => {
  expect(boardPoint(247.5, 290, { left: 100, top: 100, width: 640, height: 320 })).toEqual({
    x: 295,
    y: 380,
    row: 1,
    col: 0,
  });
  expect(boardPoint(99, 200, { left: 100, top: 100, width: 640, height: 320 })).toBeNull();
});
it('rejects occupied, closed, unaffordable and paused placement without spending', () => {
  const s = createGarden();
  startWave(s);
  expect(canDropPlant(s, 'plant_pod_slinger', 0, 0)).toBe(false);
  expect(canDropPlant(s, 'plant_pod_slinger', 1, 0)).toBe(true);
  placePlant(s, 'plant_pod_slinger', 1, 0);
  expect(canDropPlant(s, 'plant_pod_slinger', 1, 0)).toBe(false);
  s.cooldowns.plant_pod_slinger = 0;
  s.dew = 0;
  expect(canDropPlant(s, 'plant_pod_slinger', 1, 1)).toBe(false);
  s.dew = 1000;
  s.paused = true;
  expect(canDropPlant(s, 'plant_pod_slinger', 1, 1)).toBe(false);
});

it('keeps placement locked before starting and between waves', () => {
  const s = createGarden(),
    dew = s.dew;
  expect(canDropPlant(s, 'plant_pod_slinger', 1, 0)).toBe(false);
  expect(placePlant(s, 'plant_pod_slinger', 1, 0)).toBe(false);
  expect(s.dew).toBe(dew);
  startWave(s);
  expect(placePlant(s, 'plant_pod_slinger', 1, 0)).toBe(true);
  s.stage = 'between';
  s.cooldowns.plant_pod_slinger = 0;
  expect(placePlant(s, 'plant_pod_slinger', 1, 1)).toBe(false);
  expect(canDropPlant(s, 'plant_pod_slinger', 1, 1)).toBe(false);
});
it('matches the drag ghost to the painted landing rectangle', () => {
  expect(boardDragSize({ width: 896, height: 448 })).toEqual({ width: 99.4, height: 84 });
});
