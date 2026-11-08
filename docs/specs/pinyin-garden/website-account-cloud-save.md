# 拼音花园网站化：账号、邀请注册、管理后台与云存档 Spec

- 状态：网站化代码已落地并完成本地验收；真实部署与设备验收待执行。
- 编写日期：2026-11-06。
- 初稿日期：2026-11-06；最近代码复核：2026-11-08，基线 `eb02c83`。
- 第5～7节已对齐实际云DTO、长期事件与同步实现；第13节保留实施前复核依据。实际验证见[验收记录](website-acceptance.md)。
- 适用范围：保留当前 LearningHome 首页和拼音花园，新增账号与管理后台；游戏生成和其他游戏不进入正式发布包。
- 发布边界已由用户于2026-11-08确认；专用构建和服务入口已独立，旧源码与作品数据保留。
- 默认产品选择：家长用户名/密码登录、邀请码注册、每账号三个花园、管理员手动发码、同域部署。下文除“待确定”项外均作为实施默认值。

实施任务、依赖与分阶段完成标准见 [网站化实施 Plan](website-implementation-plan.md)。原 `implementation-plan.md` 是课程改造记录，不承担本次网站化任务。

## 1. 目标与边界

### 1.1 目标

1. 只有持有有效邀请码的人可以注册家长账号，已有账号登录不再需要邀请码。
2. 每个账号拥有三个独立花园，在不同设备登录后可以恢复最近成功同步的进度。
3. 游戏即时保存仍在本地完成，网络失败不阻塞每次操作；云端同步结果有明确反馈。
4. 管理员通过后台生成、查看、撤销邀请码，禁用账号并协助重置密码。
5. 网站、API、数据库及静态资源有明确的部署、更新、备份和恢复方式。
6. 现有本机存档可安全迁移，覆盖、冲突和失败必须可解释，不静默丢数据。

### 1.2 首版不做

- 手机短信、邮箱验证、第三方登录、收费订阅、多角色家庭协作。
- 在线课程编辑、素材上传后台、自动发码邮件、学习数据分析平台。
- 实时多人游戏、跨设备战斗状态合并、排行榜及服务端反作弊。
- 完整离线安装/PWA；浏览器已有缓存不等于完整离线可用。
- 将所有游戏状态拆成关系表；首版采用校验后的 Profile JSON 快照。
- 让管理员直接浏览、修改儿童学习记录。管理员列表仅显示账号运营所需字段。

邀请注册限制账号创建和云数据访问，不承诺隐藏可公开下载的前端代码、课程和图片。首版在线游戏入口需要有效登录；离线续玩仅允许已打开且已认证过的当前会话继续，离线刷新不绕过登录校验。

### 1.3 已确认的发布范围与拆分边界

- 根路径 `/` 保留 `web/src/pages/LearningHome.tsx` 的“挖机的学习小世界”，沿用 Waji、首页样式、减少动态设置及进入花园交互；不得替换为旧 `pages/Home.tsx`，不得直接重定向整个首页。
- 首页公开可访问；进入花园后检查登录。已登录继续进入花园，未登录显示账号入口并保留合法返回位置。首页“识字乐园/数学乐园”可保留当前非交互预告，不增加未实现游戏链接。
- 正式公开页面只有首页与拼音花园，外加业务必需的登录注册/重置页面和受权限保护的 `/admin/`。
- 游戏创造相关 `App.tsx`、`pages/Home.tsx`、`Converse.tsx`、`Game.tsx`、作品API客户端，以及恐龙实验，不进入正式前端依赖图。不能只隐藏按钮而继续打包这些页面。
- 后端不加载 GameModule、StudioModule、RescueModule、LLM模块；花园启动和健康检查不需要任何LLM环境变量，不访问模型端点。
- 同仓库逻辑隔离，首版不搬到新仓库、不删除旧功能源码或作品数据。旧功能如需恢复开发使用独立开发入口，不复用线上根首页。
- 构建输出必须与旧全量构建分目录。建议新增 `build:garden-site` 与 `start:garden-site`，命令目前尚不存在；生产流水线只使用这组专用命令。
- 首页图像、Waji动态组件及必要资源也在发布白名单内，不能按“只有pinyin-garden文件夹”筛选而遗漏首页依赖。后台依赖不得拉入旧创造功能。
- 数据库复用公共连接层，新增花园业务表；现有 game_record/game_version 不承担账号花园存档，首次花园部署不要求执行Studio建表迁移。

## 2. 实施前代码事实与复用范围

| 位置 | 当前行为 | 改造要求 |
| --- | --- | --- |
| `web/src/experiments/pinyin-garden/GardenApp.tsx` | 槽位加载、串行保存、导入导出、清空均直接调用本地存储；战斗约每秒保存，阶段切换和隐藏页面也保存 | 引入账号外壳和存档协调器；保留战斗计算、音频、操作和课程规则 |
| `web/src/experiments/pinyin-garden/services/saveStore.ts` | IndexedDB `pinyin-garden` v3；`profiles`、`profilesV2`、`profilesV3`、`migrationArchives`；localStorage 恢复日志；Web Locks 单写者 | 保留为旧数据读取器，新增按账号隔离的云存档缓存，避免原地破坏旧槽位 |
| `shared/src/pinyin-garden/snapshot.ts` | `Profile.version=3`、`packVersion=garden-adventure-4`；支持 v1/v2 和旧 v3 包迁移；checkpoint、waveStart、previousArchive、legacyArchive | 前后端共用校验；账号和同步元数据放外层，不污染 Profile |
| `shared/src/pinyin-garden/curriculum.ts` | 课程版本常量与课程限制 | 服务端启动时使用一致的内容包；不在上传时强行改写未知版本 |
| `web/src/experiments/pinyin-garden/services/routes.ts` | hash 路由；URL 槽位 1–3，代码索引 0–2；battle 参数支持稳定 levelId，兼容旧课程数字 1–14 | 游戏路由继续保留；在 API 边界统一转换槽位 |
| `web/src/experiments/pinyin-garden/assets/manifest.ts` | 图片为根路径 `/assets/pinyin-garden/...` | 统一资源 URL 构造器 |
| `services/gardenAudio.ts`、`services/pronunciation.ts` | 音效、音乐和点击发音的加载入口 | 所有媒体统一解析资源基地址，不只处理图片 |
| `web/src/main.tsx`、`pages/LearningHome.tsx` | 根入口已是学习首页，链接拼音花园；旧 App.tsx 未被此入口加载 | 保留首页、Waji和样式，接入正式花园地址 |
| `web/vite.config.ts` | 首页、恐龙、花园三个构建入口，开发 `/api` 代理 3009 | 专用构建仅保留首页、花园、后台，排除恐龙与旧创造代码 |
| `server/src/modules/studio/database.service.ts` | mysql2 连接池、参数化查询和事务包装 | 抽到公共 DatabaseModule，Studio 与新模块共享一份池 |
| `server/src/modules/studio/studio.service.ts` | 作品/版本持久化，没有账号归属过滤 | 花园部署禁用此模块，不视为已具备用户隔离 |
| `server/src/main.ts`、`app.module.ts` | `/api` 前缀，开放 CORS，加载现有全部模块 | 花园部署使用明确模块入口和同域策略 |
| `server/src/config/database.config.ts` | 允许本地开发默认连接参数 | 生产环境缺少配置时失败退出，禁止开发密码回退 |
| `server/database/migrations/001_create_game_studio.sql` | 现有 SQL 迁移 | 后续迁移独立编号，不改写既有迁移 |

