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
   本地 MySQL 配置和固定的开发帐号也在该模板中；初始化说明见[本地 MySQL](docs/local-mysql.md)。
3. 启动前后端：`npm run dev`
4. 打开 `http://localhost:5173`

开发环境下 Web 会把 `/api` 请求代理到 `http://localhost:3009`。语音识别依赖浏览器的 Web Speech API；不支持或未授权时，仍可直接输入文字。

## 横版冒险实验

“小恐龙救朋友”提供三个触屏关卡、就近重试和受约束的 AI 玩法修改。
运行 `npm run dev` 后打开 [横版试玩](http://localhost:5173/experiments/dino-rescue/)。
只试玩可用 `npm run dev:rescue`；AI 修改需要运行后端并配置模型。
玩法契约、OpenGame 复用范围和试玩方法见 [实验说明](docs/opengame-rescue-pilot.md)。

## 验证

```bash
npm run type-check
npm run build
npm run test -w web
npm run test -w server
```

## 当前边界

原有创造主流程目前只支持 `collect`；横版冒险作为独立实验入口运行。
作品和版本库使用 MySQL，对话 session 仍在内存中。
通用 Dodge/Jump 模板、BGM、TTS 和更复杂的敌人行为仍在后续范围内。

## 拼音花园塔防实验

运行 `npm run dev:pinyin`，打开 `/experiments/pinyin-garden/`。该入口只需要前端静态文件，不依赖后端、数据库或模型密钥。

已接入五关共享弹药战斗、四伙伴三敌人、原创插画、音乐音效、本地三存档、星星装饰和通关后的字词复习。汉字拼音学习读音仍待补充；当前动画和配乐为可玩预览，精修动画图集尚未完成。
iPad 局域网试玩可运行 `npm run dev -w web -- --host 0.0.0.0 --port 5174`，使用电脑当时的局域网 IP 访问。同一设备换 IP/域名会使用不同的浏览器存档，请先导出备份。

维护、资源来源、已知限制和静态部署见 [拼音花园说明](docs/pinyin-garden.md)。
