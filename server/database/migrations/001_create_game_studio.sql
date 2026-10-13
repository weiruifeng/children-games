CREATE TABLE game_record (
  game_id CHAR(36) NOT NULL COMMENT '游戏作品唯一标识',
  game_title VARCHAR(120) NOT NULL DEFAULT '' COMMENT '游戏作品标题',
  current_version_id CHAR(36) DEFAULT NULL COMMENT '当前展示版本唯一标识',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '作品创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '作品最后更新时间',
  PRIMARY KEY (game_id),
  INDEX idx_game_record_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='儿童游戏作品主记录';

CREATE TABLE game_version (
  version_id CHAR(36) NOT NULL COMMENT '游戏版本唯一标识',
  game_id CHAR(36) NOT NULL COMMENT '所属游戏作品唯一标识',
  version_number INT UNSIGNED NOT NULL COMMENT '同一作品内递增的版本号',
  game_spec JSON NOT NULL COMMENT '通过校验的完整游戏规格',
  version_origin VARCHAR(32) NOT NULL DEFAULT 'manual_save' COMMENT '版本产生来源',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '版本创建时间',
  PRIMARY KEY (version_id),
  UNIQUE INDEX uniq_game_version_game_id_number (game_id, version_number),
  INDEX idx_game_version_game_id_created_at (game_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='儿童游戏作品历史版本';
