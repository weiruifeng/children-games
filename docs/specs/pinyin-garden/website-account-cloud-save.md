# 拼音花园网站化：账号、邀请注册、管理后台与云存档 Spec

- 状态：待实施；本文是用户要求的正式设计交付物，不代表功能已经完成。
- 编写日期：2026-11-06。
- 代码基线：当前工作区（含尚未提交的课程版改动），不是某个已发布 commit。
- 适用范围：拼音花园独立网站首版；保留现有游戏与课程行为。
- 默认产品选择：家长用户名/密码登录、邀请码注册、每账号三个花园、管理员手动发码、同域部署。下文除“待确定”项外均作为实施默认值。

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

## 2. 现有代码事实与复用范围

| 位置 | 当前行为 | 改造要求 |
| --- | --- | --- |
| `web/src/experiments/pinyin-garden/GardenApp.tsx` | 槽位加载、串行保存、导入导出、清空均直接调用本地存储；战斗约每秒保存，阶段切换和隐藏页面也保存 | 引入账号外壳和存档协调器；保留战斗计算、音频、操作和课程规则 |
| `web/src/experiments/pinyin-garden/services/saveStore.ts` | IndexedDB `pinyin-garden` v2；`profiles`、`profilesV2`、`migrationArchives`；localStorage 恢复日志；Web Locks 单写者 | 保留为旧数据读取器，新增按账号隔离的云存档缓存，避免原地破坏旧槽位 |
| `shared/src/pinyin-garden/snapshot.ts` | `Profile.version=2`，`parseProfile` 支持 v1 迁移；checkpoint、waveStart、legacyArchive | 前后端共用校验；账号和同步元数据放外层，不污染 Profile |
| `shared/src/pinyin-garden/curriculum.ts` | 课程版本常量与课程限制 | 服务端启动时使用一致的内容包；不在上传时强行改写未知版本 |
| `web/src/experiments/pinyin-garden/services/routes.ts` | hash 路由；URL 槽位 1–3，代码索引 0–2；battle 参数实际可为课程 1–14 | 游戏路由继续保留；在 API 边界统一转换槽位 |
| `web/src/experiments/pinyin-garden/assets/manifest.ts` | 图片为根路径 `/assets/pinyin-garden/...` | 统一资源 URL 构造器 |
| `services/gardenAudio.ts`、`services/pronunciation.ts` | 音效、音乐和点击发音的加载入口 | 所有媒体统一解析资源基地址，不只处理图片 |
| `web/vite.config.ts` | 主站、恐龙、花园三个构建入口，开发 `/api` 代理 3009 | 新增花园网站构建配置和管理入口，独立筛选公开内容 |
| `server/src/modules/studio/database.service.ts` | mysql2 连接池、参数化查询和事务包装 | 抽到公共 DatabaseModule，Studio 与新模块共享一份池 |
| `server/src/modules/studio/studio.service.ts` | 作品/版本持久化，没有账号归属过滤 | 花园部署禁用此模块，不视为已具备用户隔离 |
| `server/src/main.ts`、`app.module.ts` | `/api` 前缀，开放 CORS，加载现有全部模块 | 花园部署使用明确模块入口和同域策略 |
| `server/src/config/database.config.ts` | 允许本地开发默认连接参数 | 生产环境缺少配置时失败退出，禁止开发密码回退 |
| `server/database/migrations/001_create_game_studio.sql` | 现有 SQL 迁移 | 后续迁移独立编号，不改写既有迁移 |

当前媒体目录 `web/public/assets/pinyin-garden/` 约 36 MB，是磁盘体积，不等于首次页面传输量。旧维护文档中五关、v1 和无发音描述包含历史记录；实现以当前代码和 `curriculum.md` 为准。

## 3. 用户流程与界面

### 3.1 页面与入口

| 页面 | 建议 URL | 行为 |
| --- | --- | --- |
| 网站首页 | `/` | 首版跳转 `/garden/` |
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

以下是逻辑模型，不是已执行的 DDL。实际字段类型、索引名和 MySQL 兼容性在迁移实现时按项目 SQL 规范审核。使用 UTC 时间、utf8mb4，ID 使用应用生成 UUID；revision 以 JS 安全整数上限校验。