当前媒体目录 `web/public/assets/pinyin-garden/` 约 36 MB，是磁盘体积，不等于首次页面传输量。当前实现以代码、`spec.md`及`implementation-plan.md`最新验收节为准；已移除过时14课基线文档。

## 3. 用户流程与界面

### 3.1 页面与入口

| 页面 | 建议 URL | 行为 |
| --- | --- | --- |
| 网站首页 | `/` | 保留当前 LearningHome；公开访问，点击进入花园再检查登录 |
| 游戏及账号外壳 | `/garden/` | 认证检查完成前不加载账号存档 |
| 登录 | `/garden/#/login` | 用户名、密码、注册入口、找回说明 |
| 注册 | `/garden/#/register` | 邀请码、用户名、密码、确认密码 |
| 重置密码 | `/garden/#/reset-password` | 手工输入一次性重置码、新密码 |
| 三个花园及游戏 | `/garden/#/gardens` 等 | 延续现有 `#/garden/1/...` 路由 |
| 管理后台 | `/admin/` | 独立 HTML/React 入口，同一会话体系，要求 admin 权限 |
| 旧入口 | `/experiments/pinyin-garden/` | 同域跳转 `/garden/`，保留合法游戏 hash |

登录外壳先解析账号相关 hash，再把游戏 hash 交给现有 `parseRoute`。登录后的返回路径只允许本站游戏白名单，禁止接受任意外部 URL。直接打开 battle 深链仍按现有规则检查 checkpoint，不因此创建新战斗或越过解锁限制。

### 3.2 注册与登录

- 用户名：4–32 位 ASCII 字母、数字、下划线，首位字母；统一小写存储和查重，不作为孩子姓名。
- 密码：15–128 个 Unicode 字符，允许空格，不自动 trim，不强制复杂组合；输入需有显隐切换和粘贴支持。
- 花园昵称继续沿用 Profile 的 1–20 字符限制；不采集孩子真实姓名、出生日期。
- 注册成功创建普通用户和三个空云槽位，消耗邀请码；不自动登录，进入登录页。
- 网络超时后的注册重试：若邀请码已经使用，提示尝试登录或联系管理员，不再次消耗邀请码。
- 登录错误统一提示“账号或密码不正确”；禁用账号的登录不暴露额外账号信息。
- 登录成功读取 `/auth/me` 和云槽位，处理本地待同步数据后进入花园列表。
- 新账号看到三个空槽位，点击槽位才通过 `newProfile` 创建花园；获取列表本身不写库。

### 3.3 退出与会话失效

- 主动退出前暂停游戏，完成本地保存，尝试一次云同步。
- 有未同步记录时提供“继续等待”“导出后退出”“保留本机记录并退出”；默认不删除数据，不无限阻塞退出。
- 退出请求成功后清除界面身份、内存快照，终止队列；本地未同步数据仍按原 userId 隔离。
- 若退出请求失败，不宣称服务器会话已注销；锁住界面并显示重试说明，恢复网络后优先完成退出。
- 在线收到 401/账号禁用后暂停游戏并要求重新登录；不得拿另一个账号的会话继续上传旧队列。
- 网络断开与 401 分开处理：断网可在当前已打开的游戏继续，本地保存提示保持可见。

### 3.4 管理后台

- 邀请码列表：前缀、状态、备注、创建/到期/使用时间、使用账号；支持状态筛选、游标分页。
- 生成：默认 1 个，最多 100 个；默认 7 天有效，可选 1/7/30 天；每码固定一次使用。
- 明文仅在生成结果中展示一次，支持复制/下载；刷新后无法从摘要恢复，不用 URL 或日志传递邀请码。
- 撤销未使用码；重复撤销幂等，已使用码不能恢复为可用。撤销不会禁用已注册账号。
- 用户列表：用户名、角色、创建时间、状态；可禁用/启用普通账号。
- 密码重置：管理员生成 30 分钟有效的一次性随机重置码，线下交给账号持有人；新码使旧码失效，兑换成功撤销该账号全部会话。
- 首版无角色提升 UI，不允许禁用管理员；管理员更替走受控运维命令，避免锁死唯一管理员。
- 修改操作有成功/失败提示；禁用和撤销有确认对话框；后台不展示完整 session、密码哈希或存档正文。

## 4. 服务端架构与认证

### 4.1 模块划分

```text
GardenSiteModule（花园部署专用入口）
  DatabaseModule
  AuthModule         用户、会话、密码修改/重置、认证守卫
  InvitationsModule 邀请码生成与注册时核销
  GardenModule       三槽位、校验、版本控制、幂等写入
  AdminModule        管理接口、审计
  HealthController   最小健康检查
```

现有 AppModule 继续服务本地原项目。新增花园启动脚本和构建入口，不导入 GameModule、StudioModule、RescueModule 或 LLM 配置；仅靠隐藏前端入口不足以关闭旧 API。上线测试需验证这些旧 API 返回 404。

### 4.2 会话与权限

- 使用随机 256-bit opaque Session Token，数据库仅存 SHA-256 摘要；不使用 localStorage 保存 bearer token。
- HTTPS 生产 Cookie：`__Host-garden_session`，`HttpOnly; Secure; SameSite=Lax; Path=/`，不设置 Domain；开发环境单独使用无 Secure 的开发 cookie 名。
- 普通会话绝对有效期 30 天、空闲期 7 天；管理员绝对有效期 12 小时、空闲期 30 分钟。活跃时间最多每 5 分钟更新一次，避免每个请求写表。
- 登录后创建新 session；注销、密码修改、重置和禁用撤销相应会话。权限来自每次请求查到的当前用户状态，不能只信登录时快照。
- `/auth/me` 返回当前用户和会话绑定 CSRF token；所有已认证写请求要求 `X-CSRF-Token`，并校验精确 Origin 白名单。
- 登录、注册、重置等未认证写请求也校验 Origin、只接受 JSON；生产关闭开放 CORS。无 Origin 的运维操作不走浏览器公开接口。
- 普通接口只从 session 取得 userId，拒绝请求体额外的 userId/role 字段。后台额外验证角色。
- 密码采用 Argon2id，参数基准至少 m=19 MiB、t=2、p=1，部署机器上测算延迟后可调强；哈希包含算法及参数，登录时支持升级重哈希。
- 代理信任仅配置真实反向代理跳数/网段；不得直接相信任意 X-Forwarded-For。
- 首版单后端实例；登录每 IP 15 分钟最多 30 次、每规范化用户名最多 10 次失败；注册每 IP 每小时最多 10 次；重置兑换每 IP 15 分钟最多 10 次。限流状态持久化到数据库，多实例前保持共享限流，不使用永久锁账号。
- 存档写入每账号每分钟 30 次，读取 120 次；超限 429 + Retry-After，不丢弃本地队列。

