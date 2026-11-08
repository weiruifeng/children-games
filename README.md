# 挖机的学习小世界 · 拼音花园

正式网站保留学习首页、Waji和拼音花园，提供邀请码注册、登录、管理员后台与MySQL云存档。拼音花园运行不依赖模型或模型密钥。学习事件与游戏快照分开保存；三个花园按账号隔离，支持冲突处理、旧档迁移与完整备份。

## 网站本地运行

使用Node.js 24（`.nvmrc`）与MySQL。创建独立花园数据库，并设置 `MYSQL_HOST`、`MYSQL_PORT`、`MYSQL_DATABASE`、`MYSQL_USER`、`MYSQL_PASSWORD`。生产配置示例见 [部署目录](deploy/garden-site/README.md)，不要使用旧Studio开发数据库作为正式花园库。

```bash
npm ci
npm run migrate:garden
npm run build:garden-site
npm run bootstrap:admin
npm run start:garden-site
```

另一个终端运行 `npm run dev:garden-site`，打开 `http://localhost:5173/`。本地API默认3009端口；`PUBLIC_ORIGIN`须与浏览器实际origin完全一致。管理员登录 `/admin/` 发码，普通用户在 `/garden/` 注册。部署时使用HTTPS同域代理，生产Cookie才设置Secure。

仅维护旧匿名试玩版时可运行 `npm run dev:web` 或 `npm run dev:pinyin`，地址为 `/experiments/pinyin-garden/`；这份匿名档仍只在浏览器，网站版可以显式导入它，不自动删除。

## 验证与发布

```bash
npm run type-check
npm test -w web
npm test -w server
# 仅对显式配置的 *_test 隔离库运行
GARDEN_DB_TEST=1 npm run test:garden-integration -w server
npm run build:garden-site
node scripts/check-garden-release.mjs
```

发布前端目录是 `web/dist-garden`，后端入口是 `server/dist/server/src/garden-main.js`。全仓库 `npm run build` 仍用于保留代码回归，包含其他实验，不能把它的 `web/dist` 当作网站上线目录。

可复用浏览器测试：`npm run test:garden-e2e -w web`。使用测试管理员环境变量或私有 `GARDEN_E2E_ADMIN_FILE`；首次安装浏览器运行 `npx playwright install chromium`。CI通过仅允许测试库的seed脚本创建临时管理员，不写入生产默认密码。

## 文档

- [网站化Spec](docs/specs/pinyin-garden/website-account-cloud-save.md)：数据归属、接口和同步契约。
- [实施Plan](docs/specs/pinyin-garden/website-implementation-plan.md)：里程碑与外部上线条件。
- [本地验收记录](docs/specs/pinyin-garden/website-acceptance.md)：执行证据、覆盖范围和待上线事项。
- [部署与备份手册](deploy/garden-site/README.md)：HTTPS、数据库权限、备份、恢复、回滚。
- [花园维护说明](docs/pinyin-garden.md)、[玩法Spec](docs/specs/pinyin-garden/spec.md)、[课程实施记录](docs/specs/pinyin-garden/implementation-plan.md)。
- [题库来源与覆盖](docs/specs/pinyin-garden/content-inventory/README.md)：审核原始证据及许可证，保留在仓库。

## 保留但不上线的代码

游戏创造、对话、Studio和恐龙实验保留源码与原有数据。网站专用构建及GardenSiteModule不加载这些模块；旧生成、对话、作品接口为404。只有维护这些旧功能时才涉及模型配置及 [Studio数据库说明](docs/local-mysql.md)、[恐龙复用说明](docs/opengame-rescue-pilot.md)。

当前交付是可本地验收的上线准备实现，尚未部署到真实域名。生产数据库、独立备份目标、告警接收方和真实iPad验收需要在发布环境落实。