| 表（建议） | 核心字段 | 约束/索引 |
| --- | --- | --- |
| `garden_user` | id, username_normalized, password_hash, role, status, created_at, updated_at | username 唯一；role=user/admin，status=active/disabled |
| `garden_session` | id, token_hash, user_id, csrf_secret, created_at, last_seen_at, expires_at, revoked_at | token_hash 唯一；user_id、expires_at 索引；CSRF secret 不返回日志 |
| `garden_invitation` | id, code_hash, code_prefix, note, created_by, created_at, expires_at, revoked_at, used_by, used_at | code_hash 唯一；状态由时间/字段计算；每码至多一次 |
| `garden_profile` | id, user_id, slot, profile_json(nullable), revision, updated_at | (user_id,slot) 唯一；slot=1..3；初始 null/revision=0，清空仍保留行并递增 revision |
| `garden_mutation` | user_id, mutation_id, slot, request_hash, result_revision, created_at | (user_id,mutation_id) 唯一；保留 30 天；不存完整请求正文 |
| `garden_password_reset` | id, user_id, token_hash, created_by, expires_at, consumed_at, revoked_at | 摘要唯一；每用户仅一个有效令牌，由事务控制 |
| `garden_admin_audit` | id, actor_id, action, target_type, target_id, metadata_json, created_at | 按时间/actor 索引；metadata 仅允许白名单字段 |
| `garden_rate_limit` | bucket_key, window_start, count, expires_at | bucket_key/window 唯一；原子计数，定期清理过期窗口 |

数据约束：

- profile_json 为 null 表示空槽或已清空，不硬删除槽位，防止旧设备复活被删除进度。
- profile_json 内 `version` 是数据格式，`packVersion` 是课程包；外层 `revision` 是云并发控制，不能混用。
- 不信任客户端 updatedAt；云更新时间由服务器生成，禁止以设备时钟判断谁覆盖谁。
- 服务端对规范化后的 JSON 再做 `parseProfile` 校验；未知版本返回明确错误，禁止回退成空存档。
- 保留 `legacyArchive`、checkpoint、waveStart、课程解锁、拼音草稿、设置和学习记录。
- 当前 parser 对学习尝试最多 50,000 条，前端合并保留最近 45,000 条；本期保持该语义，不宣称保存全部历史学习事件。
- 单份 Profile UTF-8 JSON 上限 20 MiB；写接口 envelope 上限 21 MiB，反向代理和应用一致配置。旧导入 5 MB 限制需同步调整。该上限是首版容量边界，不能靠 parser 条目数推算；超限保留本地并提示导出，不静默截断。
- 幂等记录、槽位修改必须同事务提交；管理员变更和审计同事务提交。
- 用低权限运行账号执行 DML，迁移账号执行 DDL；迁移记录独立维护，禁止应用启动自动清库建表。

## 6. API 契约

所有路径前缀 `/api`，JSON 字段 camelCase，时间 ISO 8601 UTC。API 槽位始终为 1–3，前端适配层做 `index + 1`。读取认证和存档响应使用 `Cache-Control: no-store`。

### 6.1 认证与管理接口

| 方法/路径 | 请求 | 成功结果/限制 |
| --- | --- | --- |
| POST `/auth/register` | username, password, invitationCode | 201 `{userId}`；注册不自动登录 |
| POST `/auth/login` | username, password | 200 `{user}`，Set-Cookie |
| GET `/auth/me` | 无 | `{user:{id,username,role},csrfToken}`；无会话 401 |
| POST `/auth/logout` | 无，CSRF | 204，撤销当前会话并清 Cookie |
| POST `/auth/change-password` | currentPassword, newPassword | 204，撤销所有会话，重新登录 |
| POST `/auth/reset-password` | resetCode, newPassword | 204，消耗令牌并撤销全部会话 |
| GET `/admin/invitations` | status?, cursor?, limit? | items,nextCursor；limit 默认20，最多100 |
| POST `/admin/invitations` | count, validDays, note? | 201 `{items:[{id,code,expiresAt}]}`；备注最多100字符 |
| POST `/admin/invitations/:id/revoke` | 无 | 204；已使用返回409 |
| GET `/admin/users` | username?, status?, cursor?, limit? | items,nextCursor；不返回密码、令牌和存档 |
| PATCH `/admin/users/:id/status` | status | 200；disabled 时同事务撤销会话 |
| POST `/admin/users/:id/password-reset` | 无 | 201 `{resetCode,expiresAt}`，仅一次展示 |
| GET `/admin/audit` | cursor?, limit? | 管理操作记录，分页 |