### 4.3 管理员初始化

提供交互式 `bootstrap-admin` 运维命令：使用数据库连接、读取隐藏密码输入、拒绝存在管理员时重复引导。命令不打印密码，不通过前端或公开初始化 API 执行。后续管理员恢复使用单独运维命令并写审计；生产环境不设置默认管理员密码。

## 5. 持久化模型

实际DDL见 `server/database/migrations/002_garden_site.sql`。UTC DATETIME、utf8mb4；业务实体使用UUID，事件分页使用递增序号；revision限制在JS安全整数范围内。

| 表 | 职责与约束 |
| --- | --- |
| garden_user | 用户名唯一、Argon2id密码摘要、user/admin角色、active/disabled状态 |
| garden_session | 仅存会话token摘要；用户、CSRF secret、绝对到期/活动/撤销时间 |
| garden_invitation | 128-bit随机码摘要、前缀、备注、期限、创建人和唯一使用人 |
| garden_profile | 每账号三个稳定ID；槽号、热快照、revision、generation、history_floor |
| garden_mutation | 用户+mutationId唯一；规范请求摘要与结果；与快照同事务提交 |
| garden_learning_event | profile+generation+eventId唯一；事件JSON、源内容包、接收时间、分页ID |
| garden_archive | 用户私有的原始迁移、冲突、失效战斗与备份历史；不放热快照 |
| garden_password_reset | 一次性重置码摘要、有效期、消费和撤销时间 |
| garden_admin_audit | 操作人、动作、目标、时间；不记录密码、令牌或完整存档 |
| garden_rate_limit | 持久限流窗口；原子计数 |
| garden_schema_migration | 运维迁移记录与文件校验和 |

CloudProfile使用独立 `cloudVersion:1`；其中本地格式仍为 `version:3`，内容包 `garden-adventure-4`。热快照保留进度、设置、战斗状态及波初状态；剥离顶层attempts、previousArchive、legacyArchive和战斗内重复attempts。长期事件独立保存，事件schemaVersion=1，不按45,000条截断。旧本地Profile中的原始嵌套归档进入garden_archive。

清空进度将profile设为null，revision和generation递增；旧代学习历史保留，不参与新花园组题。显式删除学习历史删除该槽事件并推进history_floor，迟到旧队列被拒绝。迁移/冲突归档仍供恢复，服务器备份按运维保留策略管理；这不是账号彻底删除接口。

容量统一定义于shared/cloud.ts：热快照1MiB、事件批次200条/256KiB、单归档24MiB、用户备份128MiB。归档过大拆成带archiveId/part/total的文本片段。拒绝时保留本机数据并可导出；不把历史静默塞回热快照。应用账号仅DML，DDL由迁移凭据执行；迁移工具带锁、校验和和重复执行检测。

## 6. API 契约

前缀 `/api`，槽位1–3；所有业务接口从Cookie会话确定归属。响应no-store。写请求要求同源Origin、JSON和CSRF；仓库额外携带X-Garden-User，服务端检查与当前会话一致，防止其他标签切换账号后旧队列写错用户。

### 6.1 认证与管理

| 接口 | 请求/结果 |
| --- | --- |
| POST /auth/register | username,password,invitationCode → userId；注册不自动登录 |
| POST /auth/login | username,password → user，设置HttpOnly Cookie |
| GET /auth/me | user、csrfToken |
| POST /auth/logout | 撤销当前会话，清Cookie；204 |
| POST /auth/change-password | currentPassword,newPassword；撤销全部会话；204 |
| POST /auth/reset-password | resetCode,newPassword；一次性消费并撤销全部会话 |
| GET /admin/invitations | status,cursor,limit可选；items,nextCursor |
| POST /admin/invitations | count(1–100),validDays(1/7/30),note；明文只返回本次结果 |
| POST /admin/invitations/:id/revoke | 撤销未使用码；已使用409 |
| GET /admin/users | username,status,cursor,limit可选；不返回敏感凭据 |
| PATCH /admin/users/:id/status | active/disabled；禁用同时撤销会话，管理员不可禁用 |
| POST /admin/users/:id/password-reset | 普通用户的一次性30分钟重置码 |
| GET /admin/audit | 分页审计 |

邀请码采用128-bit密码学随机值的大写十六进制编码，忽略输入首尾空白及分隔连字符。事务锁定邀请码、创建用户及三个空槽、消费邀请码；重名等失败回滚全部操作。管理员通过交互运维命令初始化；`bootstrap-admin.mjs --recover` 受控恢复管理员密码并审计，不提供公开引导接口。

### 6.2 花园、事件、归档

| 接口 | 契约 |
| --- | --- |
| GET /garden/profiles | 三槽摘要：slot,profileId,revision,generation,empty,name,updatedAt |
| GET /garden/profiles/:slot | slot,profileId,revision,generation,profile:CloudProfile或null,updatedAt |
| PUT /garden/profiles/:slot | baseRevision,generation,mutationId,profile；返回revision,generation,mutationId,updatedAt |
| POST /garden/profiles/:slot/clear | baseRevision,generation,mutationId；清空进度，保留旧代事件 |
| POST /garden/profiles/:slot/delete-history | 同上；清空并删除事件，推进删除水位 |
| POST /garden/profiles/:slot/events | generation,events；每项schemaVersion,eventId,packVersion,attempt；重复同ID同正文不重计 |
| GET /garden/profiles/:slot/events | cursor,limit(≤1000),generation或all=true；items,nextCursor |
| GET /garden/profiles/:slot/summary | 固定Asia/Shanghai统计、近期组题证据、当前generation |
| POST /garden/archives | data；返回archiveId；大数据由客户端切片 |
| GET /garden/archives | 当前用户归档索引 |
| GET /garden/archives/:id | 当前用户归档正文；其他用户404 |

快照事务先锁当前账号槽位，再检查mutationId。相同ID同规范正文返回原结果；不同正文409。revision/generation不同返回409；成功更新和幂等结果同事务提交。跨槽相同ID竞争由唯一索引回滚并复核原请求摘要。无force参数。旧代合法事件可入历史，但低于history_floor或高于当前代拒绝。

