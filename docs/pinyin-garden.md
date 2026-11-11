# 拼音花园维护说明

更新：2026-11-10。当前内容包 `garden-adventure-4`，226关、1294项候选、1274项发布、20项排除、407种基础拼式。文字资料验证、人工审校与音频听审分别记录，不能用素材存在或测试通过代替人工审核。

## 入口、构建与验证

正式网站保留学习首页 `/`、花园 `/garden/` 与后台 `/admin/`；使用 `npm run build:garden-site` 和 `npm run start:garden-site`。产物分别为 `web/dist-garden` 与 `server/dist/server/src/garden-main.js`。本机账号版用 `npm run local:garden`，配置见根README。生产部署与当前发布位置见[部署手册](../deploy/garden-site/README.md)。

本地交互调试与资源浏览器测试复用 `/experiments/pinyin-garden/` 和匿名存储适配器；线上旧URL跳转到账号版。`npm run build` 和 `build:garden-site` 统一产出正式网站。旧生成/对话/Studio/恐龙代码与专属素材已移除，数据库迁移历史及存档兼容规则保留。Vite与Playwright分别只有一份配置；Playwright按accounts/resources项目分组。

长期检查：

```bash
npm run validate:garden-content
npm run type-check
npm test -w web
npm test -w server
npm run build:garden-site
node scripts/check-garden-release.mjs
npm run test:resources -w web
```

账号端到端检查使用 `npm run test:garden-e2e -w web`。真实数据库集成只对显式配置的隔离测试库执行 `GARDEN_DB_TEST=1 npm run test:garden-integration -w server`。部署后按手册执行资源HTTP检查；不要对生产库运行测试seed或集成用例。

## 当前规则与代码职责

- [玩法与题库契约](specs/pinyin-garden/spec.md)：关卡、学习范围、共享弹药、帮助、战斗、存档和迁移。
- [账号与云存档契约](specs/pinyin-garden/website-account-cloud-save.md)：账号隔离、API、热快照、长期事件、幂等与冲突处理。
- [资源加载与更新契约](specs/pinyin-garden/resource-loading-and-cache.md)：就绪、缓存、Service Worker、版本切换与失败恢复。
- `simulation.ts` 计算战斗事实，Phaser和组件呈现；动画不参与伤害、判题或计时。动态验收与减少动态要求见根AGENTS.md。
- `shared/src/pinyin-garden/data/` 保存稳定候选、关卡与迁移映射。[来源资料](specs/pinyin-garden/content-inventory/README.md)及许可证是长期维护输入；`audit-garden-content.py` 会更新台账和审核报告，不是只读检查。
- 原图与音频在 `web/public/assets/pinyin-garden/`，发布构建生成哈希素材与运行清单。[美术规范](specs/pinyin-garden/visual-assets.md)与[音频规范](specs/pinyin-garden/audio-assets.md)用于长期制作和替换。

## 数据与留存

匿名IndexedDB `pinyin-garden` v3 保留 profiles/profilesV2/profilesV3 与 migrationArchives。网站仓库按账号隔离，三个槽位分别保存热快照与事件outbox；MySQL长期事件不按45000条截断。Profile格式、内容包、云revision、事件schema与素材release分别版本化。

损坏槽位先导出原始数据再修复；清空进度、删除学习历史、清理已同步本机数据和退出账号是不同操作。旧匿名档不随账号切换或素材清理删除。完整NDJSON备份上限128MiB，导入校验成功前不改写目标槽。

部署凭据位于忽略的 `.runtime/garden-production/`，本机账号信息在 `.runtime/garden-local/`；与 `.env.garden.local`、玩家数据、备份密钥及恢复材料一样，不作为临时文件清理。服务器当前版本、回滚版本及共享不可变资源按部署保留策略管理。

## 待办与验收边界

以下集中记录尚未完成或仍需外部证据的事项，历史计划和通过数不作为当前验收结论：

- 内容逐项专业人工审校、音频听审及适龄性/儿童试玩；程序资料核验不等于人工通过。
- 真实iPad Safari与另一实际设备的触控、音频解锁、静音、锁屏/后台恢复、弱网、云同步和减少动态反馈。
- 大历史与128MiB备份在真实移动端的内存、耗时与恢复上限；缓存驱逐、GPU内存及长时间进出关卡。
- 独立私有备份目标、实际定时运行、告警接收方、恢复演练与RPO/RTO。现有本机演练与部署模板不代表独立生产备份已落实。
- 域名备案与正式域名切换。现有记录使用HTTPS IP；域名开放时须同时更新反向代理、PUBLIC_ORIGIN与www/IP重定向，并复验Cookie、登录和存档。
- 公开运营联系信息、数据保留说明、账号彻底删除/注销及归档/运维备份处理规则；删除槽位学习历史不等于账号彻底删除。
- 开发工具链升级连同TypeScript兼容性验证；依赖审计需重新运行，旧报告的0漏洞不能代表当前结果。

当前部署位置和已执行回滚记录见部署手册；本机Chromium自动化不代替真机或完整多设备验收。跨设备入口须使用受信任HTTPS，本机localhost可开发，局域网IP普通HTTP不具备同等Web Crypto安全上下文。
