// 输入层抽象：第一刀文本，第二刀换语音实现。
// 当前文本输入由 Create.tsx 的 <input> 直接承载；此接口标记「输入模式」扩展点。
export type KidInputMode = 'text' | 'voice';

export type KidInput = { getInput: () => Promise<string> };