事件保留客户端发生时间和服务器接收时间；未知旧entryId的历史仍可保存。内容升级只允许已知迁移映射；快照失效战斗需先归档后恢复，不能将任意解析错误转换为空花园。

### 6.3 错误

响应 `{error:{code,message,details?},requestId}`。400输入/邀请码错误；401会话到期或账号变化；403权限/CSRF；409版本/幂等/事件身份冲突；413超限；422不支持的版本或无效战斗；429含Retry-After；500/503不返回SQL和堆栈。客户端401暂停，永久错误保留待上传数据，不无限重试。

## 7. 本地仓库与同步

`web/src/site/repository.ts`负责本机持久化和同步；`api.ts`负责Cookie/CSRF/账号作用域请求；旧saveStore保留为匿名档迁移读取器。Phaser帧循环不等待网络。

IndexedDB `pinyin-garden-cloud` v1中profiles/events/archives/leases按userId分区。profiles内嵌冻结inFlight请求及sequence/acked序列；events保存永久本机缓存与未确认outbox；archives保存冲突/导入暂存/receipt；leases在每次写事务检查owner与有效期。支持Web Locks，并在不支持时使用事务租约。刷新取得独占Web Lock后可接管本标签遗留的过期前租约。

本机保存原子写热快照、增量事件和dirty序列。同步恢复日志使用 `garden-journal:<userId>:<slot>`，只写热快照与尚未落盘事件，不复制全量历史；2MiB上限。日志token与保存绑定，只有对应本机事务提交后才能清除；新日志不会被旧保存完成回调清掉。

同步流程：

1. 先恢复本机journal和未确认clear/inFlight，固定账号作用域。
2. 发送前冻结mutationId/baseRevision/generation/profile/sequence并落盘。
3. 分批确认事件，之后发送快照；服务端响应只确认该sequence，之后产生的dirty继续保留。
4. 常规修改每10秒合并；波次结算、页面切换和隐藏尽力flush。单仓库调度串行；30秒请求超时后用原请求重试。
5. 网络/5xx指数退避至60秒，429尊重Retry-After；401等待原账号重登；版本、容量和冲突需人工处理。
6. 云版本领先时显式冲突。两侧先本机和云端归档，再选本机或云端；选择本机仍用最新revision。跨generation本机恢复先导出再显式导入，禁止旧队列复活。
7. 退出请求失败不假报退出；未同步记录保留在原账号分区。请求携带预期账号，迟到响应不修改另一账号UI。

UI分别显示读取、本机待同步、正在同步、已同步、离线、重新登录、冲突和不可恢复错误。错误读取不会创建新Profile覆盖。管理面板打开或同步冲突时暂停战斗。复用面板进入/按钮按压并支持系统和游戏减少动态设置。

长期统计由独立事件计算，提供服务端summary端点。前端热Profile只带近期组题证据及当前战局事件；页面统计使用完整事件汇总，保留每读音最近三个合格run和每字词/音节的最新记录。进入槽位或恢复合法hash深链时才分页拉取该槽事件；三槽列表不预取全部历史。当前所选槽位的完整历史缓存成本随历史增长，进一步可切换到服务端summary/证据查询。

旧档迁移支持单Profile、三槽数组按目标槽分别处理、v1/v2/指定旧v3和当前v3；先归档原始输入再保存当前版本。未知损坏报错，已知失效战斗归档确认后移除。来源内容包及SHA-256指纹receipt保留；只有云确认后记录完成，重试事件不重计。旧匿名数据库不自动删除。

完整备份格式为版本1 NDJSON：头部热快照与完整性标记，随后分页事件（含旧代）、云端归档正文及未同步本机记录。断网导出明确标为不完整云历史。导入先全部验证并暂存，再应用；非法后续行不提前覆盖当前花园。中断可重选同文件继续，稳定事件ID保证去重。128MiB总上限；指纹计算仍需要读取文件缓冲区，真实移动设备容量需实测。

清空进度、删除学习事件和清理已同步本机缓存各自确认；清理缓存不删旧匿名档、不碰云端，未完成导入暂存不会被自动清除。跨域迁移依靠旧站导出、新站导入，不能直接读取其他origin的IndexedDB。

## 8. 静态资源、构建和部署

### 8.1 首版结构

```text
HTTPS 同域入口
  /、/garden/、/admin/、/assets/* → 首页＋花园＋后台专用静态产物
  /api/*                     → NestJS 花园服务
                                  ↓ 私网/本机连接
                                MySQL
```

运行环境保留现有 Node >=20 的项目约束，但生产应选实施时受支持、依赖验证通过的 LTS；数据库现有本地文档为 MySQL 8.4，生产版本部署前确认。本文不引入 MySQL 5.7 兼容承诺，不新增 ORM。

- 新增 `vite.garden.config.ts` 和花园专用构建脚本，输出独立目录（建议 `web/dist-garden`）。现有全项目构建继续可用。
- 创建独立公开目录或构建白名单，仅发布首页、花园、后台所需资源，不直接复制整个 `web/public`。
- `web/public/design/` 评审稿、无关恐龙资源、原始素材、生成提示词来源文件默认不进入公开包；必要署名可整理为单独 credits 页面。
- `/assets/*` 缺失应返回 404，不回退 HTML。hash 路由无需全路径 SPA fallback；为 `/`、`/garden/` 和 `/admin/` 配置明确入口。
- 数据库端口不暴露公网；TLS 在反向代理终止，API 仅对代理监听。
- 服务进程有自动重启、就绪检查；健康接口不泄露连接参数、数据库版本、密钥。

### 8.2 资源路径与缓存

新增统一 `assetUrl(relativePath)`，图片、背景、道具、音乐、音效、发音清单都通过它生成 URL。默认基地址 `/assets/pinyin-garden/`；环境变量建议 `VITE_GARDEN_ASSET_BASE_URL`，它是公开构建配置，不能放密钥。

首版可继续原文件名、同域静态托管：

| 类型 | 缓存策略 |
| --- | --- |
| HTML、入口清单 | no-cache，允许验证，不长期缓存旧入口 |
| Vite 哈希 JS/CSS | public,max-age=31536000,immutable |
| 当前未哈希图片/音频 | no-cache + ETag/Last-Modified |
| 后续版本目录媒体 | public,max-age=31536000,immutable；禁止原地替换同 URL |
| 登录/存档/后台 API | no-store，禁止 CDN 缓存 |

未来切换对象存储/CDN：将媒体发布到不可变 `pinyin-garden/<assetRelease>/` 目录，更新基地址和清单；设置图片/音频 fetch 所需的精确 CORS、正确 MIME。先上传素材再发布引用它的代码；保留旧素材直到旧客户端支持窗口结束。公开素材无须签名 URL，私有备份绝不能放公开 bucket。

