# 本地 MySQL 开发环境

本项目的 Game Studio 持久化功能使用本机 MySQL。以下帐号仅用于本地开发，不可用于测试、预发或生产环境。

## 已约定的连接信息

| 项目 | 值 |
| --- | --- |
| 地址 | `127.0.0.1` |
| 端口 | `3306` |
| 数据库 | `children_games` |
| 应用帐号 | `children_games_app` |
| 应用密码 | `children_games_dev_2026!` |

应用帐号仅能在 `children_games` 库中执行 `SELECT`、`INSERT`、`UPDATE` 和 `DELETE`。它没有全局权限，也不能创建、修改或删除表；迁移应使用 MySQL 管理员帐号单独执行。

## 初始化

如果已通过 Homebrew 安装 MySQL 8.4，可启动服务：

```bash
brew services start mysql@8.4
```

用本机 root 帐号执行以下 SQL。命名为全小写加下划线，数据库使用 `utf8mb4`：

```sql
CREATE DATABASE IF NOT EXISTS children_games
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'children_games_app'@'localhost'
  IDENTIFIED BY 'children_games_dev_2026!';
ALTER USER 'children_games_app'@'localhost'
  IDENTIFIED BY 'children_games_dev_2026!';

CREATE USER IF NOT EXISTS 'children_games_app'@'127.0.0.1'
  IDENTIFIED BY 'children_games_dev_2026!';
ALTER USER 'children_games_app'@'127.0.0.1'
  IDENTIFIED BY 'children_games_dev_2026!';

GRANT SELECT, INSERT, UPDATE, DELETE ON children_games.*
  TO 'children_games_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON children_games.*
  TO 'children_games_app'@'127.0.0.1';
```

初始化可重复执行；`ALTER USER` 会确保固定的本地开发密码保持一致。

## 验证

```bash
/opt/homebrew/opt/mysql@8.4/bin/mysql \
  --protocol=TCP -h 127.0.0.1 -P 3306 \
  -u children_games_app -p children_games
```

按提示输入 `children_games_dev_2026!`。进入后可执行：

```sql
SELECT DATABASE();
```

应用连接变量位于 [`server/.env.example`](../server/.env.example)。Game Studio 服务端已通过 `mysql2` 使用连接池；应用帐号仍不具备执行迁移的建表权限。

## Game Studio 迁移

应用启动前，用本机 root 帐号执行首个迁移。应用帐号没有建表权限，不能代替这一步：

```bash
/opt/homebrew/opt/mysql@8.4/bin/mysql -u root children_games \
  < server/database/migrations/001_create_game_studio.sql
```

迁移创建 `game_record`（作品）和 `game_version`（不可变历史版本）。服务端 API 的入口为：

- `POST /api/studio/games`：保存新作品。
- `GET /api/studio/games`：按最近更新顺序列出作品。
- `GET /api/studio/games/:gameId`：读取作品的当前版本。
- `PUT /api/studio/games/:gameId`：保存新版本，并设为当前版本。
- `GET /api/studio/games/:gameId/versions`：按版本号倒序读取时间线。
- `POST /api/studio/games/:gameId/versions/:versionId/restore`：把历史版本恢复为当前版本，不删除任何版本。
