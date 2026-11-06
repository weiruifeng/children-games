import {PLANT_IDS,PLANTS,type PlantKind} from '@children-games/shared';
import {PartnerIcon} from './PartnerIcon';
export const PARTNER_ROLES:Record<PlantKind,string>={plant_pod_slinger:'打单字',plant_dew_collector:'产更多露珠',plant_vine_guard:'挡墨团',plant_cone_launcher:'打词语'};
const tips:Record<PlantKind,string>={plant_pod_slinger:'拼好卡片，自动攻击本行前方的匹配目标',plant_dew_collector:'花园会自然掉露珠，它能额外产出。放后排保护好，点水滴收集；没点也会自动收集',plant_vine_guard:'站前面，保护身后伙伴',plant_cone_launcher:'拼完整词，松果打一片'};
export function PartnerGuide({kinds=PLANT_IDS}:{kinds?:readonly PlantKind[]}){return <div className="partner-guide" style={{gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 130px), 1fr))'}}>{kinds.map(kind=><article key={kind}><PartnerIcon kind={kind} size={66}/><strong>{PARTNER_ROLES[kind]}</strong><span>{PLANTS[kind].name}</span><p>{tips[kind]}</p></article>)}</div>;}