只读静态发布目录与数据库持久化目录分开。发布切换采用完整版本目录；保留旧哈希 JS/CSS，避免已打开的旧页面刷新或延迟加载时报 404。

### 8.3 服务配置与启动

生产配置至少包含：NODE_ENV、PORT、PUBLIC_ORIGIN、MYSQL_HOST/PORT/DATABASE/USER/PASSWORD、受信代理范围、日志级别。密码仅使用部署 secret，不进入前端构建或 Git。生产配置校验失败应退出。

前端 API 默认同源 `/api`，不再把 localhost:3009 编译进产物；本地继续使用 Vite proxy。配置反向代理 21 MiB 请求限制，并在应用上对存档接口设置对应解析上限；其他小接口限制 64 KiB，邀请码批量结果上限不改变请求限制。

部署顺序：备份 → 执行向后兼容迁移 → 启动新 API 并探活 → 发布静态包 → 检查注册/登录/同步/管理员 → 观察错误率。回滚只回应用到兼容版本，不自动删除新表或覆盖用户数据；数据库恢复是独立运维操作。

### 8.4 备份与运行保障

- 目标：已云同步的数据支持数据库持久化与恢复；本地未同步内容不在服务器备份范围。
- 首版恢复目标：RPO ≤24 小时、RTO ≤4 小时；这是需通过部署演练兑现的目标，不是当前保证。若要更小丢失窗口，启用 binlog/PITR 并另行验收。
- 每日加密全量备份，保留 30 天，放到独立于应用服务器的私有存储；备份失败告警。
- 首次上线前在隔离数据库恢复一次，之后每月演练；检查用户、邀请码使用状态、三个槽位及内容版本，不只检查文件能下载。
- 备份恢复后撤销全部 session 和密码重置码；核查恢复点之后已使用/已撤销的邀请码，旧备份可能使码重新有效，恢复运行前处理该差异。
- 运维日志只记录 requestId、路由、状态、耗时和必要内部 ID，禁止记录密码、邀请码、重置码、Cookie、请求正文及完整儿童存档。
- 审计首版保留 180 天；本地冲突归档保留至用户手动导出/清理，页面明确列出占用，不自动删除唯一副本。数据库幂等和会话过期记录使用定时清理任务。
- 监测 API 失败率、同步冲突率、同步耗时、请求体大小、数据库空间、备份状态；不把儿童输入内容发送到第三方统计工具。

## 9. 代码改造清单

下列路径是建议的新职责位置，可在实施时按实际依赖细化，但不得将所有逻辑继续堆入 GardenApp。

| 路径 | 工作 |
| --- | --- |
| `shared/src/pinyin-garden/cloud.ts`（新） | API envelope、槽位及错误码类型；不引入浏览器/Node 专属依赖 |
| `shared/src/pinyin-garden/snapshot.ts` | 复用现有校验，补充云端版本识别入口；不无故修改 Profile.version |
| `server/src/modules/database/`（新） | 搬迁 DatabaseService，导出公共模块；Studio 更新导入 |
| `server/src/modules/auth/`（新） | session、密码、认证守卫、CSRF、重置与限流 |
| `server/src/modules/invitations/`（新） | 生成、查询、事务核销、撤销 |
| `server/src/modules/garden/`（新） | 槽位 CRUD、快照校验、revision、幂等 |
| `server/src/modules/admin/`（新） | 后台控制器、角色守卫、审计 |
| `server/src/garden-site.module.ts`、`garden-main.ts`（新） | 独立部署入口，生产配置和解析上限 |
| `server/database/migrations/` | 新增递增迁移，索引、约束、迁移记录；不修改001 |
| `server/scripts/`（新） | 可复用迁移/管理员引导工具，不使用临时目录承载长期功能 |
| `web/src/experiments/pinyin-garden/auth/`（新） | 登录外壳、注册、重置、会话状态 |
| `web/src/experiments/pinyin-garden/services/` | 新增 repository、sync、API；旧 saveStore 作为迁移来源 |
| `web/src/experiments/pinyin-garden/GardenApp.tsx` | 注入 repository，替换初始化/保存/导入/清空/切槽；游戏状态保持独立 |
| `web/src/admin/`、`web/admin/index.html`（新） | 后台入口及邀请/用户/审计页面 |
| `web/index.html`、`web/src/main.tsx`、`pages/LearningHome.tsx` | 保留当前首页，花园链接指向正式地址，保留Waji及减少动态设置 |
| `web/garden/index.html`、`web/vite.garden.config.ts`（新） | 花园入口与首页/花园/后台专用构建；旧花园URL兼容跳转 |
| `web/src/experiments/pinyin-garden/assets/` | 统一资源解析器，更新所有媒体入口及对应测试 |
| `docs/pinyin-garden.md`、`docs/local-mysql.md` | 实施完成后更新运行、迁移、部署和数据恢复说明 |

2026-11-08复核开始时工作区干净，实施时仍须先检查差异，不重置或覆盖其他工作。本文交付不修改运行代码，也不创建数据库或管理员。

## 10. 实施阶段与完成标准

### 阶段 A：基础与认证

交付数据库公共模块、迁移、花园专用服务入口、管理员初始化、Session/CSRF、登录/注册/密码重置。验收邀请码并发核销、禁用会话、权限拒绝；旧 Studio 单测和原入口继续通过。

### 阶段 B：管理后台

交付发码、筛选、撤销、普通账号禁用/启用、重置码、审计；必须联调真实 API，不能用前端 mock 当完成。管理员初次登录到发出第一个码的全链路可运行。

### 阶段 C：云存档服务与客户端

先实现 API 事务/幂等，再引入按账号本地仓库、冻结请求和同步协调器，最后接入 GardenApp。交付冲突页面、同步状态、注销处理、清空墓碑、本机导入。

### 阶段 D：部署与迁移验收

交付花园静态包、生产配置模板、反向代理示例、备份恢复说明及自动备份配置。使用隔离测试账号和存档，不覆盖现有本机花园。选择至少一台真实 iPad 和另一台设备验证跨设备恢复；上线前完成恢复演练。

## 11. 验收矩阵