邀请码默认使用随机 128-bit、无歧义 Base32 编码；允许忽略输入中的分隔连字符与首尾空白，统一大写后求摘要。随机碰撞通过唯一约束重试，不降低随机位数。注册事务锁定邀请码、检查未过期/未撤销/未使用、创建普通用户及三个空槽、标记使用人后提交；用户名重复等失败全部回滚。

### 6.2 存档接口

GET `/garden/profiles` 返回恰好三个摘要，不默认传输三个完整大型存档：

```json
{"slots":[{"slot":1,"revision":8,"empty":false,"name":"小花园","updatedAt":"2026-11-06T08:00:00Z"},{"slot":2,"revision":0,"empty":true,"name":null,"updatedAt":"2026-11-06T08:00:00Z"},{"slot":3,"revision":0,"empty":true,"name":null,"updatedAt":"2026-11-06T08:00:00Z"}]}
```

GET `/garden/profiles/:slot` 返回 `{slot,revision,updatedAt,profile:Profile|null}`。

PUT `/garden/profiles/:slot` 创建或替换快照：

```typescript
interface SaveRequest {
  baseRevision: number;
  mutationId: string; // UUID，同一次网络重试保持不变
  profile: Profile;
}
interface MutationResult {
  slot: 1 | 2 | 3;
  revision: number; // 此次操作成功产生的版本，重试也返回该版本
  mutationId: string;
}
```

POST `/garden/profiles/:slot/clear`：`{baseRevision,mutationId}`，同样返回 MutationResult。清空、导入覆盖与普通保存采用同一版本和幂等规则，不提供绕过 revision 的 force 参数。

事务执行顺序：

1. 校验会话、归属、字段和大小；`parseProfile` 失败不写入。
2. 锁定当前用户对应槽位行；检测已存在的 mutationId。
3. 同 mutationId、同规范化请求哈希：返回原操作结果，不再修改；同 ID 不同请求：409 `IDEMPOTENCY_KEY_REUSED`。
4. baseRevision 不等于数据库 revision：409 `REVISION_CONFLICT`，仅返回当前 revision/updatedAt，客户端另行获取完整远端快照。
5. 更新快照或设为 null，revision + 1，写入幂等结果并提交。

旧幂等记录超过 30 天被清理后，旧 baseRevision 仍会被版本检查拒绝，不会重复执行。并发同 ID 跨槽位请求依靠唯一约束回滚并读取既有幂等结果，必须校验 request_hash，不能将唯一冲突视为成功写入。

### 6.3 错误格式

```json
{"error":{"code":"REVISION_CONFLICT","message":"云端已有其他设备保存的进度","requestId":"...","details":{"currentRevision":9}}}
```

| HTTP | code 示例 | 客户端行为 |
| --- | --- | --- |
| 400 | INVALID_INPUT / INVALID_PROFILE / INVALID_INVITATION | 显示可操作说明，不自动反复重试 |
| 401 | AUTH_REQUIRED | 保留本地、暂停、重新登录 |
| 403 | FORBIDDEN / CSRF_INVALID | 停止上传；重新获取会话信息或提示无权限 |
| 409 | USERNAME_TAKEN / REVISION_CONFLICT / IDEMPOTENCY_KEY_REUSED | 对应表单或冲突处理 |
| 413 | PROFILE_TOO_LARGE | 保留本地，允许导出，停止自动上传 |
| 422 | UNSUPPORTED_PROFILE_VERSION | 提示更新客户端，不清空数据 |
| 429 | RATE_LIMITED | 按 Retry-After 重试 |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE | 指数退避；不把内部 SQL/堆栈返回浏览器 |

