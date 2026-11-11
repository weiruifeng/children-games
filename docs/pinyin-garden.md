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

## 代码质量与职责边界

统一入口 `npm run check` 执行 ESLint（不允许警告）、格式检查、类型检查、单元测试、构建和发布产物校验；`npm run format` 只做机械排版。生成题库与审核台账不参与手工格式化。ESLint 检查 React Hooks、Promise、可访问性和跨包导入，认证、存档与传输模块额外检查不安全类型传播。格式配置与 lint 规则各自负责其范围。

- `services/gardenSession.ts` 拥有当前槽位、Profile 与战局归属，统一生成进度/成绩；槽位切换和战局开始会更新会话版本，旧回调不能提交新会话。
- `services/saveCoordinator.ts` 捕获入队时的槽位与不可变 Profile，协调恢复日志及顺序本地写入；`services/useGardenScene.ts` 管理 Phaser 创建、就绪、超时、销毁和过期回调隔离。
- `site/repository.ts` 编排账号存档；`site/local.ts` 负责本地原子写入与租约，`site/eventSync.ts` 负责分批上传与服务器确认，`site/backupImport.ts` 负责完整校验后的分段暂存。冲突集合和统计以只读接口提供。
- `site/repositoryModels.ts` 校验本地记录外壳与恢复日志；历史 Profile 的内容兼容在进入游戏前校验，原始不兼容数据仍可归档/导出。`shared/transport.ts` 校验关键 API 响应；普通用户角色是 `user`，家长入口的认证 scope 是 `parent`，两者不是同一字段。
- shared 的公共包入口供前后端使用；前端读取源码，后端通过 CommonJS 构建产物加载。后端独立构建与开发启动会先编译 shared，本地一键启动也执行这一步。
- `server/src/http-errors.ts` 统一错误分类与 requestId；非预期异常保留堆栈帧，不记录异常中的 SQL/凭据文本。Phaser 运行异常进入素材诊断，区别于素材下载失败。

单元测试入口 `npm run test:unit`，其中后端默认测试执行真实单元用例，不再以跳过数据库测试作为成功证据。真实库测试使用显式配置的 `MYSQL_DATABASE=..._test npm run test:integration`，专用命令自动开启数据库用例，缺少隔离库配置直接失败。数据库需先执行迁移。

完整浏览器回归使用 `npm run test:e2e`，需要专用测试管理员与隔离 API。构建后设置 `GARDEN_E2E_START=1 GARDEN_E2E_PREVIEW_START=1 RESOURCE_PRODUCTION_ORIGIN=http://localhost:5195` 可同时启动本机测试 API 和构建预览；CI 使用该配置运行 accounts/resources，包含构建 Worker 的离线认证限制测试。默认未提供预览地址时，该单项测试会明确跳过；不能把这一状态报告为完整验收。

伙伴卡支持拖放，也可点击或用 Enter/Space 选择，再用方向键与 Enter 部署、Esc 取消；关闭选择面板后返回伙伴卡焦点。两种方式使用相同部署判定。焦点反馈遵守游戏及系统减少动态设置，部署、露珠、答题和结算继续使用原有游戏动画。

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
- 开发工具链升级连同TypeScript兼容性验证。2026-11-11 npm 官方审计报告有24项开发依赖风险（含2项critical、4项high），涉及Vitest/tinypool、Nest CLI和lint间接依赖；完整依赖树的报告不能由离线审计的0项结果替代。主版本升级及其兼容性修复需单独收敛，不使用强制自动升级。

当前部署位置和已执行回滚记录见部署手册；本机Chromium自动化不代替真机或完整多设备验收。跨设备入口须使用受信任HTTPS，本机localhost可开发，局域网IP普通HTTP不具备同等Web Crypto安全上下文。