| 编号 | 场景 | 必须结果 |
| --- | --- | --- |
| AUTH-01 | 无邀请码、过期、撤销、已使用码注册 | 全部失败，不创建用户、不消耗其他码 |
| AUTH-02 | 同码两次并发注册不同用户名 | 恰好一人成功，仅一套账号/槽位 |
| AUTH-03 | 重名导致注册失败 | 邀请码仍未使用，可换用户名再注册 |
| AUTH-04 | 普通用户访问每个 admin 接口，篡改 role/userId | 403/400，不产生管理操作 |
| AUTH-05 | 禁用、修改密码、重置密码后复用旧 Cookie | 旧会话失效；重置码二次兑换失败 |
| AUTH-06 | 跨站写请求、缺 CSRF、伪造代理头 | 请求拒绝或仍按真实来源限流 |
| AUTH-07 | 直接调用旧 studio/game/conversation 等路由 | 花园部署返回404，不调用模型 |
| SAVE-01 | 一台设备保存，另一台同账号登录 | 三槽独立，恢复匹配 checkpoint，战斗暂停 |
| SAVE-02 | 未登录、不同账号访问槽位 | 不能读取/修改他人数据 |
| SAVE-03 | 写库成功后丢失响应，再重试原请求 | revision 只加一次，正确确认原 localSequence |
| SAVE-04 | 上传中连续产生新本地修改 | 旧响应不清除新 dirty，随后同步最新快照 |
| SAVE-05 | 两设备读同 revision 后分别上传 | 一方成功，另一方冲突，不静默覆盖 |
| SAVE-06 | 冲突时选择本机，但远端再次更新 | 再次冲突，无 force 覆盖 |
| SAVE-07 | A清空，B用旧进度上传；清空响应丢失 | B冲突；A可幂等确认；不复活旧数据 |
| SAVE-08 | 断网玩、关闭/刷新、恢复网络 | 本地 journal/DB 恢复；在线重登后重试队列，不冒充已云同步 |
| SAVE-09 | 用户A上传中退出，用户B登录，A响应迟到 | B界面/缓存/云数据不受影响 |
| SAVE-10 | 401、429、413、版本不支持、数据库故障 | 对应状态和退避；本地保留，可导出 |
| SAVE-11 | IndexedDB配额、journal写失败、多标签竞争 | 不误报本地成功，不同时写入，不清掉新日志 |
| SAVE-12 | 空槽只读、已有云存档加载失败 | 不自动 newProfile 上传覆盖 |
| MIG-01 | 旧v1/v2/旧v3内容包、当前v3、单档和三项原始数组 | 分别正确处理，保留旧数据及迁移来源 |
| MIG-02 | 三档一档损坏、重复导入、目标非空 | 单槽报错、receipt提示、覆盖确认与归档 |
| MIG-03 | 改域名后的导出/导入 | 完整手工链路可用，不依赖跨origin读取 |
| GAME-01 | 课程、共享弹药、波初重试、音频、暂停、hash深链 | 现有行为不回归，刷新不自动开战 |
| DEP-01 | 生产缺数据库配置、API日志、公开构建目录 | 缺必填配置时启动失败，无敏感泄漏；无评审稿和无关入口 |
| DEP-04 | 根首页、Waji、进入花园、返回首页 | 首页保留，未登录进入认证、已登录进入花园；动态效果与减少动态开关正常 |
| DEP-05 | 检查生产包与服务路由，移除全部LLM环境变量启动 | 无创造/恐龙入口和依赖；旧API返回404；花园服务启动正常，不请求模型端点 |
| DEP-02 | 更新素材、旧页面继续打开、媒体404 | 缓存正确；404不返回HTML；旧发布支持窗口可用 |
| DEP-03 | 恢复数据库备份、回滚应用 | 验证目标RPO/RTO，撤销旧会话，处理邀请码回退风险 |

测试分层：共享类型/parser 单测；同步协调器使用假时钟和可控网络测试；数据库并发与事务必须用隔离 MySQL 集成测试，不能只 mock SQL；浏览器端验证两个独立上下文、Cookie/CSRF、导入及移动端操作。运行现有 `npm run type-check`、`npm test -w web`、`npm test -w server`、`npm run build`，再补花园专用构建与集成测试命令。

首版性能验收：在选定生产规格记录普通/接近容量上限存档大小与耗时；单槽同时最多一个上传，正常连续战斗常规上传不超过每10秒一次，失败重试不形成请求风暴。页面不把全量历史嵌入三个热快照；事件按被打开的槽位分页缓存，需监测该槽首次加载成本。素材按现有场景需求加载。具体 p95 延迟目标需在部署规格确定后补充，不能凭本机结果宣称线上性能。

## 12. 风险、待确定项与后续演进

### 12.1 已接受的首版边界

- 前端产生的学习成绩可以被用户修改；服务端结构校验不能证明真实学习行为。将来排行榜/收费权益不能直接信任该快照。
- 热快照与事件已分离；本机完整历史缓存和首次统计的内存/耗时随历史增长，真实移动端仍需容量验收。
- 本地数据没有应用级加密；共享设备退出后 UI 隔离不等于阻止本机工具读取。提供“清除此账号本机数据”入口，只有已同步或已导出后才执行，不影响旧匿名档。
- 本地归档和服务器备份不是永久无上限历史库。用户删除与备份保留策略需要在公开上线说明中明确。
- 管理员协助找回账号依赖线下确认身份；首版不声称提供邮箱/短信自动找回。

### 12.2 上线前需要确定，但不阻塞本地实现

| 项目 | 当前默认 | 确定时点 |
| --- | --- | --- |
| 域名、部署地区、托管供应商 | 同域静态站+单实例NestJS+MySQL | 外部部署前 |
| 对象存储/CDN | 首版不接入；媒体同域 | 流量或维护需求增加时 |
| 管理员账号名 | 部署时交互输入，无固定密码 | 首次初始化 |
| 数据库规格、备份存储、告警接收渠道 | 每日独立加密备份，30天保留 | 上线前演练 |
| 是否要所有素材也必须登录才能访问 | 默认公开素材，仅业务数据鉴权 | 有明确私有内容需求时另扩展 |
| 账号删除、支持联系信息、公开站点必要说明 | 由运营确定，首版实现受控运维删除流程，避免悬挂引用 | 对外开放前 |

### 12.3 参考

- 现有项目：`docs/specs/pinyin-garden/spec.md`、`docs/pinyin-garden.md`、`docs/local-mysql.md`。
- [Vite 静态资源规则](https://vite.dev/guide/assets)：public 原样复制，不自动文件名哈希。
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)：Cookie、会话生命周期与撤销。
- [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)：密码哈希算法及参数；实施时核验依赖支持。

本文仅新增正式 spec，未生成一次性脚本、截图或日志，因此没有新增待清理的临时产物。

## 13. 2026-11-08 实施前复核记录（历史基线）

以下记录描述实施前的问题和设计依据；当前实现以第5～7节、实施Plan和验收记录为准，不代表这些问题仍全部存在。

### 13.1 结论和验证范围

当前代码可以作为静态游戏继续试用，但尚未达到本文要求的“邀请注册、账号隔离、可靠云存档”上线标准。新增汉字/冒险内容没有改变这一事实：server 仍只有原游戏、对话、Studio 等模块，数据库只有作品/版本迁移，没有花园账号或存档接口。

