CREATE TABLE IF NOT EXISTS garden_user (
  id CHAR(36) NOT NULL COMMENT '用户ID',
  username_normalized VARCHAR(32) NOT NULL COMMENT '规范用户名',
  password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希',
  user_role VARCHAR(16) NOT NULL DEFAULT 'user' COMMENT '角色',
  user_status VARCHAR(16) NOT NULL DEFAULT 'active' COMMENT '状态',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  PRIMARY KEY (id),
  UNIQUE KEY uniq_username (username_normalized)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='garden_user';

CREATE TABLE IF NOT EXISTS garden_session (
  id CHAR(36) NOT NULL COMMENT '会话ID',
  token_hash CHAR(64) NOT NULL COMMENT '令牌摘要',
  user_id CHAR(36) NOT NULL COMMENT '用户',
  csrf_secret CHAR(64) NOT NULL COMMENT 'CSRF随机值',
  last_seen_at DATETIME(3) NOT NULL COMMENT '最近访问',
  expires_at DATETIME(3) NOT NULL COMMENT '绝对过期',
  revoked_at DATETIME(3) NULL COMMENT '撤销时间',
  PRIMARY KEY (id),
  UNIQUE KEY uniq_token (token_hash),
  KEY idx_user (user_id),
  KEY idx_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='garden_session';

CREATE TABLE IF NOT EXISTS garden_invitation (
  id CHAR(36) NOT NULL COMMENT '邀请码ID',
  code_hash CHAR(64) NOT NULL COMMENT '随机码摘要',
  code_prefix VARCHAR(8) NOT NULL COMMENT '展示前缀',
  note VARCHAR(100) NOT NULL COMMENT '备注',
  created_by CHAR(36) NOT NULL COMMENT '管理员',
  created_at DATETIME(3) NOT NULL COMMENT '创建时间',
  expires_at DATETIME(3) NOT NULL COMMENT '过期时间',
  revoked_at DATETIME(3) NULL COMMENT '撤销时间',
  used_by CHAR(36) NULL COMMENT '使用人',
  used_at DATETIME(3) NULL COMMENT '使用时间',
  PRIMARY KEY (id),
  UNIQUE KEY uniq_code (code_hash),
  KEY idx_created (created_at,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='garden_invitation';

CREATE TABLE IF NOT EXISTS garden_profile (
  id CHAR(36) NOT NULL COMMENT '花园ID',
  user_id CHAR(36) NOT NULL COMMENT '所属用户',
  slot_number TINYINT UNSIGNED NOT NULL COMMENT '槽位1到3',
  profile_json JSON NULL COMMENT '不含历史的热快照',
  revision BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '并发版本',
  generation INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '进度世代',
  history_floor INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '已删除历史世代下界',
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uniq_user_slot (user_id,slot_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='garden_profile';

CREATE TABLE IF NOT EXISTS garden_mutation (
  id CHAR(36) NOT NULL COMMENT '操作ID',
  user_id CHAR(36) NOT NULL COMMENT '用户',
  request_hash CHAR(64) NOT NULL COMMENT '规范请求摘要',
  result_json JSON NOT NULL COMMENT '确认结果',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  PRIMARY KEY (user_id,id),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='garden_mutation';

CREATE TABLE IF NOT EXISTS garden_learning_event (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '分页序号',
  profile_id CHAR(36) NOT NULL COMMENT '花园',
  event_id VARCHAR(160) NOT NULL COMMENT '客户端稳定事件ID',
  generation INT UNSIGNED NOT NULL COMMENT '进度世代',
  pack_version VARCHAR(80) NOT NULL COMMENT '内容包',
  event_json JSON NOT NULL COMMENT '完整事件',
  request_hash CHAR(64) NOT NULL COMMENT '事件摘要',
  received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '接收时间',
  PRIMARY KEY (id),
  UNIQUE KEY uniq_profile_event (profile_id,generation,event_id),
  KEY idx_profile_sequence (profile_id,generation,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='garden_learning_event';

CREATE TABLE IF NOT EXISTS garden_archive (
  id CHAR(36) NOT NULL COMMENT '归档ID',
  user_id CHAR(36) NOT NULL COMMENT '所属用户',
  archive_json JSON NOT NULL COMMENT '归档正文',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  PRIMARY KEY (id),
  KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='garden_archive';

CREATE TABLE IF NOT EXISTS garden_password_reset (
  id CHAR(36) NOT NULL COMMENT '重置记录ID',
  user_id CHAR(36) NOT NULL COMMENT '用户',
  token_hash CHAR(64) NOT NULL COMMENT '令牌摘要',
  expires_at DATETIME(3) NOT NULL COMMENT '过期时间',
  consumed_at DATETIME(3) NULL COMMENT '消费时间',
  revoked_at DATETIME(3) NULL COMMENT '撤销时间',
  PRIMARY KEY (id),
  UNIQUE KEY uniq_token (token_hash),
  KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='garden_password_reset';

CREATE TABLE IF NOT EXISTS garden_admin_audit (
  id CHAR(36) NOT NULL COMMENT '审计ID',
  actor_id CHAR(36) NOT NULL COMMENT '操作者',
  action_name VARCHAR(80) NOT NULL COMMENT '操作名称',
  target_id VARCHAR(80) NOT NULL COMMENT '目标ID',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '发生时间',
  PRIMARY KEY (id),
  KEY idx_created (created_at,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='garden_admin_audit';

CREATE TABLE IF NOT EXISTS garden_rate_limit (
  bucket_key CHAR(64) NOT NULL COMMENT '限流维度摘要',
  window_start BIGINT UNSIGNED NOT NULL COMMENT '时间窗口',
  request_count INT UNSIGNED NOT NULL COMMENT '请求次数',
  expires_at DATETIME(3) NOT NULL COMMENT '清理时间',
  PRIMARY KEY (bucket_key,window_start),
  KEY idx_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='garden_rate_limit';