## 7. 本地存储与同步算法

### 7.1 分层职责

```text
GardenApp / 游戏状态
       ↓ saveLocal(snapshot)
ProfileRepository（冻结账号、槽位和会话世代）
       ├── 同步 recovery journal
       ├── IndexedDB 原子写入 snapshot + dirty metadata
       └── CloudSyncCoordinator → Garden API
```

建议新增 `profileRepository.ts`、`cloudSync.ts`、`gardenApi.ts`，原 `saveStore.ts` 保持旧存档读取与导出能力。不要让 Phaser 帧循环直接 await 网络。

新 IndexedDB 数据库 `pinyin-garden-cloud` v1：

- `profiles`：复合键 `[userId,slot]`，值含本地 profile、baseRevision、localSequence、ackedSequence、updatedLocalAt、dirty 操作类型。
- `inFlight`：复合键 `[userId,slot]`，保留冻结请求 `{mutationId,baseRevision,operation,profile?,localSequence}`，发送前必须持久化。
- `conflictArchives`：用户显式解决冲突/覆盖前保存本地与远端原始副本，含来源、版本、时间。
- `migrationReceipts`：旧数据指纹、源槽位、目标 userId/slot、成功云 revision，只有服务端成功后登记完成。
- localStorage journal 使用 `pinyin-garden-cloud:<userId>:<slot>` 命名，包含恢复所需序列号和 envelope；成功提交相同序列的 IndexedDB 事务后才清除。

journal 写入失败但 IndexedDB 成功：可继续，显示恢复保护降级；IndexedDB 失败：不得显示本机保存成功，也不清掉较新的 journal。不能把旧 journal 的到达顺序当成新版本，应比较 localSequence 并校验 userId。

多标签：延续单写者策略，Web Lock 以账号为作用域；无 Web Locks 时采用 IndexedDB 租约和 fencing token，写事务校验租约世代。后台节流后失去租约的旧标签必须停止保存。BroadcastChannel 仅用于通知，不作为互斥保证。切换账号/退出释放锁，不沿用当前永久持有的全局 writer guard。

### 7.2 状态机与提示

| 状态 | 进入条件 | 提示/动作 |
| --- | --- | --- |
| loading | 正在确认身份/读取数据 | 加载，不创建空存档覆盖远端 |
| synced | 当前 localSequence 已获服务器确认 | 已同步云端 |
| local-pending | 本地成功，有待传输数据 | 已保存本机，等待同步 |
| syncing | 有冻结请求正在发送 | 正在同步；仍允许新本地操作 |
| offline | 网络错误，当前会话此前已认证 | 已保存本机，联网后同步 |
| auth-required | 收到 401/明确禁用 | 暂停游戏，登录后继续同步 |
| conflict | 409 版本冲突 | 暂停当前花园上传及战斗，等待家长选择 |
| local-error | 本地保存失败 | 红色提示、重试、导出当前内存快照 |
| cloud-error | 无法自动恢复的校验/大小错误 | 本地保留，显示原因及导出入口 |

战斗 HUD 使用紧凑状态图标和可展开说明，错误时显示文字，不长期遮挡战场。设置页显示最后云同步时间、重试、导出入口。同步时间取最后被确认操作的服务器信息，不直接用“现在”。

### 7.3 调度与响应处理

