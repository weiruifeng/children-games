import { useRef } from 'react';
import { LESSONS, type Profile } from '@children-games/shared';
import { ResourceSettings } from '../../../resources/ResourceSettings';

interface SettingsProps {
  profile: Profile;
  changeSetting: (key: keyof Profile['settings'], value: number | boolean) => void;
  chooseScope: (limit: number) => void;
  onPreview: () => void;
  beforeUpdate: () => Promise<void>;
  onCollection: () => void;
  onAccount?: () => void;
  onSlots: () => void;
  onExport: () => void;
  onImport: (file: File) => Promise<void>;
  onClear: () => void;
}

/** Settings presentation delegates persistence and navigation to the active session. */
export function GardenSettings({
  profile,
  changeSetting,
  chooseScope,
  onPreview,
  beforeUpdate,
  onCollection,
  onAccount,
  onSlots,
  onExport,
  onImport,
  onClear,
}: SettingsProps) {
  const imports = useRef<HTMLInputElement>(null);
  return (
    <main className="settings-page">
      <div className="eyebrow">按照自己的节奏</div>
      <h1>游戏设置</h1>
      <section className="settings-paper">
        <label>
          课堂学到哪课
          <select
            aria-label="课堂范围"
            value={profile.lessonLimit}
            onChange={(e) => chooseScope(Number(e.target.value))}
          >
            {LESSONS.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                第 {lesson.id} 课 · {lesson.name}
              </option>
            ))}
          </select>
        </label>
        <p>课堂进度只调整推荐位置，不限制手动选择课程。</p>
        <label>
          点击拼音发音
          <input
            type="checkbox"
            checked={profile.settings.speech}
            onChange={(e) => changeSetting('speech', e.target.checked)}
          />
        </label>
        <label>
          拼音音量
          <input
            aria-label="拼音音量"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={profile.settings.speechVolume}
            onChange={(e) => changeSetting('speechVolume', Number(e.target.value))}
          />
        </label>
        <label>
          慢速战斗
          <input
            type="checkbox"
            checked={profile.settings.slow}
            onChange={(e) => changeSetting('slow', e.target.checked)}
          />
        </label>
        <label>
          减少动态效果
          <input
            type="checkbox"
            checked={profile.settings.reducedMotion}
            onChange={(e) => changeSetting('reducedMotion', e.target.checked)}
          />
        </label>
        <label>
          音乐音量
          <input
            aria-label="音乐音量"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={profile.settings.music}
            onChange={(e) => changeSetting('music', Number(e.target.value))}
          />
        </label>
        <label>
          音效音量
          <input
            aria-label="音效音量"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={profile.settings.sfx}
            onChange={(e) => changeSetting('sfx', Number(e.target.value))}
          />
        </label>
        <button onClick={onPreview}>试听音效 ♪</button>
        <hr />
        <ResourceSettings beforeUpdate={beforeUpdate} />
        <hr />
        <button onClick={onCollection}>看看学习记录</button>
        <details className="garden-advanced">
          <summary>高级管理</summary>
          {!!profile.previousArchive && (
            <p>路线已更新，旧成绩和原始存档已保留。旧战局已归档，新的守护从你选择的路线开始。</p>
          )}
          {onAccount ? (
            <button onClick={onAccount}>账号与进度管理</button>
          ) : (
            <div className="settings-actions">
              <button onClick={onSlots}>切换花园</button>
              <button onClick={onExport}>导出备份</button>
              <button onClick={() => imports.current?.click()}>导入备份</button>
              <button className="danger-button" onClick={onClear}>
                清空当前花园
              </button>
            </div>
          )}
        </details>
        <input
          ref={imports}
          type="file"
          accept="application/json,.json,.ndjson"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onImport(file);
            e.target.value = '';
          }}
        />
      </section>
    </main>
  );
}
