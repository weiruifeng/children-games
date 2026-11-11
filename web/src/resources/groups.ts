import { ENTRY_MAP, knowledgePool, optionsFor, type GardenState } from '@children-games/shared';
import {
  entryPronunciation,
  pronunciationUrls,
} from '../experiments/pinyin-garden/services/pronunciation';
import { resources } from './manager';
export function battleSpeech(state: GardenState): string[] {
  const urls = new Set<string>();
  for (let wave = 0; wave < 3; wave++) {
    const s = { ...state, wave };
    for (const id of knowledgePool(s)) {
      const entry = ENTRY_MAP[id];
      if (!entry) continue;
      pronunciationUrls(entryPronunciation(entry)).forEach((url) =>
        urls.add(resources.resource(url).id),
      );
      for (const key of ['initial', 'medial', 'final', 'whole'] as const)
        for (const value of optionsFor(s, entry, key))
          if (typeof value === 'string')
            pronunciationUrls([value]).forEach((url) => urls.add(resources.resource(url).id));
    }
  }
  return [...urls];
}
export function battleImages(state: GardenState) {
  return resources
    .group('battle-images')
    .filter(
      (id) =>
        !id.includes('/backgrounds/') ||
        id.endsWith(state.level >= 4 ? 'bg_battle_evening.png' : 'bg_battle_day.png'),
    );
}
