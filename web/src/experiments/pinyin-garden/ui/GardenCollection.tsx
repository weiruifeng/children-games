import {
  allowedPlants,
  PLANTS,
  PLANT_IDS,
  readingFacts,
  coverageSummary,
  type LearningAttempt,
  type Profile,
  type historySummary,
} from '@children-games/shared';
import { Waji } from '../../../ui/Waji';
import { WordCollection } from './WordCollection';
import { CoverageReport } from './CoverageReport';
import { PartnerIcon } from './PartnerIcon';
type Tab = 'partners' | 'words' | 'parent';
function repeatedReadings(attempts: LearningAttempt[]) {
  const groups = new Map<string, LearningAttempt[]>();
  for (const a of attempts)
    if (a.readingId) {
      const list = groups.get(a.readingId) ?? [];
      list.push(a);
      groups.set(a.readingId, list);
    }
  return [...groups].filter(([id, records]) => readingFacts(records, id).repeatedIndependent)
    .length;
}
export function GardenCollection({
  profile,
  totalStars,
  tab,
  onTab,
  summary,
  cloud,
}: {
  profile: Profile;
  totalStars: number;
  tab: Tab;
  onTab: (tab: Tab) => void;
  summary?: ReturnType<typeof historySummary>;
  cloud: boolean;
}) {
  return (
    <main className="collection-page">
      <div className="eyebrow">每一个发现，都值得收藏</div>
      <h1>花园收藏册</h1>
      <Waji className="collection-waji" mood="happy" />
      <div className="tabs">
        {(['partners', 'words', 'parent'] as const).map((t, i) => (
          <button className={tab === t ? 'active' : ''} key={t} onClick={() => onTab(t)}>
            {['花园伙伴', '字词收藏', '给家长'][i]}
          </button>
        ))}
      </div>
      {tab === 'partners' ? (
        <>
          <div className="partner-collection">
            {PLANT_IDS.map((k) => (
              <article key={k}>
                <PartnerIcon kind={k} size={130} />
                <h2>{PLANTS[k].name}</h2>
                <p>{PLANTS[k].description}</p>
                <span>
                  {allowedPlants(profile.unlocked).includes(k)
                    ? '已经加入花园'
                    : '继续探险，认识新伙伴'}
                </span>
              </article>
            ))}
          </div>
          <h2>花园的礼物</h2>
          <div className="decoration-list">
            {['小旗帜', '溪谷配色', '园丁名牌', '温室灯光', '守护者徽章'].map((name, i) => (
              <div className={totalStars >= (i + 1) * 3 ? 'unlocked' : ''} key={name}>
                ✦<strong>{name}</strong>
                <small>{(i + 1) * 3} 颗花园星</small>
              </div>
            ))}
          </div>
        </>
      ) : tab === 'words' ? (
        <WordCollection attempts={profile.attempts} summary={summary} />
      ) : (
        <section className="parent-notes">
          <h2>看见进步，不急着下结论。</h2>
          <p>
            这里记录实际尝试，不把一次答对当成“已经掌握”。本版练习字形、拼音组合和声调标记，可点击听示范，但不考听音、朗读或实际发音。汉字挑战隐藏答案；看过示范、提示或重试不会算作独立拼写。
          </p>
          <p>
            候选 {coverageSummary().total} 项 · 已发布 {coverageSummary().published} 项 · 实际尝试{' '}
            {summary
              ? Object.keys(summary.readings).length
              : new Set(
                  profile.attempts.filter((a) => a.levelId && a.readingId).map((a) => a.readingId),
                ).size}{' '}
            项 · 多次独立完成{' '}
            {summary
              ? Object.values(summary.readings).filter((r) => r.repeatedIndependent).length
              : repeatedReadings(profile.attempts)}{' '}
            项
          </p>
          <div className="parent-stats">
            <span>
              <strong>{summary?.total ?? profile.attempts.length}</strong>次尝试
            </span>
            <span>
              <strong>
                {summary?.independent ??
                  profile.attempts.filter(
                    (a) =>
                      a.correct &&
                      !a.assisted &&
                      !a.repeated &&
                      a.firstTryCorrect === true &&
                      !!a.levelId &&
                      !a.referenceVisible &&
                      !a.retry &&
                      (a.optionCount ?? 0) > 1,
                  ).length}
              </strong>
              次独立完成
            </span>
            <span>
              <strong>
                {summary?.assisted ?? profile.attempts.filter((a) => a.assisted).length}
              </strong>
              次借助提示
            </span>
          </div>
          <p>
            其中 {summary?.reviewed ?? profile.attempts.filter((a) => a.mode === 'review').length}{' '}
            次来自复习，
            {summary?.retried ?? profile.attempts.filter((a) => a.retry).length}{' '}
            次来自失败后重试。旧版本未记录的来源不做推断。
          </p>
          <CoverageReport attempts={profile.attempts} summary={summary} />
          <p>
            {cloud
              ? '云端保存已同步的学习记录；完整历史请使用设置 → 账号与进度 → 备份与恢复中的完整导出。'
              : '进度只保存在当前浏览器。更换设备或清理浏览器前，请导出备份。'}
          </p>
        </section>
      )}
    </main>
  );
}
