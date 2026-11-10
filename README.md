# 挖机的学习小世界 · 拼音花园

正式网站保留学习首页、Waji和拼音花园，提供邀请码注册、登录、管理员后台与MySQL云存档。拼音花园运行不依赖模型或模型密钥。学习事件与游戏快照分开保存；三个花园按账号隔离，支持冲突处理、旧档迁移与完整备份。

## 本机一键启动

先切到包含账号/云存档实现的 `feature/20261108-server` 分支，使用Node24和本机MySQL。首次配置把 `deploy/garden-site/local.env.example` 复制到仓库根 `.env.garden.local`，填写本地凭据并创建同名空数据库；该文件已被Git忽略。

```bash
npm run local:garden
```

该命令检查端口、编译后端、执行幂等迁移，再同时启动前后端；Ctrl+C停止两者。默认首页 `http://localhost:5191/`，后台 `/admin/`，API仅监听本机3010端口。已有数据库不会被清空。首次管理员通过另一终端的交互命令创建：

```bash
node --env-file=.env.garden.local server/scripts/bootstrap-admin.mjs
```

已有管理员不重复初始化。此命令使用独立本地配置，不复用旧Studio数据库或自动化测试库。运行期间不要切换源码分支。

当前账号版依赖安全上下文中的Web Crypto接口；localhost可用于本机HTTP开发，局域网IP的普通HTTP不能视为等价入口。手机/iPad应使用受信任HTTPS，并把PUBLIC_ORIGIN配置为完全一致的访问地址。本地开发启动命令不是生产部署命令。

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
- [资源加载与缓存 Spec](docs/specs/pinyin-garden/resource-loading-and-cache.md)：进入就绪条件、素材缓存、更新与失败恢复。
- [部署与备份手册](deploy/garden-site/README.md)：HTTPS、数据库权限、备份、恢复、回滚。
- [花园维护说明](docs/pinyin-garden.md)、[玩法Spec](docs/specs/pinyin-garden/spec.md)。
- [题库来源与覆盖](docs/specs/pinyin-garden/content-inventory/README.md)：审核原始证据及许可证，保留在仓库。

## 保留但不上线的代码

游戏创造、对话、Studio和恐龙实验保留源码与原有数据。网站专用构建及GardenSiteModule不加载这些模块；旧生成、对话、作品接口为404。只有维护这些旧功能时才涉及模型配置及 [Studio数据库说明](docs/local-mysql.md)、[恐龙复用说明](docs/opengame-rescue-pilot.md)。

当前已有HTTPS IP发布记录；域名备案、独立备份/告警和真机验收等剩余事项见[维护待办](docs/pinyin-garden.md#待办与验收边界)。


## 当前线上入口

2026-11-10 已将资源预加载、本地素材缓存和版本更新发布到 [HTTPS IP 网站](https://49.232.35.207/)。域名继续等待备案；本次生产验证范围与回滚位置见 [部署手册](deploy/garden-site/README.md#当前生产发布2026-11-10)。
