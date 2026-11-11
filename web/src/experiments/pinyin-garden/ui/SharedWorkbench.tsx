import { canPronounce, entryPronunciation } from '../services/pronunciation';
import type { CSSProperties } from 'react';
import {
  ENTRY_MAP,
  hasSharedAmmo,
  knowledgePool,
  taskOptions,
  type GardenState,
  type Parts,
} from '@children-games/shared';
import { GardenIcon, ToneMark } from './GardenIcon';
export function SharedWorkbench({
  state: s,
  onSelect,
  onPart,
  onChoice,
  onHelp,
  onPronounce,
  interactionLocked = false,
  lockedEntry,
}: {
  interactionLocked?: boolean;
  lockedEntry?: string;
  state: GardenState;
  onSelect: (id: string) => void;
  onPart: (key: keyof Parts, value: string | number) => void;
  onChoice: (text: string) => void;
  onHelp: () => void;
  onPronounce?: (pinyin: string[]) => void;
}) {
  const t = s.task,
    entry = t ? ENTRY_MAP[t.entryId] : null,
    answer = t && entry ? entry.parts[t.index] : null;
  const shown =
    !s.levelId ||
    entry?.guided ||
    entry?.type === 'symbol' ||
    entry?.type === 'syllable' ||
    t?.finished;
  const blocked = interactionLocked || s.paused || s.helpOpen || s.stage !== 'playing';
  const fields: ('initial' | 'medial' | 'final' | 'whole')[] = answer?.whole
    ? ['whole']
    : (['initial', 'medial', 'final'] as const).filter((k) => !!answer?.[k]);
  const labels = {
    initial: '声母',
    medial: '介母',
    final: '韵母',
    whole: entry?.type === 'symbol' ? '字母卡' : '完整音节',
  };
  const complete =
    t && answer && [...fields, 'tone' as const].every((k) => !answer[k] || !!t.parts[k]);
  const feedback =
    entry && t
      ? [
          `${entry.pinyin.join(' ')} ✓ 本波全队可用`,
          '看看亮着的部件，换一个试试',
          `${entry.pinyin.slice(0, t.index).join(' ')} ✓ 接着拼下一张卡`,
          '选卡拼音节，伙伴自动攻击本行目标',
        ]
      : [];
  const options = entry
    ? knowledgePool(s)
        .map((id) => ENTRY_MAP[id])
        .filter((e) => e.type === entry.type)
    : [];
  return (
    <section className="workbench shared-workbench" aria-label="全队拼音弹药台">
      <div className={`shared-target ${entry && entry.parts.length > 1 ? 'word-target' : ''}`}>
        <div className="target-copy">
          {entry ? (
            <>
              <div
                className="target-pinyin"
                aria-label={`目标 ${shown ? entry.pinyin.join(' ') : entry.text}`}
              >
                {shown ? entry.pinyin.join(' ') : entry.text}
              </div>
              {entry.context && (
                <span className="target-caption">
                  {entry.context.split(entry.text).map((part, i, all) => (
                    <span key={i}>
                      {part}
                      {i < all.length - 1 && <mark>{entry.text}</mark>}
                    </span>
                  ))}
                </span>
              )}
            </>
          ) : (
            <GardenIcon name="star" />
          )}
          <span className="target-instruction">
            {t?.finished
              ? '全队已准备'
              : entry?.guided
                ? '语气读音 · 示范练习'
                : entry?.type === 'symbol'
                  ? '找一样的卡片'
                  : entry?.type === 'syllable'
                    ? '照样板组合拼音'
                    : s.levelId
                      ? '看汉字 · 拼音节'
                      : '照上面的样板拼好'}
          </span>
        </div>
        <div className="target-actions">
          {entry &&
          onPronounce &&
          canPronounce(s.levelId ? entryPronunciation(entry) : entry.pinyin) ? (
            <button
              className="pronounce-target"
              aria-label={`播放 ${entry.text}`}
              disabled={blocked}
              onClick={() => onPronounce(s.levelId ? entryPronunciation(entry) : entry.pinyin)}
            >
              <GardenIcon name="sound" />
              听一听
            </button>
          ) : null}
          <div className="help-reserved">
            {t && (
              <button
                className={`help-button ${blocked || t.finished ? 'help-placeholder' : ''}`}
                disabled={blocked || t.finished}
                aria-hidden={blocked || t.finished ? true : undefined}
                tabIndex={blocked || t.finished ? -1 : undefined}
                aria-label="教我拼"
                onClick={onHelp}
              >
                <GardenIcon name="bulb" />
                教我拼
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="shared-composer">
        {t && entry && answer ? (
          <>
            <div className="shared-slots" aria-label="已选拼音">
              {t.mode === 'choose' ? (
                <strong className="shared-reading">{entry.pinyin.join(' ')}</strong>
              ) : (
                <>
                  {fields.map((k) => (
                    <div
                      key={k}
                      aria-label={labels[k]}
                      className={`shared-slot ${complete && t.parts[k] !== answer[k] ? 'needs-check' : ''}`}
                    >
                      <b>{t.parts[k] || '·'}</b>
                    </div>
                  ))}
                  {!!answer.tone && (
                    <div
                      aria-label="声调"
                      className={`shared-slot ${complete && t.parts.tone !== answer.tone ? 'needs-check' : ''}`}
                    >
                      <b>{t.parts.tone ? <ToneMark tone={t.parts.tone} /> : '·'}</b>
                    </div>
                  )}
                </>
              )}
            </div>
            {t.mode === 'choose' ? (
              <div className="shared-word-options">
                {(t.help >= 2 ? [entry] : options).map((e) => (
                  <button
                    key={e.id}
                    disabled={blocked || t.finished}
                    onClick={() => onChoice(e.text)}
                  >
                    {e.text}
                  </button>
                ))}
              </div>
            ) : (
              <div
                className="shared-options"
                style={{ '--part-count': fields.length } as CSSProperties}
              >
                {fields.map((k) => (
                  <div className="shared-group" data-part={k} key={k}>
                    <span>{labels[k]}</span>
                    <div>
                      {(t.help >= 2 ? [answer[k]] : taskOptions(s, entry, t.index, k)).map((v) => (
                        <button
                          key={v}
                          className={`${t.parts[k] === v ? 'chosen' : ''} ${String(v).length >= 3 ? 'long-part' : ''}`}
                          aria-pressed={t.parts[k] === v}
                          disabled={blocked || t.finished}
                          onClick={() => onPart(k, v)}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {!!answer.tone && (
                  <div className="shared-group shared-tones">
                    <span>声调标记</span>
                    <div>
                      {taskOptions(s, entry, t.index, 'tone').map((v) => {
                        const tone = Number(v);
                        return (
                          <button
                            key={tone}
                            aria-label={['一声', '二声', '三声', '四声', '轻声'][tone - 1]}
                            aria-pressed={t.parts.tone === tone}
                            className={t.parts.tone === tone ? 'chosen' : ''}
                            disabled={blocked || t.finished}
                            onClick={() => onPart('tone', tone)}
                          >
                            <ToneMark tone={tone} />
                            <small>{['一声', '二声', '三声', '四声', '轻声'][tone - 1]}</small>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            <span className={`shared-status ${t.finished ? 'success' : ''}`} role="status">
              {feedback.map((text) => (
                <span className="feedback-reserve" aria-hidden="true" key={text}>
                  {text}
                </span>
              ))}
              <span>{feedback[t.finished ? 0 : t.errors ? 1 : t.index > 0 ? 2 : 3]}</span>
            </span>
          </>
        ) : (
          <div className="shared-start">
            <strong>
              {s.stage === 'ready'
                ? '准备好了吗？'
                : s.stage === 'playing'
                  ? '准备弹药'
                  : s.stage === 'lost'
                    ? '再试一次吧'
                    : '这一波结束了'}
            </strong>
            <span>
              {s.stage === 'ready'
                ? '点战场中央的开始按钮'
                : s.stage === 'playing'
                  ? '点右边的卡片，再拼好音节'
                  : s.stage === 'lost'
                    ? '重试本波，重新准备弹药'
                    : '下一波重新准备弹药'}
            </span>
          </div>
        )}
      </div>
      <div className="shared-bank">
        <strong>准备弹药</strong>
        <div
          className={`shared-bank-grid ${knowledgePool(s).some((id) => ENTRY_MAP[id].pinyin.some((p) => p.length > 2)) ? 'has-syllables' : ''}`}
        >
          {knowledgePool(s).map((id) => {
            const e = ENTRY_MAP[id],
              unlocked = hasSharedAmmo(s, id),
              present = s.enemies.some((en) => en.entryId === id);
            return (
              <button
                key={id}
                aria-label={`选择${s.levelId ? e.text : e.pinyin.join(' ')}的弹药${unlocked ? '，已准备' : ''}`}
                aria-pressed={t?.entryId === id}
                className={`${e.type === 'word' ? 'word-ammo' : ''} ${unlocked ? 'unlocked' : ''} ${t?.entryId === id ? 'current' : ''} ${present ? 'needed' : ''}`}
                disabled={blocked || (!!lockedEntry && id !== lockedEntry)}
                onClick={() => onSelect(id)}
              >
                <b>{s.levelId ? e.text : s.lessonId ? e.pinyin.join(' ') : e.text}</b>
                {unlocked && <span className="ammo-check">✓</span>}
              </button>
            );
          })}
        </div>
        <small>✓ 本波已准备</small>
      </div>
    </section>
  );
}
