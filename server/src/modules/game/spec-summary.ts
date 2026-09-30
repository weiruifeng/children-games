import type { CollectSpec } from '../../../../shared/src/index';

const ASSET_NAMES: Record<string, string> = {
  'yellow-dinosaur': '黄色小恐龙',
  cat: '小猫',
  rabbit: '小兔子',
  strawberry: '草莓',
  star: '星星',
  carrot: '胡萝卜',
  rock: '石头',
  lava: '岩浆',
  't-rex': '霸王龙',
  wolf: '大灰狼',
  volcano: '火山',
  meadow: '草地',
  sky: '天空',
  space: '太空',
};

const HIT_POLICY_NAMES: Record<string, string> = {
  bounce: '被碰到会弹开',
  'lose-score': '被碰到会扣分',
  'lose-life': '被碰到会掉命',
  'drop-item': '被碰到会掉东西',
};

function objLabel(o: CollectSpec['objects'][number]): string {
  const name = ASSET_NAMES[o.asset] ?? o.asset;
  switch (o.type) {
    case 'collectible': return `${name}（收集，${o.score}分）`;
    case 'obstacle': return `${name}（障碍物）`;
    case 'hazard': return `${name}（危险区）`;
    case 'enemy': return `${name}（追你）`;
  }
}

// 把 spec 转成一段人类可读的中文描述，作为「修改」时的上下文
export function summarizeSpec(spec: CollectSpec): string {
  const player = ASSET_NAMES[spec.player.character] ?? spec.player.character;
  const bg = ASSET_NAMES[spec.background.asset] ?? spec.background.asset;
  const objs = spec.objects.map(objLabel).join('、');
  const hit = HIT_POLICY_NAMES[spec.hitPolicy ?? 'lose-score'] ?? spec.hitPolicy;
  return `游戏「${spec.title}」：${player}在${bg}，有 ${objs || '（无对象）'}，${hit}，捡够 ${spec.win.value} 分赢。`;
}