实际验证：

- `npm test -w web`：24 文件、1,342 测试通过。
- `npm test -w server`：6 文件、24 测试通过。
- `npm run type-check`、`npm run build` 均通过。
- 内容验证输出：226 个冒险关卡，1,294 项候选读音，1,274 项文本发布，20 项排除，`audioReviewed=0`；文本发布与录音审核不是同一指标。
- 内存构造合法记录检查容量和 parser 行为，未使用真实玩家存档，未连接或改写数据库。
- 没有执行真实 iPad、多设备云同步或生产部署验收；当前也无可供验证的账号/同步实现。

### 13.2 按上线优先级排序的问题

**P0：将现有整套后端直接公开，会暴露未鉴权的作品写入和模型调用接口。**

证据：`server/src/app.module.ts` 加载 GameModule/StudioModule/RescueModule；`studio.controller.ts` 的 list/save/restore 没有 Guard，service 查询没有 userId；`game.controller.ts` 的 generate 与 `conversation.controller.ts` 的 converse 接口无鉴权。实际模型调用是否产生费用取决于部署配置，但公开调用入口已存在。执行首版花园专用启动入口与路由白名单；不应为了保存花园而原样公开现有 server。CORS 不是访问控制，关闭 CORS 也不能代替鉴权。

**P0：账号、邀请码和云持久化尚未实现。**

证据：`services/saveStore.ts` 仍只写按槽位索引的浏览器 IndexedDB/localStorage，没有用户命名空间或网络调用。MySQL 当前只服务 Studio。上线前必须完成本文阶段 A–C，或明确将本次发布限定为不承诺账号/跨设备保存的静态试玩。

**P1：学习数据增长后，当前备份无法保证可导回，且不是永久历史。**

证据：`GardenApp.tsx` 的 mergeAttempts 使用 `slice(-45000)`；doImport 限制 5,000,000 字节。构造45,000条满足当前 parseProfile 的普通记录，UTF-8 JSON为19,069,282字节，超过导入限制。不是最大值，且未包含大型 previousArchive。每次 persist 都对整个 Profile 写恢复日志，再校验并写 IndexedDB；大型同步序列化可能阻塞主线程，实际设备耗时尚未测量，不把推测作为已测性能结论。

修订：持久学习事件与热快照分离，见13.4；统一导出/导入容量策略。不能只把导入上限从5 MB改成20 MiB就宣称解决长期数据问题。

**P1：内容更新可能使一个进行中关卡失效，进而使整个花园槽位不可用。**

证据：`lessonPlanner.ts::validateLearningPlan` 将存档答案快照与当前 ENTRY_MAP 文本/语境/拼音/拆分严格比较；`snapshot.ts::parseProfile` 直接调用 parseState；`saveStore.ts::loadProfileSlots` 把任何解析异常归类为“存档需要修复”。内存样本只修改一个 checkpoint 答案快照，就导致整个 Profile 抛出“题目范围损坏”。当前规则有意避免静默换题，本身应保留；缺失的是保存长期成绩并单独恢复/放弃旧战斗的产品路径。

修订：区分账号档案、历史学习事实和可恢复战斗的兼容性；发布注册内容版本，已知旧版本可归档失效 checkpoint/waveStart 后让用户返回花园，不能默认清空所有成绩。未知/损坏输入仍拒绝，不能对任何异常都自动删 checkpoint。

**P1：现有浏览器存档 parser 不能直接当作完整云端业务边界。**

证据：`snapshot.ts` 中 levelStars 只检查值形状，不检查关卡 ID；previousArchive 使用 z.unknown。内存样本的 `levelStars['not-a-real-level']` 和任意 previousArchive 对象都被接受。学习尝试包含客户端提供的成绩、时间、runId、optionCount；结构校验不能证明真实学习结果。

修订：后端另外限制字段集合、映射键、字符串长度、数量、请求字节数、账号归属和允许的内容包；原始迁移归档不随每次快照上传。首版不做反作弊，但不能用这些成绩控制付费权益或奖励；后续涉及价值的结算须服务端验证。

**P2：完整内容审核台账进入浏览器公共包，运行数据与编辑数据未分开。**

证据：characterCatalog 导入约2.5 MB的 candidate-ledger，并导出 READING_LEDGER；前端 CoverageReport 使用它。构建后公共 `phaser-*.js` 为4,069.58 kB，gzip约608.04 kB，其中确有 textValidation/sourceRef/splitAudit。这一文件还包含引擎及其他共享逻辑，不能把全部体积算作台账；但审核元数据确实随运行包发布。

修订：保留仓库台账做编辑来源，构建生成只含已发布运行字段的内容包；审核人/详细证据/源数据索引不进入默认客户端。需要面向家长显示的覆盖计数和排除说明生成独立公开摘要，不能为了瘦身直接删除功能。

**P2：生产构建与配置仍是开发整站用途。**

证据：vite.config.ts仍有主站、恐龙、花园三个入口；public/design会随public复制；database.config.ts缺环境配置时回退开发账号密码。实施花园专用构建与启动、生产配置必填和静态资源白名单；不要上传整个仓库或.env。当前花园媒体仍约36 MB，暂不需要为这个体量单独建设素材数据库。

### 13.3 数据和逻辑的归属决策

| 内容 | 权威位置 | 后端负责什么 | 前端负责什么 |
| --- | --- | --- | --- |
| 用户、密码哈希、角色、禁用状态 | MySQL | 注册登录、角色判断、密码重置 | 表单、登录状态展示 |
| 邀请码摘要、有效期、使用人、撤销状态 | MySQL | 原子核销、生成、限流、权限 | 管理员生成/复制界面 |
| Session、重置码、审计 | MySQL | 有效期、撤销、CSRF、审计 | Cookie携带与页面流程，不自行决定权限 |
| 花园昵称、选择位置、家长设置、成绩快照 | MySQL；浏览器有离线缓存 | 所有权、schema、revision和幂等 | 编辑、展示、本地及时保存 |
| 学习尝试事件 | MySQL独立事件表 | 去重、存储、归属、查询、汇总 | 即时记录并排队上传，保留最近缓存 |
| 战斗checkpoint、waveStart、learningPlan、拼音草稿 | MySQL快照＋本地缓存 | 快照结构/内容版本/并发校验 | 生成运行状态，暂停、刷新恢复 |
| 已发布字音、拆分、语境、关卡配置 | 仓库版本化运行内容包 | 使用同版本包校验，登记允许版本 | 本地快速出题/判题/展示 |
| 内容证据、审核人、待审候选 | 当前仍为仓库台账 | 首版构建时审核发布；将来CMS再迁入数据库 | 默认不下载编辑台账 |
| 图片、音乐、读音文件 | 静态目录或对象存储/CDN | 可选登记manifest/版本，不把二进制塞数据库 | 按需加载、缓存和播放 |
| 血量、弹道、动画、拖放、碰撞、答题反馈 | 浏览器运行时 | 首版无需逐帧API | 继续本地执行，阶段性保存 |
| 是否通关/学习统计 | 初期客户端事实＋服务端存储/汇总 | 汇总口径和版本统一；不声称反作弊 | 即时反馈，可用同一纯函数预览 |

