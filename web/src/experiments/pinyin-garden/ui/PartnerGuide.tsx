import { PLANT_IDS, PLANTS, type PlantKind } from '@children-games/shared';
import { PartnerIcon } from './PartnerIcon';
export const PARTNER_ROLES: Record<PlantKind, string> = {
  plant_pod_slinger: '打单字',
  plant_dew_collector: '收集并产露珠',
  plant_vine_guard: '挡墨团',
  plant_cone_launcher: '打词语',
};
const tips: Record<PlantKind, string> = {
  plant_pod_slinger: '拼好卡片，自动攻击本行前方的匹配目标',
  plant_dew_collector:
    '场上有存活的收集器，才能点水滴或等待自动收集；它还会额外产出。放后排保护好，最后一个离场后就不能收集',
  plant_vine_guard: '站前面，保护身后伙伴',
  plant_cone_launcher: '拼完整词，松果打一片',
};
export function PartnerGuide({ kinds = PLANT_IDS }: { kinds?: readonly PlantKind[] }) {
  return (
    <div
      className="partner-guide"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))' }}
    >
      {kinds.map((kind) => (
        <article key={kind}>
          <PartnerIcon kind={kind} size={66} />
          <strong>{PARTNER_ROLES[kind]}</strong>
          <span>{PLANTS[kind].name}</span>
          <p>{tips[kind]}</p>
        </article>
      ))}
    </div>
  );
}