1. 每次游戏保存捕获不可变快照，localSequence + 1；不得将持续可变的对象引用交给延迟队列。
2. 本地 snapshot 和 dirty metadata 同一事务落盘；即时 journal 作为恢复补充。
3. 持续有修改时每 10 秒最多发起一次常规快照上传；空闲停止，不用会被连续操作无限推迟的纯 debounce。
4. 波次结束、通关、返回花园、切槽触发优先 flush，仍遵守每槽单 in-flight 和服务端限流。
5. 页面隐藏/pagehide 先本地保存，再尽力触发 flush；不依赖 unload、sendBeacon 或大请求 keepalive 成功。
6. 发送前把请求完整写入 inFlight；重试严格使用同一 mutationId、baseRevision 和 payload。
7. 请求发出后可积累下一份本地修改。响应成功只确认请求所带 localSequence；若有新修改，保留 dirty，并将其下一次 baseRevision 推进到已确认 revision。
8. 旧响应只可更新其捕获的 userId/slot 记录；会话世代不一致不得写回当前 UI，也不得调度另一个账号的上传。
9. 超时/5xx 使用 2、5、10、30、60 秒退避并加随机抖动，之后最多每分钟一次；重连可立即尝试。401、403、409、413、422 不盲目重试。
10. 收到幂等成功响应可能只是旧操作的结果，不证明云端仍停留在该 revision。登录、回到前台、切槽时重新读取摘要；发现远端更新时走拉取或冲突流程。

### 7.4 启动、重连与跨设备

对每个被打开的槽位按以下顺序处理：

1. 验证身份；获取服务端槽位摘要。
2. 存在 inFlight 时先用原请求重试，解决“服务端提交但客户端没收到响应”的不确定性，再处理本地后续序列；不得先把它当普通 dirty 重新生成 ID。
3. 本地干净且云版本不同：拉取远端，经校验后缓存；云端 null 同样覆盖干净本地，不能复活旧进度。
4. 本地 dirty 且云版本等于 baseRevision：上传；本地 dirty 且云版本不同：冲突。
5. 本地不存在：拉取云端；远端空且本地无记录时才显示空槽。
6. 远端返回非法内容：保留原始副本，显示不可读取，不创建空值上传。

同时玩两台设备：首版允许两端本地运行，云写使用乐观并发控制。出现冲突的一端暂停当前花园，不做 checkpoint、星星、学习尝试的自动字段合并。无需引入在线设备踢人/分布式游戏锁。

### 7.5 冲突解决

展示本地和云端的花园名、课程进度、更新时间及未同步说明，提供：

- 使用云端：先归档本地完整数据，再拉取并使用最新远端，清理被放弃的 pending/inFlight。
- 使用本机：先归档两侧完整数据，再以刚读取的远端 revision 为 baseRevision 提交新 mutation；再次冲突继续提示，不能强制无条件覆盖。
- 暂不处理/导出两份：暂停该槽云同步，不影响查看其他槽位。

如果本地归档存储失败，要求用户先完成文件导出再进行破坏性覆盖；不能仅弹出确认就丢弃唯一副本。服务器已有备份不能替代用户本地尚未同步的进度。

### 7.6 清空与导入

- 清空前暂停当前槽的编辑，完成本地事务，并解决未确认的 inFlight；只允许在在线且已知云版本时执行云清空。
- 用户确认后发送 clear mutation；成功后本地存 null 和新 revision。超时保持“清空结果待确认”，使用同 ID 重试，不继续创建新花园。
- 其他设备持有旧 revision 的保存会收到冲突；云端保留空槽版本墓碑，不能因删除行导致 revision 重置。
- 导入单份 Profile：读取大小检查 → JSON 解析 → parseProfile → 展示名字/课程 → 确认目标槽位 → 归档现有数据 → 按新本地修改上传。
- 导入操作须在线并先解决目标槽位已有 pending/inFlight，避免旧响应覆盖刚导入数据。
- 旧原始备份是三项数组；新增迁移入口专门支持它，逐槽校验、逐槽映射，不能直接把数组交给 parseProfile。
- 原始备份中的损坏槽单独报错，其他槽仍可迁移。`legacyArchive` 保留原样；旧 v1 检查点是否迁移遵循现有 parseProfile 逻辑，不承诺延续旧战斗。
- 同域旧 IndexedDB 数据不删除，迁移可重复预览；有成功 receipt 的内容默认提示“已导入”而不是重复自动上传。
- 不同 origin 无法直接读取旧数据：在旧地址导出，在新地址导入。迁移页提供步骤，不能声称改域名后自动找回。

## 8. 静态资源、构建和部署

### 8.1 首版结构

```text
HTTPS 同域入口
  /garden/、/admin/、/assets/* → 花园专用静态构建产物
  /api/*                     → NestJS 花园服务
                                  ↓ 私网/本机连接
                                MySQL
```

