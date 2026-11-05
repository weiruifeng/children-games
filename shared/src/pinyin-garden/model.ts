import type {EnemyKind,Parts,PlantKind} from './content';
export type Stage='ready'|'playing'|'between'|'won'|'lost';
export interface Plant {id:number;kind:PlantKind;row:number;col:number;hp:number;timer:number;ammo:number;signature:string;target:number|null;firing:boolean;}
export interface Enemy {id:number;kind:EnemyKind;row:number;x:number;hp:number;armor:number;entryId:string;attackTimer:number;}
export interface Projectile {id:number;row:number;x:number;y:number;target:number;signature:string;heavy:boolean;}
export interface Drop {id:number;x:number;y:number;age:number;value:number;}
export interface LearningAttempt {taskId:string;entryId:string;syllable:number;correct:boolean;assisted:boolean;repeated:boolean;at:number;}
export interface Task {key:string;plantId:number;enemyId:number;entryId:string;index:number;parts:Parts;help:number;errors:number;finished:boolean;mode:'compose'|'choose';choice:string;}
export interface GardenEvent {id:number;type:string;x:number;y:number;value?:string;}
export interface GardenState {
 version:1;level:number;seed:number;stage:Stage;wave:number;time:number;waveTime:number;betweenTime:number;spawned:number;nextSpawn:number;
 dew:number;hearts:number;rescues:boolean[];plants:Plant[];enemies:Enemy[];projectiles:Projectile[];drops:Drop[];cooldowns:Record<PlantKind,number>;
 sharedAmmo:string[];drafts:Record<string,Task>;selectedPlant:number|null;task:Task|null;paused:boolean;helpOpen:boolean;slow:boolean;dropTimer:number;score:number;earned:string[];
 results:Record<string,{independent:boolean}>;attempts:LearningAttempt[];attackedRows:number[];strategy:boolean;nextId:number;eventId:number;events:GardenEvent[];message:string;
}
export const BOARD={width:1280,height:800,left:220,top:170,cellW:150,cellH:140,columns:6,rows:3,spawnX:1205,homeX:190};
export const cellX=(col:number)=>BOARD.left+col*BOARD.cellW+BOARD.cellW/2;
export const rowY=(row:number)=>BOARD.top+row*BOARD.cellH+BOARD.cellH/2;
export const emptyParts=():Parts=>({initial:'',medial:'',final:'',tone:0,whole:''});
