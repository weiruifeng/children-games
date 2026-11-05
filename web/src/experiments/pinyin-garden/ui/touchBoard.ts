import {BOARD, type GardenState, type PlantKind, LEVELS, PLANTS, allowedPlants} from '@children-games/shared';
export function boardPoint(x:number,y:number,rect:{left:number;top:number;width:number;height:number}) {
 if(!rect.width||!rect.height||x<rect.left||x>rect.left+rect.width||y<rect.top||y>rect.top+rect.height)return null;
 const px=(x-rect.left)*1280/rect.width,py=(y-rect.top)*640/rect.height;
 return {x:px,y:py,row:Math.floor((py-BOARD.top)/BOARD.cellH),col:Math.floor((px-BOARD.left)/BOARD.cellW)};
}
export function canDropPlant(s:GardenState,kind:PlantKind,row:number,col:number){
 return !s.paused&&!s.helpOpen&&!['won','lost'].includes(s.stage)&&allowedPlants(s.level).includes(kind)&&LEVELS[s.level-1].rows.includes(row)&&col>=0&&col<6&&s.dew>=PLANTS[kind].cost&&s.cooldowns[kind]===0&&!s.plants.some(p=>p.row===row&&p.col===col);
}
