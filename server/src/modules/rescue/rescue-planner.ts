import { validateRescueSpec, type RescueSpec } from '../../../../shared/src/index';
import type { ChatMessage } from '../llm/llm.service';

type ChatClient = { chat: (messages: ChatMessage[], opts?: { maxTokens?: number; temperature?: number }) => Promise<string> };
export type RescueGeneration = { spec: RescueSpec; status: 'generated' | 'kept'; message: string; checks: string[] };

const PROMPT = `你负责修改一款面向约5岁儿童的横版触屏冒险。恐龙自动向右走，点击跳跃，终点救朋友。
只返回完整JSON，不生成代码。必须尊重孩子的要求；不支持的能力不要假装实现。
结构保持当前配置一致，schemaVersion固定rescue-1，恰好3关。
只能修改：title(32字内)、doubleJump、friend(rabbit/cat)、各关title(24字内)、theme(meadow/river/cave)、gaps、checkpoints、berries。
gaps每关1-5个，start是9-54的整数，width只允许1或2，bridge是布尔值。相邻缺口之间至少留6格地面。
checkpoints每关1-3个，位置5-56，不重复，不能在缺口及其前后1格内。
berries每关3-18个，不重复，位置4-59。
添加桥：选现有缺口把bridge设为true。容易一点：减少缺口、width改1、增加安全检查点。
山洞：theme改cave；小猫：friend改cat；跳两次：doubleJump改true。
保留没有要求改动的内容，不允许添加新字段。没有敌人、武器、飞行、自由编码能力。`;

// Keep unrelated mechanics stable; a valid JSON alone is not intent alignment.
function checkRequestedChanges(input: string, current: RescueSpec, next: RescueSpec) {
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  if (!/猫|兔|cat|rabbit/i.test(input) && current.friend !== next.friend) throw new Error('没有要求换朋友，必须保留原来的friend');
  if (!/跳|jump/i.test(input) && current.doubleJump !== next.doubleJump) throw new Error('没有要求改变跳跃能力，必须保留doubleJump');
  if (/跳两次|两次跳|二段跳|双跳|double.?jump/i.test(input) && !next.doubleJump) throw new Error('要求跳两次，doubleJump必须为true');
  if (/换.*猫|变.*猫|小猫朋友|朋友.*猫/.test(input) && next.friend !== 'cat') throw new Error('要求小猫朋友，friend必须为cat');
  if (/朋友.*山洞|朋友.*洞穴/.test(input) && next.levels[2].theme !== 'cave') throw new Error('要求山洞救援，最后一关theme必须为cave');
  for (let i = 0; i < current.levels.length; i++) {
    const before = current.levels[i]; const after = next.levels[i];
    if (!/山洞|洞穴|河|草地|森林|场景|世界|背景|主题/.test(input) && before.theme !== after.theme) throw new Error('没有要求换场景，必须保留theme');
    if (!/桥|坑|缺口|容易|简单|难|地图|关卡|路线|小路|平台|障碍|挑战/.test(input) && !same(before.gaps, after.gaps)) throw new Error('没有要求改地形，必须保留gaps');
    if (!/草莓|奖励|收集/.test(input) && !same(before.berries, after.berries)) throw new Error('没有要求改奖励，必须保留berries');
    if (!/旗|检查点|存档|复活|容易|简单|难/.test(input) && !same(before.checkpoints, after.checkpoints)) throw new Error('没有要求改检查点，必须保留checkpoints');
  }
  const bridges = (spec: RescueSpec) => spec.levels.reduce((sum, level) => sum + level.gaps.filter(gap => gap.bridge).length, 0);
  if (/加.*桥|多.*桥/.test(input) && bridges(next) <= bridges(current)) throw new Error('要求增加桥，bridge=true的缺口数量必须增加');
  if (/少.*缺口|容易|简单/.test(input)) {
    const difficulty = (spec: RescueSpec) => spec.levels.reduce((sum, level) => sum + level.gaps.reduce((n, gap) => n + (gap.bridge ? 0 : gap.width), 0), 0);
    if (difficulty(next) >= difficulty(current)) throw new Error('要求更容易，必须减少无桥缺口数量或宽度');
  }
}

function gameplay(spec: RescueSpec) {
  return { ...spec, title: '', levels: spec.levels.map(level => ({ ...level, title: '' })) };
}

export class RescuePlanner {
  constructor(private readonly llm: ChatClient) {}
  async modify(input: string, current: RescueSpec): Promise<RescueGeneration> {
    const messages: ChatMessage[] = [{ role: 'system', content: PROMPT },
      { role: 'user', content: `当前配置：${JSON.stringify(current)}\n孩子说：${input}` }];
    for (let attempt = 0; attempt < 2; attempt++) {
      let content: string;
      try { content = await this.llm.chat(messages, { temperature: 0.35, maxTokens: 3000 }); }
      catch { break; }
      try {
        const text = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        const spec = validateRescueSpec(JSON.parse(text));
        checkRequestedChanges(input, current, spec);
        if (JSON.stringify(gameplay(spec)) === JSON.stringify(gameplay(current)) && !/叫|名字|标题|命名/.test(input)) {
          return { spec: current, status: 'kept', message: '这次没有产生玩法变化。可以试试下面的建议。', checks: [] };
        }
        return { spec, status: 'generated', message: '新冒险准备好了！', checks: ['配置格式', '缺口跳跃距离', '落脚空间', '检查点安全', '未请求的玩法保持不变'] };
      } catch (error) {
        messages.push({ role: 'assistant', content }, { role: 'user', content: `校验失败：${error instanceof Error ? error.message : '非法JSON'}。请修正并返回完整配置。` });
      }
    }
    return { spec: current, status: 'kept', message: '这次没能准备好新冒险，原来的游戏还在。稍后可以再试。', checks: [] };
  }
}
