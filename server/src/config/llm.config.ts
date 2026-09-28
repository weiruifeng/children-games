// LLM 配置（单一数据源）。
// 第一刀刻意精简：单模型、无 fallback、无熔断。
// 环境变量（在 server/.env 中配置，勿硬编码真实 key 进仓库）：
//   LLM_BASE_URL - OpenAI 兼容端点 baseUrl
//   LLM_API_KEY  - API key
//   LLM_MODEL    - 模型名，默认 deepseek-v4-pro
import 'dotenv/config';

export const LLM_ENDPOINT = {
  baseUrl: process.env.LLM_BASE_URL ?? '',
  apiKey: process.env.LLM_API_KEY ?? '',
  timeout: 60000,
};

export const LLM_MODEL = process.env.LLM_MODEL ?? 'deepseek-v4-pro';

export const DEFAULT_MAX_TOKENS = 8192;
export const DEFAULT_TEMPERATURE = 0.7;
