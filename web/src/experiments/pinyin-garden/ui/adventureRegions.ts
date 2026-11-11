import { LESSONS } from '@children-games/shared';
const names = [
  '芽芽训练场',
  '露珠苗圃',
  '溪边苗圃',
  '风车草地',
  '月光温室',
  '萤火小径',
  '蘑菇石桥',
  '竹影小路',
  '云朵水车',
  '双叶池塘',
  '落叶秋千',
  '月牙花圃',
  '松针山坡',
  '回声山谷',
  '晚安小屋',
  '古树奇遇',
];
export const regionName = (chapter: number) => names[chapter - 1] ?? '花园奇遇';
export const regionHint = (chapter: number) =>
  LESSONS.find((l) => l.id === chapter)?.name ??
  (chapter === 15 ? '轻声词语' : '特殊读音 · 示范体验');
export const battleNames = ['悠闲散步', '轻松守护', '热闹花园', '墨团来袭', '守护挑战'];
