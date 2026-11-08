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