运行环境保留现有 Node >=20 的项目约束，但生产应选实施时受支持、依赖验证通过的 LTS；数据库现有本地文档为 MySQL 8.4，生产版本部署前确认。本文不引入 MySQL 5.7 兼容承诺，不新增 ORM。

- 新增 `vite.garden.config.ts` 和花园专用构建脚本，输出独立目录（建议 `web/dist-garden`）。现有全项目构建继续可用。
- 创建独立公开目录或构建白名单，仅发布花园、后台所需资源，不直接复制整个 `web/public`。
- `web/public/design/` 评审稿、无关恐龙资源、原始素材、生成提示词来源文件默认不进入公开包；必要署名可整理为单独 credits 页面。
- `/assets/*` 缺失应返回 404，不回退 HTML。hash 路由无需全路径 SPA fallback；为 `/garden/` 和 `/admin/` 配置明确入口。
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
| `web/garden/index.html`、`web/vite.garden.config.ts`（新） | 网站入口与专用构建 |
| `web/src/experiments/pinyin-garden/assets/` | 统一资源解析器，更新所有媒体入口及对应测试 |
| `docs/pinyin-garden.md`、`docs/local-mysql.md` | 实施完成后更新运行、迁移、部署和数据恢复说明 |

现有工作区包含用户尚未提交改动，实施时先检查差异，不重置或覆盖。本文交付不修改运行代码，也不创建数据库或管理员。

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
| MIG-01 | 旧v1、当前v2、单档和三项原始数组 | 分别正确处理，保留旧数据及迁移来源 |
| MIG-02 | 三档一档损坏、重复导入、目标非空 | 单槽报错、receipt提示、覆盖确认与归档 |
| MIG-03 | 改域名后的导出/导入 | 完整手工链路可用，不依赖跨origin读取 |
| GAME-01 | 课程、共享弹药、波初重试、音频、暂停、hash深链 | 现有行为不回归，刷新不自动开战 |
| DEP-01 | 生产缺密钥、API访问日志、公开构建目录 | 启动失败或无敏感泄漏；无评审稿和无关入口 |
| DEP-02 | 更新素材、旧页面继续打开、媒体404 | 缓存正确；404不返回HTML；旧发布支持窗口可用 |
| DEP-03 | 恢复数据库备份、回滚应用 | 验证目标RPO/RTO，撤销旧会话，处理邀请码回退风险 |

测试分层：共享类型/parser 单测；同步协调器使用假时钟和可控网络测试；数据库并发与事务必须用隔离 MySQL 集成测试，不能只 mock SQL；浏览器端验证两个独立上下文、Cookie/CSRF、导入及移动端操作。运行现有 `npm run type-check`、`npm test -w web`、`npm test -w server`、`npm run build`，再补花园专用构建与集成测试命令。

首版性能验收：在选定生产规格记录普通/接近容量上限存档大小与耗时；单槽同时最多一个上传，正常连续战斗常规上传不超过每10秒一次，失败重试不形成请求风暴。页面首次加载不预取三个完整存档，素材按现有场景需求加载。具体 p95 延迟目标需在部署规格确定后补充，不能凭本机结果宣称线上性能。

## 12. 风险、待确定项与后续演进

### 12.1 已接受的首版边界

- 前端产生的学习成绩可以被用户修改；服务端结构校验不能证明真实学习行为。将来排行榜/收费权益不能直接信任该快照。
- JSON 全量同步最容易保留现有行为，但学习历史增长会增加请求量；20 MiB 上限和50,000条 parser边界需监测，后续可拆分学习事件和战斗快照。
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

- 现有项目：`docs/specs/pinyin-garden/curriculum.md`、`docs/pinyin-garden.md`、`docs/local-mysql.md`。
- [Vite 静态资源规则](https://vite.dev/guide/assets)：public 原样复制，不自动文件名哈希。
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)：Cookie、会话生命周期与撤销。
- [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)：密码哈希算法及参数；实施时核验依赖支持。

本文仅新增正式 spec，未生成一次性脚本、截图或日志，因此没有新增待清理的临时产物。
