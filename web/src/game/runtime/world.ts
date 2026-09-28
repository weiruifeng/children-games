// 游戏世界统一常量：尺寸与布局参数在此单一事实源，避免 createGame / CollectScene 各写一份魔数。
export const WORLD = {
  width: 1280,
  height: 720,
  margin: 60,      // 收集物/玩家安全边距
  minDist: 60,     // 生成点最小间距
  playerSize: 48,  // 角色与收集物的世界尺寸
  knockback: 80,      // 被碰到后的弹开距离
  initialLives: 3,    // lose-life 的初始命数
  invulnerableMs: 2000, // 无敌时长
  growCap: 1.6,       // grow 特效的 scale 上限
} as const;
