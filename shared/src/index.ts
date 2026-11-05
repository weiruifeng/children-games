export { GameSpecSchema, CollectSpecSchema, DodgeSpecSchema, JumpSpecSchema, GameObjectSchema, HitPolicySchema } from './schema';
export type { GameSpec, CollectSpec, GameObject, HitPolicy, CollectibleObject, ObstacleObject, HazardObject, EnemyObject } from './schema';
export { validateGameSpec } from './validate';
export { RESCUE_PHYSICS, RescueSpecSchema, validateRescueSpec, DEFAULT_RESCUE_SPEC, RESCUE_EXAMPLE_REQUESTS } from './rescue';
export type { RescueSpec, RescueLevel } from './rescue';
