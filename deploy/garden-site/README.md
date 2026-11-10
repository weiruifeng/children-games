# 首页与花园部署

生产环境参数来自私有环境文件或secret管理系统，不使用本地开发密码。当前源码仍保留旧功能，部署只使用本目录流程。

1. 在受支持Node环境安装依赖，运行 `npm ci`、`npm run build:garden-site`、`node scripts/check-garden-release.mjs`。
2. 创建独立生产数据库。使用迁移凭据运行 `npm run migrate:garden`；应用账号只授予业务库DML，不授予DDL。不要运行旧Studio迁移代替花园迁移。
3. 设置 `env.example` 中真实环境值。运行 `npm run bootstrap:admin`，交互输入用户名和密码。
4. `npm run start:garden-site` 启动API。安装systemd模板时替换Node路径、用户、目录；确保 `/api/ready` 成功。
5. HTTPS入口使用nginx示例，静态根指向 `web/dist-garden`；根首页保留。不要把 `/api/game`、Studio或其他服务代理到旧后端。
6. 首页→进入花园→注册登录；后台发码；两设备保存与恢复；验证旧API返回404。缺少LLM变量不应影响任何步骤。

## 更新和回滚

发布到新版本目录，先迁移后启动API、验证、切换静态目录。保留旧哈希文件支持打开中的页面；资源版本目录不覆盖原文件。回滚应用需兼容已经应用的数据库和内容版本，不执行down migration清空业务数据。

## 备份与恢复

配置独立私有存储挂载为GARDEN_BACKUP_DIR，密钥与备份分开保管；先使用 `openssl rand -base64 32` 生成密钥并直接存secret，不记录在日志。备份脚本AES-256-GCM加密、gzip压缩、记录密文摘要；子进程通过环境传凭据，不放命令行。

- `node server/scripts/garden-backup.mjs backup`：创建备份；失败退出非零。
- `node server/scripts/garden-backup.mjs check`：验证26小时内有成功备份，需由监控定时执行并告警。
- 使用对象存储生命周期/私有备份系统设置30天保留；脚本不擅自删除旧备份。
- `node server/scripts/garden-backup.mjs restore /private/path/file.sql.gz.enc`：先验证完整密文再恢复。默认只允许目标库名以 `_restore_test` 结尾，生产恢复需额外设置 `GARDEN_RESTORE_CONFIRM` 为目标库全名，且应先停止服务并单独备份现状。
- 恢复后自动撤销会话、重置码以及所有未消费邀请码，避免恢复点后已使用/撤销的码再次生效；管理员核对后发新码。
- 备份timer每天执行；`garden-backup-alert.service` 需由部署者接实际告警渠道，不配置该服务不能声称告警已上线。
- 首次上线前、此后每月恢复到隔离库并比对用户、槽位、事件数与样本；记录实际RPO/RTO。目录在应用同一磁盘不算异地备份。
- `node server/scripts/garden-maintenance.mjs` 清理过期操作记录，不清理玩家事件或迁移归档。

域名、生产库、私有备份目标及真实设备验收需实际部署时填写。提供模板不等于已经在生产生效。

## 管理员恢复和本机验证

管理员忘记密码时，具有数据库运维权限的人可执行 `node server/scripts/bootstrap-admin.mjs --recover`，交互输入新密码并再次确认管理员用户名；该操作撤销全部管理员会话并写审计。没有公开恢复管理员接口。

浏览器与集成验收使用独立 `*_test` 库；设置私有 `GARDEN_E2E_ADMIN_FILE` 后可运行 `node server/scripts/seed-garden-test-admin.mjs`。此脚本拒绝生产库，不属于正式账号初始化流程。测试管理员文件含敏感测试凭据，不提交Git。

上线前还须填好域名/证书、Node24路径、低权限运行凭据、独立备份挂载及告警单元。当前依赖审计的生产范围为0项已知漏洞；旧Nest CLI/Vitest开发依赖仍有审计告警，仅用于受控开发和CI，不公开其开发服务。后续升级这组工具需要连同TypeScript主版本一起验证。

## 游戏素材缓存与更新

资源加载与缓存设计见 [完整 Spec](../../docs/specs/pinyin-garden/resource-loading-and-cache.md)。正式构建使用 sharp 生成运行用 WebP，保留仓库原图；输出内容哈希素材、不可变清单、`resource-release.json`、体积报告及 `/garden/sw.js`。生产只发布专用构建，不依赖 `.workbench/`。

部署必须在切换入口前，将 `web/dist-garden/assets/garden/` 的 files、manifests、shells 三类不可变产物增量复制到 `/srv/garden/shared/web/assets/garden/`。nginx 模板从该共享目录读取它们；不能使用 `--delete`，也不能覆盖相同哈希/发布 ID 的文件。随后切换包含匹配 HTML、JS/CSS、Worker 和资源指针的新版本目录。旧构建的 JS/CSS 同样需要合并保留到新静态目录或由部署平台提供保留访问，避免仍打开的页面取不到旧代码。

旧素材和版本清单至少保留 30 天，并覆盖仍支持的客户端；后台定期清理前需核对发布记录、支持窗口和回滚目标。浏览器客户端租约无法作为服务器端“无人使用”的完整证据。回滚时切回匹配代码与资源指针，不删除新旧不可变文件、不清空玩家数据。

构建与本地校验：

```bash
npm run build:garden-site
node scripts/check-garden-release.mjs
npm run test:resources -w web
```

上线后对真实 HTTPS 入口执行以下检查，验证实际文件、摘要、MIME、缓存头与 404 行为：

