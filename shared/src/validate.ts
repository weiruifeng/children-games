import { GameSpecSchema, type GameSpec } from './schema';

// strict：出现未定义字段即抛错，是「Validator 即合同」的体现
// 注：strict 需作用在每个 object schema 上（z.discriminatedUnion 无 .strict()）
export function validateGameSpec(input: unknown): GameSpec {
  return GameSpecSchema.parse(input);
}
