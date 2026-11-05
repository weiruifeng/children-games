import { describe, expect, it } from 'vitest';
import { PlatformerMovement } from './PlatformerMovement';

function setup(doubleJump = false) {
  let grounded = true;
  const velocity = { x: 0, y: 0 };
  const body = { onFloor: () => grounded, touching: { down: false }, velocity,
    setVelocityY: (y: number) => { velocity.y = y; } };
  const owner = { body, scene: { time: { now: 1000 } }, setVelocityX: (x: number) => { velocity.x = x; } };
  const movement = new PlatformerMovement({ walkSpeed: 210, jumpPower: 580, coyoteTime: 130, jumpBufferTime: 160, doubleJumpEnabled: doubleJump });
  movement.attach(owner); movement.update();
  return { movement, owner, velocity, setGround: (value: boolean) => { grounded = value; } };
}

describe('adapted OpenGame movement', () => {
  it('allows one coyote jump but not repeated jumps on a stale grounded tick', () => {
    const s = setup(); s.setGround(false); s.owner.scene.time.now += 100;
    expect(s.movement.jump()).toBe(true); expect(s.movement.jump()).toBe(false);
    const sameTick = setup(); expect(sameTick.movement.jump()).toBe(true); expect(sameTick.movement.jump()).toBe(false);
  });
  it('buffers a landing input and clears it when restarting', () => {
    const s = setup(); s.setGround(false); s.owner.scene.time.now += 200;
    expect(s.movement.jump()).toBe(false);
    s.setGround(true); s.owner.scene.time.now += 50; s.movement.update();
    expect(s.velocity.y).toBe(-580);
    s.movement.resetCoyoteTime(); s.setGround(false); expect(s.movement.jump()).toBe(false);
  });
  it('allows exactly two jumps when enabled, resets after landing', () => {
    const s = setup(true); expect(s.movement.jump()).toBe(true); s.setGround(false);
    expect(s.movement.jump()).toBe(true); expect(s.movement.jump()).toBe(false);
    s.setGround(true); s.velocity.y = 0; s.movement.update(); expect(s.movement.jump()).toBe(true);
  });
});
