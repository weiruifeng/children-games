# 拼音花园维护与交付

更新：2026-11-08。当前首页是 `web/src/pages/LearningHome.tsx`；花园入口为 `/experiments/pinyin-garden/`。正式上线保留首页和花园，新增账号及管理后台；具体拆分、云数据与后端职责见 [网站化 Spec](specs/pinyin-garden/website-account-cloud-save.md)。账号、邀请码、后台和独立云存档服务已实现；网站版入口为 `/garden/`，旧入口仅用于匿名试玩维护。见[本地验收记录](specs/pinyin-garden/website-acceptance.md)。

## 运行与验证

- 首页：`npm run dev:web`，访问 `/`；直接花园：`npm run dev:pinyin`。
- 局域网平板：`npm run dev -w web -- --host 0.0.0.0 --port 5174`。
- 检查：`npm run validate:garden-content`、`npm run type-check`、`npm test -w web`、`npm test -w server`、`npm run build`。
- 构建预览：`npm run preview -w web -- --host 127.0.0.1 --port 4174`，验证首页与花园直接访问/刷新。
- 目前静态试玩不需要后端、MySQL或模型。全量构建仍包含恐龙等非上线入口；专用发布包待按网站化Spec实施。
- 当前路径依赖站点根目录 `/assets/`，不宣称支持任意子目录部署。媒体请求缺失需返回404，不得重写为HTML。

## 当前课程与游戏

以 [玩法Spec](specs/pinyin-garden/spec.md)、[实施记录最新验收节](specs/pinyin-garden/implementation-plan.md)及代码为准。不要使用旧五关题库或14课顺序解锁描述指导新版开发。

- `characterCatalog.ts` 发布内容包为 `garden-adventure-4`，使用稳定levelId；五档战斗难度与学习关卡分别配置。
- 2026-11-08内容验证输出为226个冒险关卡、1,294项读音候选、1,274项文本发布、20项排除。文本发布不等于音频人工审核完成，当次 `audioReviewed=0`。
- `lessonPlanner.ts` 根据历史记录生成逐波学习计划。快照保留题目、选项、范围与答案校验值，内容不匹配不得静默替换题目。
- `simulation.ts`负责战斗事实，Phaser和组件负责呈现。动画不参与伤害结算；设置支持减少动态。后续任何页面/交互改动按根AGENTS.md检查动画反馈和减弱模式。
- 波次手动开始，暂停、切后台与刷新恢复不应自动推进战斗。checkpoint与waveStart分别承担继续与波初重试。

## 本地存档与迁移

- IndexedDB数据库 `pinyin-garden` v3，当前对象仓库 `profilesV3`，保留 `profiles`、`profilesV2` 和 `migrationArchives`。
- Profile格式v3与内容包版本分开；parseProfile支持v1/v2及指定旧v3包迁移。旧包的战斗/成就恢复遵循明确映射，原始数据归档，不声称全部无损恢复。
- 三个存档槽按浏览器origin隔离，当前没有账号归属。换设备或域名需要导出/导入。
- 战斗约每秒及关键操作后保存；同步localStorage恢复日志先写，IndexedDB串行提交；较旧提交不应清掉更新的恢复日志。
- 损坏槽位单独隔离；先导出原始备份，再确认清空。导入/清空须等待当前保存队列。
- 网站版独立仓库按账号保存热快照与事件outbox；长期事件在MySQL中不按45,000条截断。完整NDJSON备份上限128MiB，失效旧战斗可归档恢复；旧匿名数据保持独立。
- 导出可能包含孩子的昵称与学习记录，不放入公开静态目录或提交到仓库。

## 资源与内容来源

- `web/public/assets/pinyin-garden/`：角色、背景、道具、音乐、音效和读音；当前磁盘体积约36 MB。
- `web/src/experiments/pinyin-garden/assets/manifest.ts`：图片映射；`pronunciation-manifest.json`：读音索引；src/assets/audio-manifest为可导入的音乐/音效索引；生成脚本同时保留public兼容副本。
- `shared/src/pinyin-garden/data/`：候选台账、关卡、冒险关卡和迁移映射。运行内容不得读取 `.workbench` 或本机绝对路径。
- [题库整理与来源](specs/pinyin-garden/content-inventory/README.md)、相关原始资料和许可证必须保留；审核记录、音频核验与文本发布各自独立。
- [美术说明](specs/pinyin-garden/visual-assets.md)、[音频说明](specs/pinyin-garden/audio-assets.md)保留为素材来源与制作参考；历史规划不等于全部已制作完成。
- 首页Waji组件、样式和依赖也属于正式发布范围。`public/design/`评审稿不进入生产包。

## 发布与验收边界

生产需要HTTPS、正确MIME及缓存策略。当前未哈希媒体使用验证缓存；哈希JS/CSS可长期缓存。后续资源版本化、后台权限、备份恢复与生产API白名单以网站化Spec为准。

网站版验证包含原玩法回归、同步故障单测、真实MySQL事务和两个独立浏览器上下文；最新数量和范围见本地验收记录。真实iPad与最终HTTPS部署环境仍需专项验证。

已有截图和一次性验收资料保留在各自 `.workbench/` 任务目录，不属于正式运行依赖。本次文档清理不删除这些历史产物、存档备份或用户数据。已被替代的五关历史Spec/Plan和14课基线已删除，可通过Git历史追溯。
