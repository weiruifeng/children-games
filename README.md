# 儿童游戏创造 Agent

面向儿童的小游戏创造原型：说出想玩的内容，系统会追问必要信息、生成可玩的收集类游戏，并支持在原游戏基础上继续修改。

## 当前能力

- 三个内置小游戏，包含收集物、障碍、危险区和追逐敌人。
- 文本与浏览器语音识别输入。
- 多轮对话生成；单个会话最多追问两次。
- 基于同一会话修改游戏；生成失败时回退到默认游戏或上一版游戏。
- 前端通过 SSE 展示接收、生成与校验三个阶段。

## 本地运行

需要 Node.js 20+（版本见 [`.nvmrc`](./.nvmrc)）。

1. 安装依赖：`npm install`
2. 复制 `server/.env.example` 为 `server/.env`，填入 OpenAI 兼容 LLM 的地址和密钥。
3. 启动前后端：`npm run dev`
4. 打开 `http://localhost:5173`

开发环境下 Web 会把 `/api` 请求代理到 `http://localhost:3009`。语音识别依赖浏览器的 Web Speech API；不支持或未授权时，仍可直接输入文字。

## 验证

```bash
npm run type-check
npm run build
npm run test -w web
npm run test -w server
```

## 当前边界

目前只实现 `collect` 游戏模板；游戏和对话 session 不持久化。Dodge/Jump 模板、游戏版本库、音效/BGM、TTS 和更复杂的敌人行为仍在后续范围内。