“放后端”不等于“每次操作请求网络”。现有 simulation.ts、content.ts、lessonPlanner.ts 的纯函数可以留在shared供两端复用；服务器无需运行Phaser，也无需每颗子弹写数据库。现有计划生成可留客户端；只有需要不可作弊的考试/奖励时，再由后端签发run与题目计划并验证提交答案。

题库首版无需迁移成数千行可编辑数据库记录。只有明确需要不发版改题、多人审核、内容回滚后台时，才增加CMS数据模型；即使引入CMS，仍应发布不可变内容版本，不能让后台改题直接改变正在进行的战斗。

### 13.4 对第5～7节快照方案的调整：热快照与长期事件分开

如果“永久保存”包含长期学习记录，采用以下方案作为实施目标。第5节中“继续只保留45,000条”的初稿范围不再满足该目标；若最终只要求最近进度，必须在产品说明明确历史保留窗口。

1. 保留 garden_profile 作为三槽位状态与 revision 的权威行，但新的云DTO不再长期内嵌完整 attempts 和 previousArchive。先定义独立 CloudProfile，不贸然破坏现有本地Profile.v3兼容性。
2. 新增逻辑实体 learning_attempt：userId、profileId、eventId、runId、levelId、readingId、entryId、packVersion、发生时间、接收时间、作答/帮助/重试等现有证据字段。以(profileId,eventId)唯一去重；不直接以时间戳作唯一ID。
3. 作答产生事件时生成稳定eventId；先在本地事务写event outbox，再上传。服务端确认前不清除outbox；不能因为本地缓存截断而丢未确认事件。
4. 建议新增批量事件接口（分批上限和字节限制需随实现确定），重复同ID同正文返回成功，同ID不同正文拒绝。不允许按账号范围随意指定别人的profileId。
5. 云存档响应丢失时快照mutationId负责幂等；事件eventId独立幂等。两者不能相互代替。先上传当前快照依赖的事件批次，再上传快照；失败只影响进度同步时效，不撤销已持久化的学习事实。
6. 解决两个设备的快照冲突时不删除另一设备已保存的学习事件。家长采用本机/云端战斗进度，与历史事件是否存在分开处理。
7. planLesson目前需要attempts集合计算薄弱项。为其提供按readingId/entryId/run归纳的近期证据适配层；迁移时对照现有readingFacts行为做等价测试，不把“总次数”直接当“掌握程度”。
8. “不同天”统计不能继续隐式使用浏览器toLocaleDateString；为账号固定报告时区（默认Asia/Shanghai），服务器聚合和前端展示一致。存clientOccurredAt与serverReceivedAt，不将接收日期误当离线学习日期。
9. 旧v1/v2/v3导入先归档原始文件，再为历史事件生成确定性导入ID，记录导入指纹；旧历史可能有原先45,000条截断，不能从现有存档恢复已丢失记录。部分失败应可继续，不重新计数。
10. previousArchive改为只上传一次的私有迁移归档或独立数据库归档记录，返回archiveId；不递归装进每10秒上传的热快照。归档要有大小、保留与导出规则，不使用任意z.unknown通过普通保存入口写入。
11. 清空槽位默认清空游戏进度，历史事件保留并标记旧progressGeneration；重新开始使用新generation，避免旧事件影响“新花园”组题。提供独立的“删除学习历史”确认操作，与数据保留策略一致；旧pending事件须携带generation，不能污染新花园。具体界面须明确这两个操作的区别。
12. 导出提供完整备份格式版本，包含档案、历史事件和必要版本信息；较大历史分段处理，不要求一次构造巨大的localStorage字符串。导入/导出的上限、分段机制与UI提示必须对称。

因此，原20 MiB全量Profile API上限只是过渡参数，不是长期存储设计。拆分后应测量实际快照和事件批次并收紧各接口上限，保留旧大备份的专用迁移通道。

### 13.5 内容包与历史兼容的补充契约

- Profile schema版本、内容包版本、云revision、事件schema版本、静态资源release必须分开。
- 增加content_release登记（可由发布配置/数据库记录实现）：version、manifest摘要、允许读写状态、发布时刻及迁移策略。实际题库JSON/TS仍放不可变构建产物。
- 当前事实是Profile.v3/garden-adventure-4、226个冒险关卡、五档战斗难度。不能沿用“14课解锁就是全部进度”的旧假设；当前代码所有已发布课程可尝试，unlocked固定为5，服务端应保留现有产品行为。
- 新字段selectedLevel、levelStars、learningPlan、readingId、track、audioUsed、optionCount、previousArchive必须进入迁移与验证清单。旧字符包迁移会归档旧档、清空旧levelStars/checkpoint，不应在UI称为原关卡无损恢复。
- 历史readingId/entryId即使在新版本下架，也应能保留学习事实和当时展示信息；不要把历史事件直接用当前ENTRY_MAP refine后整体拒绝。
- 旧客户端写旧包：已知受支持版本通过对应校验器处理；不再支持则返回可识别升级错误，保留本机进度并提供导出。不得在服务器升级后把用户旧包存档当新包解析并静默丢字段。
- 不兼容checkpoint应归档后让用户明确选择从关卡开始；合法历史事件、昵称、设置与长期成绩仍可读取。内容包回滚需连同校验器和资源一起支持，不能只换前端HTML。

### 13.6 调整后的实施优先顺序

1. 先落实花园独立发布入口与生产配置，阻断旧API意外暴露；确定v3内容/云数据契约和学习历史保留语义。
2. 实现账号、Session、邀请码事务、管理员引导及后台。
3. 实现花园快照、revision/幂等及账号隔离，并同步建设事件表/outbox；不要先发布“永久历史”再补截断问题。
4. 实现旧档导入、内容版本兼容和冲突处理，完成大存档可导出可导回验收。
5. 精简运行内容包、静态发布白名单、备份恢复，再做真实设备和线上环境验收。

新增验收：45,000条历史可完整迁移及导回；事件断网重试不重计；两个设备快照冲突不删事件；内容更新只影响失效战斗而不锁死整个档案；下架字词的旧学习事实仍可查；清空进度后旧generation的迟到事件不进入新花园统计。

此次仅更新设计文档，未修改游戏或后端功能。动画要求不适用；无新增一次性脚本或报告，构建输出沿用项目既有dist目录，不自动清理。
