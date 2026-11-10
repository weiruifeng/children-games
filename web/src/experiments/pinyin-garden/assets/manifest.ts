import {assetUrl} from './assetUrl';
import {PLANT_IDS,ENEMY_IDS} from '@children-games/shared';
export const CHARACTER_IDS=[...PLANT_IDS,...ENEMY_IDS];
export const characterUrl=(id:string)=>assetUrl(`characters/${id}.png`);
export const BACKGROUNDS={get day(){return assetUrl('backgrounds/bg_battle_day.png');},get evening(){return assetUrl('backgrounds/bg_battle_evening.png');}};
export const PROP_IDS=['projectile_seed','projectile_cone','pickup_dew','rescue_windbell','garden_gate','vine_damage_medium','vine_damage_heavy','paper_shell'] as const;
export const propUrl=(id:string)=>assetUrl(`props/${id}.png`);
