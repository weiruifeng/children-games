import {READING_LEDGER,readingReleased,entryVerified} from './characterCatalog';
import {CURRICULUM_SYMBOLS,CURRICULUM_SYLLABLES,WHOLE_SYLLABLES} from './curriculumCatalog';
/** Content is shipped locally. No model may generate live answers. */
export const PLANT_IDS = ['plant_pod_slinger','plant_dew_collector','plant_vine_guard','plant_cone_launcher'] as const;
export type PlantKind = typeof PLANT_IDS[number];
export const ENEMY_IDS = ['enemy_ink_blob','enemy_paper_blob','enemy_scroll'] as const;
export type EnemyKind = typeof ENEMY_IDS[number];
export const PLANTS: Record<PlantKind,{name:string;cost:number;hp:number;cooldown:number;description:string}> = {
  plant_pod_slinger:{name:'豆荚弹弓手',cost:100,hp:100,cooldown:4,description:'使用全队共享拼音卡，持续发射种子。'},
  plant_dew_collector:{name:'露珠收集器',cost:50,hp:80,cooldown:5,description:'自动收集露珠，让更多伙伴加入。'},
  plant_vine_guard:{name:'藤编盾卫',cost:50,hp:500,cooldown:8,description:'挡住墨团，安心准备弹药。'},
  plant_cone_launcher:{name:'松果投石手',cost:150,hp:120,cooldown:8,description:'共享音节或完整词语，持续投出范围松果弹。'},
};
export type Parts = {initial:string;medial:string;final:string;tone:number|null;whole:string};
export interface Entry {id:string;text:string;pinyin:string[];parts:Parts[];level:number;type:'character'|'word'|'symbol'|'syllable';audioId:null;reviewStatus:'reviewed'|'draft'|'excluded';readingId?:string;track?:string;context?:string;guided?:boolean;}
const marks:Record<string,string>={a:'āáǎà',o:'ōóǒò',e:'ēéěè',i:'īíǐì',u:'ūúǔù',ü:'ǖǘǚǜ'};
export function markTone(raw:string,tone:number):string {
  raw=raw.normalize('NFC').toLowerCase();
  if(tone===5)return raw;
  if(tone===2&&raw==='m')return 'ḿ';if(tone===2&&raw==='n')return 'ń';
  if(!Number.isInteger(tone)||tone<1||tone>4)throw new Error('声调必须是一至四声');
  let index=raw.indexOf('a');
  if(index<0)index=raw.indexOf('e');
  if(index<0&&raw.includes('ou'))index=raw.indexOf('o');
  if(index<0)for(let i=raw.length-1;i>=0;i--)if(marks[raw[i]]){index=i;break;}
  if(index<0)throw new Error('缺少可标调元音');
  return raw.slice(0,index)+marks[raw[index]][tone-1]+raw.slice(index+1);
}
export function stripTone(pinyin:string):{raw:string;tone:number} {
  let tone=0;let raw='';
  for(const c of pinyin.normalize('NFC').toLowerCase()){
    if(c==='ḿ'||c==='ń'){raw+=c==='ḿ'?'m':'n';tone=2;continue;}
    let found=false;
    for(const [v,tones] of Object.entries(marks)){const i=tones.indexOf(c);if(i>=0){tone=i+1;raw+=v;found=true;break;}}
    if(!found)raw+=c;
  }
  return {raw,tone};
}
// Explicit teaching decompositions. Special spellings use whole-syllable cards.
const syllables: Record<string,[string,string,string]|null>={
 a:['','','a'],zhuang:['zh','u','ang'],
 ma:['m','','a'],mi:['m','','i'],mu:['m','','u'],da:['d','','a'],tu:['t','','u'],
 hua:['h','u','a'],gua:['g','u','a'],guo:['g','u','o'],huo:['h','u','o'],shan:['sh','','an'],
 shui:['sh','','ui'],feng:['f','','eng'],yun:null,yu:null,ri:null,yue:null,
 tian:['t','i','an'],niu:['n','','iu'],niao:['n','i','ao'],cao:['c','','ao'],shu:['sh','','u'],ye:null,
 xing:['x','','ing'],shi:null,men:['m','','en'],xiao:['x','i','ao'],duo:['d','u','o'],di:['d','','i'],xi:['x','','i'],bai:['b','','ai'],
};
// Register only authored syllables, never the Cartesian product of letters.
for(const pinyin of [...CURRICULUM_SYLLABLES,...READING_LEDGER.filter(readingReleased).map(r=>r.pinyin)]){
 const {raw}=stripTone(pinyin);if(raw in syllables)continue;
 if(WHOLE_SYLLABLES.includes(raw)||['m','n'].includes(raw)){syllables[raw]=null;continue;}
 const initial=/^(zh|ch|sh|[bpmfdtnlgkhjqxzcsryw])/.exec(raw)?.[0]??'';
 let final=raw.slice(initial.length),medial='';
 if(['j','q','x'].includes(initial)&&final.startsWith('u'))final='ü'+final.slice(1);
 if(/^[iu][aoe]/.test(final)||final==='iong'||final==='üan'){medial=final[0];final=final.slice(1);}
 syllables[raw]=[initial,medial,final];
}
function rawSpelling(initial:string,medial:string,final:string):string {
 const ending=medial+final;
 return initial+(['j','q','x'].includes(initial)&&ending.startsWith('ü')?'u'+ending.slice(1):ending);
}
export const INITIALS=['b','p','m','f','d','t','n','l','g','k','h','j','q','x','zh','ch','sh','r','z','c','s'];
export const FINALS=['a','o','e','i','u','ü','ai','ei','ao','ou','ie','üe','er','an','en','in','un','ün','ang','eng','ing','ong','iu','ui'];
export const MEDIALS=['i','u','ü'];
const chars='马:mǎ 妈:mā 米:mǐ 木:mù 大:dà 土:tǔ 兔:tù 花:huā 瓜:guā 果:guǒ 火:huǒ 山:shān 水:shuǐ 风:fēng 云:yún 雨:yǔ 日:rì 月:yuè 田:tián 牛:niú 鸟:niǎo 鱼:yú 草:cǎo 树:shù 叶:yè 星:xīng 石:shí 门:mén 小:xiǎo 朵:duǒ';
const words=[['木马','mù mǎ'],['小马','xiǎo mǎ'],['大米','dà mǐ'],['土地','tǔ dì'],['花朵','huā duǒ'],['西瓜','xī guā'],['水果','shuǐ guǒ'],['火山','huǒ shān'],['白云','bái yún'],['小鸟','xiǎo niǎo'],['小鱼','xiǎo yú'],['树叶','shù yè']];
export function partsFor(pinyin:string):Parts {
  const parsed=stripTone(pinyin);const raw=parsed.raw,tone=parsed.tone||5;if(!(raw in syllables)||markTone(raw,tone)!==pinyin.normalize('NFC').toLowerCase())throw new Error(`未支持音节 ${pinyin}`);
  const split=syllables[raw];return {initial:split?.[0]??'',medial:split?.[1]??'',final:split?.[2]??'',tone,whole:split?'':raw};
}
export const LEGACY_ENTRIES:Entry[]=[
 ...chars.split(' ').map((pair,i)=>{const [text,pinyin]=pair.split(':');return {id:`char-${i+1}`,text,pinyin:[pinyin],parts:[partsFor(pinyin)],level:1,type:'character' as const,audioId:null,reviewStatus:'reviewed' as const};}),
 ...words.map(([text,pinyin],i)=>({id:`word-${i+1}`,text,pinyin:pinyin.split(' '),parts:pinyin.split(' ').map(partsFor),level:1,type:'word' as const,audioId:null,reviewStatus:'reviewed' as const})),
];
export const ENTRIES:Entry[]=[...LEGACY_ENTRIES,
 ...CURRICULUM_SYMBOLS.map(text=>({id:`symbol-${text}`,text,pinyin:[text],parts:[{initial:'',medial:'',final:'',whole:text,tone:0}],level:1,type:'symbol' as const,audioId:null,reviewStatus:'reviewed' as const})),
 ...CURRICULUM_SYLLABLES.map(pinyin=>({id:`syllable-${pinyin}`,text:pinyin,pinyin:[pinyin],parts:[partsFor(pinyin)],level:1,type:'syllable' as const,audioId:null,reviewStatus:'reviewed' as const})),
];
for(const r of READING_LEDGER.filter(readingReleased))for(const e of r.entries.filter(e=>entryVerified(e)&&(r.track==='challenge'||e.common)))ENTRIES.push({id:e.id,text:e.text,context:e.context,guided:e.guided,readingId:r.id,track:r.track,pinyin:[r.pinyin],parts:[partsFor(r.pinyin)],level:1,type:'character',audioId:null,reviewStatus:'reviewed'});
export const ENTRY_MAP=Object.fromEntries(ENTRIES.map(e=>[e.id,e])) as Record<string,Entry>;
export function signature(entry:Entry):string {return (entry.type==='symbol'?'symbol:':'')+entry.pinyin.map(p=>p.normalize('NFC')).join(' ');}
export function composeParts(parts:Parts):string|null {
 if(parts.whole&&parts.tone===0&&!parts.initial&&!parts.medial&&!parts.final&&CURRICULUM_SYMBOLS.includes(parts.whole))return parts.whole;
 const raw=parts.whole||rawSpelling(parts.initial,parts.medial,parts.final);
 if(!(raw in syllables)||!parts.tone||!Number.isInteger(parts.tone)||parts.tone<1||parts.tone>5)return null;
 const canonical=syllables[raw];
 if(canonical&&(parts.whole||canonical.join('|')!==[parts.initial,parts.medial,parts.final].join('|')))return null;
 if(!canonical&&!parts.whole)return null;
 if(['m','n'].includes(raw)&&parts.tone!==2)return null;
 return markTone(raw,parts.tone);
}
export function candidates(correct:string,pool:string[],seed:number):string[]{
 const hash=(v:string)=>[...v].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,seed+19);
 return [...new Set([correct,...pool.filter(v=>v!==correct).sort((a,b)=>hash(a)-hash(b)).slice(0,5)])].sort((a,b)=>hash(a+'x')-hash(b+'x'));
}
export interface Level {id:number;name:string;subtitle:string;rows:number[];counts:number[];armored:number[];interval:number;entries:string[];strategy:string;}
export const LEVELS:Level[]=[
 {id:1,name:'豆子出发',subtitle:'拼出第一颗种子',rows:[1],counts:[2,3,4],armored:[0,0,0],interval:10,entries:[1,2,3,4,5,6].map(n=>`char-${n}`),strategy:'家园不失去爱心'},
 {id:2,name:'藤叶围栏',subtitle:'给思考留一点时间',rows:[0,1],counts:[3,4,5],armored:[0,0,0],interval:9,entries:[7,28,12,14,1,4].map(n=>`char-${n}`),strategy:'藤盾承受攻击时完成一次装弹'},
 {id:3,name:'松果起飞',subtitle:'三块拼音，一次重击',rows:[0,1,2],counts:[4,5,6],armored:[0,1,2],interval:9,entries:[8,9,10,11,1,12].map(n=>`char-${n}`),strategy:'一颗松果同时击中两个敌人'},
 {id:4,name:'找对伙伴',subtitle:'让拼音与汉字相遇',rows:[0,1,2],counts:[5,6,7],armored:[1,2,2],interval:8,entries:LEGACY_ENTRIES.filter(e=>e.type==='character').map(e=>e.id),strategy:'在两条路线各完成一次匹配击杀'},
 {id:5,name:'花园守卫',subtitle:'把词语变成你的力量',rows:[0,1,2],counts:[5,6,7],armored:[1,2,2],interval:8,entries:LEGACY_ENTRIES.filter(e=>e.type==='word').map(e=>e.id),strategy:'卷轴怪到达最左种植列前击败它'},
];
export function allowedPlants(level:number):PlantKind[]{return PLANT_IDS.filter((_,i)=>i<2||i===2&&level>=2||i===3&&level>=3);}
export function validateContent():void {
 if(new Set(ENTRIES.map(e=>e.id)).size!==ENTRIES.length)throw new Error('重复知识编号');
 for(const e of ENTRIES){if((e.type==='character'||e.type==='word')&&[...e.text].length!==e.pinyin.length)throw new Error('文字与音节数不同');e.parts.forEach((p,i)=>{if(composeParts(p)!==e.pinyin[i])throw new Error(`拆分不符 ${e.text}`);});}
 for(const l of LEVELS)for(const id of l.entries)if(!ENTRY_MAP[id])throw new Error('关卡知识缺失');
}
validateContent();
