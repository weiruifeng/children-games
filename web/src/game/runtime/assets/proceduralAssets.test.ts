import { describe, it, expect } from 'vitest';
import { getAsset } from './proceduralAssets';

describe('getAsset', () => {
  it('返回已注册的 emoji 素材', () => {
    expect(getAsset('strawberry').emoji).toBe('🍓');
    expect(getAsset('yellow-dinosaur').emoji).toBe('🦖');
  });

  it('返回已注册的 color 背景', () => {
    expect(getAsset('volcano').kind).toBe('color');
  });

  it('未知 id 返回 fallback', () => {
    const a = getAsset('nonexistent');
    expect(a.kind).toBe('emoji');
    expect(a.emoji).toBe('❓');
  });

  it('注册新素材', () => {
    expect(getAsset('rock').emoji).toBe('🪨');
    expect(getAsset('t-rex').emoji).toBe('🦕');
    expect(getAsset('wolf').emoji).toBe('🐺');
    expect(getAsset('lava').kind).toBe('color');
  });
});