```bash
node scripts/check-garden-resource-http.mjs https://实际部署域名
```

资源默认同域。若构建时设置 `VITE_GARDEN_ASSET_BASE_URL`，它现在表示提供完整 `/assets/garden/files/…` 路径的 CDN 站点根地址，例如 `https://cdn.example.com`；不再使用旧版 `/assets/pinyin-garden` 素材目录作为基址。CDN 必须允许站点 origin 的可读 CORS 响应、正确 MIME、不可变缓存及哈希校验；公共资源请求不携带 Cookie。版本指针和 Worker 仍从主站获取。CSP 的 `connect-src` 允许该 CDN，`img-src` 允许正式素材源和 `blob:`，不得为此放开任意脚本来源。

浏览器在独立资源缓存中保留公共素材，缓存不可用时通过网络/内存继续；“清理素材缓存”不会删除玩家存档、账号 Cookie 或学习事件。家长可在游戏设置或账号面板的“游戏素材”中检查更新、缓存全部素材、暂停、清理未使用素材和导出诊断。战斗中不执行全量缓存清理或更新重载；新版本在安全位置完成保存后切换。缓存素材不代表离线登录或断网刷新可玩。

真实 iPad Safari 的音频解锁、锁屏恢复、缓存驱逐与动画验收，以及生产源响应检查，仍需在实际设备/部署环境执行；本机 Chromium 自动化不能代替这些检查。


## 当前生产发布（2026-11-10）

- 游戏入口：https://49.232.35.207/；花园 `/garden/`，管理 `/admin/`。`wajilexue.cn` 与 `www.wajilexue.cn` 继续保留待备案 503 页面，本次未改变域名开放状态或 PUBLIC_ORIGIN。
- 当前目录：`/srv/garden/releases/20261110-resource-08da5976`；`/srv/garden/current` 指向该目录。资源发布 ID：`08da5976dc505fb78fe64cb8`。
- 不可变资源已写入 `/srv/garden/shared/web/assets/garden/`；新版本同时保留旧哈希脚本和历史素材。此前线上目录 `/srv/garden/releases/20261109-chinese-username` 为回滚保留版本，不得作为临时文件删除。
- 本次仅更新前端产物及静态缓存规则，后端和数据库未重启、未迁移、未初始化；garden、nginx、mysql 服务均正常。
- 公网验证通过全部 246 项素材的摘要、MIME、immutable 缓存头、入口 no-cache 及资源缺失真实 404；旧入口脚本仍返回 200。真实 Chromium 验证冷启动加载拦截、登录界面、Worker 激活、完整公开外壳、管理员登录、素材管理和退出，无页面异常。管理员测试没有修改玩家存档。
- 首次切换的即时探测命中旧 Nginx worker 并触发自动回滚；旧站复核正常后，增加重载接管等待，再次切换成功。发布脚本的回滚机制已实际执行验证。
- 真机 iPad Safari、真实玩家多设备游戏流程和后续版本升级/长期缓存驱逐仍按 Spec 验收，不将本次基础生产检查视为全部设备矩阵通过。


### 加载呈现修正发布（2026-11-10）

当前目录更新为 `/srv/garden/releases/20261110-loading-polish-a4fd9fca`，资源发布 ID 为 `a4fd9fca574008138e892c19`；上一版本 `/srv/garden/releases/20261110-loading-polish-eb6e9d8d` 和原资源版均保留，可回滚。只更新静态前端，nginx 规则、API 服务和数据库未改动，也未重启。

加载卡改为独立视口布局，手机竖屏、横屏、平板均完整显示。取消整页资源就绪淡入；素材等待采用 200ms 显示宽限，素材就绪后的短暂账号/存档确认采用 600ms 宽限，失败立即显示，已显示卡片连续接续。真实资源就绪条件保持不变。同步修复未开始的关卡关闭朗读时错误进入暂停面板的状态跳变。

通过 16 项浏览器回归、1,373 项单元测试、类型检查、正式构建及发布检查。线上手机浏览器验证冷启动卡片边界正常，首页和账号页各连续刷新三次，均未捕获可见加载卡、启动占位或整页淡入；无页面异常。真实 iPad Safari 和更慢设备/网络仍按完整设备矩阵验收，长时间真实等待会保留必要提示。


### 露珠收集规则修复（2026-11-10）

当前目录更新为 `/srv/garden/releases/20261110-dew-collector-cf982707`，资源发布 ID 为 `cf9827071ac6390b086d333d`；上一加载修正版保留为回滚目录。本次仅发布静态前端，后端、数据库和 nginx 配置保持原版本，服务未重启。

点击与 8 秒自动收集统一要求至少一个存活的露珠收集器；最后一个被铲除或击败后立即停止收集，到期水滴消失且不计收入。水滴不可用时变暗并标记“待收集器”，点击说明原因。正常收集保留飞入余额反馈，并支持减少动态效果。铲除退款及敌人奖励不变。

通过 1,384 项单元测试、类型检查、正式构建和 246 项发布文件校验。浏览器回归 19 项通过、1 项生产 Worker 专用场景在开发模式下跳过；其中 4 项实际画板验收覆盖未种植连点、种植后收集、铲除最后一个/保留另一个，以及普通/减少动态效果下的动画播放与结束。关卡通关测试已采用合法种植收集器的策略。

上线后通过公网 246 项素材的摘要、大小、MIME、缓存头及缺失文件 404 校验；真实 Chromium 验证手机冷启动布局、首页/账号页各三次热刷新，未捕获可见加载占位、加载卡或整页淡入，也无页面异常。
