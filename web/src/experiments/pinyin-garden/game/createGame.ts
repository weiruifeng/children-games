import {CHARACTER_IDS,characterUrl,BACKGROUNDS,PROP_IDS,propUrl} from '../assets/manifest';
import {boardAction} from '../ui/boardInteraction';
import {EntityViews} from './entityViews';
import Phaser from 'phaser';
import {BOARD,cellX,rowY,ENTRY_MAP,hasSharedAmmo,PLANTS,tickGarden,type GardenState,type PlantKind} from '@children-games/shared';
export interface GardenBridge {actorPixels:()=>number;inputBlocked?:()=>boolean;feedback:(message:string)=>void;shovel?:()=>boolean;freeze?:()=>boolean;placement?:()=>{kind:PlantKind;row:number;col:number;valid:boolean}|null;state:()=>GardenState;change:()=>void;assetError?:(failed:boolean)=>void;cell:(row:number,col:number)=>void;plant:(id:number)=>void;enemy:(id:number)=>void;drop:(id:number)=>void;}
export function createGardenGame(parent:HTMLElement,bridge:GardenBridge,reduced:()=>boolean):Phaser.Game {
 class GardenScene extends Phaser.Scene {
  private entities!:EntityViews;private failed=false;
  preload(){for(const id of CHARACTER_IDS)this.load.image(id,characterUrl(id));for(const id of PROP_IDS)this.load.image(id,propUrl(id));this.load.image('garden-bg',bridge.state().level>=4?BACKGROUNDS.evening:BACKGROUNDS.day);this.load.on('loaderror',()=>{this.failed=true;bridge.assetError?.(true);});}
  private g!:Phaser.GameObjects.Graphics;
  private textMap=new Map<string,Phaser.GameObjects.Text>();
  private pulse=0;private accumulator=0;private refresh=0;
  create(){if(this.failed)return;bridge.assetError?.(false);this.add.image(640,320,'garden-bg').setDisplaySize(1280,640).setDepth(-1);this.g=this.add.graphics();this.entities=new EntityViews(this,this.add.graphics().setDepth(2),()=>bridge.actorPixels()*1280/Math.max(1,this.game.canvas.getBoundingClientRect().width));this.input.on('pointerdown',(pointer:Phaser.Input.Pointer)=>{
   const s=bridge.state();if(s.paused||s.helpOpen||s.stage!=='playing'||bridge.inputBlocked?.())return;
   const hit=boardAction(s,pointer.x,pointer.y,bridge.shovel?.()??false,this.game.canvas.getBoundingClientRect().width/1280);
   if(!hit)return;
   if(hit.type==='empty-shovel'){bridge.feedback('点一下要挖走的伙伴');return;}
   if(hit.type==='cell')bridge.cell(hit.row,hit.col);else bridge[hit.type](hit.id);
  });}
  label(key:string,text:string,x:number,y:number,size:number,color:string,bg?:string){
   let label=this.textMap.get(key);if(!label){label=this.add.text(x,y,text,{fontFamily:'"PingFang SC", "Microsoft YaHei", sans-serif',fontSize:size,color,backgroundColor:bg,padding:{x:8,y:5},fontStyle:'bold'}).setOrigin(.5).setDepth(3);this.textMap.set(key,label);}
   label.setText(text).setPosition(x,y).setVisible(true);return label;
  }
  update(_time:number,delta:number){
   if(this.failed||!this.g)return;
   const s=bridge.state();this.accumulator+=Math.min(delta,100)/1000;while(this.accumulator>=1/60){if(!bridge.freeze?.())tickGarden(s,1/60);this.accumulator-=1/60;}
   this.refresh+=delta;if(this.refresh>100){this.refresh=0;bridge.change();}
   if(!s.paused&&!s.helpOpen&&!bridge.freeze?.())this.pulse+=delta/1000;
   for(const label of this.textMap.values())label.setVisible(false);
   const g=this.g;g.clear();

   const levelRows=s.level===1?[1]:s.level===2?[0,1]:[0,1,2];
   for(let row=0;row<3;row++){
    g.fillStyle(levelRows.includes(row)?0xd0dfb5:0xdde5ce,.48);g.fillRoundedRect(BOARD.left-8,rowY(row)-67,916,134,16);
    for(let col=0;col<6;col++){g.fillStyle((row+col)%2?0xbed39b:0xc9dca7,levelRows.includes(row)?.48:.2);g.fillRoundedRect(BOARD.left+col*150+3,rowY(row)-60,142,120,10);}
    if(!levelRows.includes(row))this.label(`closed${row}`,'这条小路还在休息',670,rowY(row),20,'#8b9b7e');
   }
   const preview=bridge.placement?.();if(preview&&preview.row>=0&&preview.row<3&&preview.col>=0&&preview.col<6){const x=cellX(preview.col),y=rowY(preview.row);g.fillStyle(preview.valid?0xf9e49a:0xd77865,.65);g.fillRoundedRect(x-71,y-60,142,120,12);this.label('dropHint',preview.valid?'松手种下':'换一块空地',x,y-85,22,'#38543b','#fff8d8');}
   const cssScale=this.game.canvas.getBoundingClientRect().width/1280;
   for(const d of s.drops){
    // An outlined game number floats under the droplet; no rectangular UI label.
    const label=this.label(`dew${d.id}`,`+${d.value}`,d.x,d.y+30/Math.max(.1,cssScale),22,'#fff4bd');
    label.setFontSize(18/Math.max(.1,cssScale)).setPadding(3).setStroke('#467d62',3/Math.max(.1,cssScale)).setShadow(0,2/Math.max(.1,cssScale),'#294f4380',0,false,true);
   }
   for(const p of s.plants){const x=cellX(p.col),y=rowY(p.row);if(s.selectedPlant===p.id){g.lineStyle(4,0xfdf8cf);g.strokeRoundedRect(x-65,y-58,130,105,16);}
    if(bridge.shovel?.()){g.lineStyle(5,0xffd35e);g.strokeRoundedRect(x-69,y-62,138,124,14);}
    g.fillStyle(0x416852,.2);g.fillRoundedRect(x-30,y+45,60,5,2);g.fillStyle(0x538e63);g.fillRoundedRect(x-30,y+45,60*p.hp/PLANTS[p.kind].hp,5,2);
    if(p.firing){g.lineStyle(4,0xffefac,.9);g.strokeEllipse(x,y+31,100,24);this.label(`auto${p.id}`,'✓',x+43,y-35,22,'#557c3d','#f6f8d4');}
    if(p.ammo)this.label(`ammo${p.id}`,`${p.signature} · ${p.ammo}`,x,y-78,19,'#325849','#fff9de');
   }
   for(const e of s.enemies){
    const t=s.task?.entryId===e.entryId;this.label(`enemy${e.id}`,`${ENTRY_MAP[e.entryId].text}${hasSharedAmmo(s,e.entryId)?' ✓':''}`,e.x,rowY(e.row)-85,32,t?'#b66a2a':'#34434f',t?'#fff0bb':'#fff9e8');
    g.fillStyle(0x423f62,.2);g.fillRoundedRect(e.x-28,rowY(e.row)+40,56,5,2);g.fillStyle(e.armor?0xc19d62:0x6c6688);g.fillRoundedRect(e.x-28,rowY(e.row)+40,56*(e.hp+e.armor)/(e.kind==='enemy_scroll'?240:e.kind==='enemy_paper_blob'?160:80),5,2);
   }
   for(const p of s.projectiles){this.label(`bullet${p.id}`,p.signature,p.x,p.y-30,24,'#356641','#fff5bc');g.lineStyle(5,0xf4cf63,.65);g.lineBetween(p.x-35,p.y,p.x-10,p.y);}

   this.entities.update(s,this.pulse,reduced());
   this.label('path','墨团从这里来 ←',1165,140,15,'#708274');
   for(const [key,label] of this.textMap)if(!label.visible){label.destroy();this.textMap.delete(key);}
  }
 }
 return new Phaser.Game({type:Phaser.AUTO,parent,width:1280,height:640,backgroundColor:'#e5edcf',scene:GardenScene,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},render:{antialias:true},audio:{noAudio:true}});
}
